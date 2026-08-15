package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

// errMatchNotFound signals a genuine "match does not exist" (empty upstream
// result), distinct from a transient upstream failure (429 backoff / budget /
// network / no stale). Handlers map the former to 404 and the latter to 503 so a
// valid match never hard-404s during a transient outage.
var errMatchNotFound = errors.New("match not found")

// MatchHandler handles match-related HTTP endpoints.
// List endpoints (running, upcoming, past) read from Redis (populated by the poller).
// On-demand endpoints (by-date, by-id) call LiquipediaService.MakeRequest() directly.
// All endpoints return NormalizedMatch (PandaMatch-compatible) JSON.
type MatchHandler struct {
	liqService *services.LiquipediaService
	redisCache *cache.RedisCache
	log        *logrus.Logger
}

func (h *MatchHandler) RegisterRoutes(g RouterGroup) {
	// Legacy endpoint (kept for backward compatibility)
	g.GET("/live", h.GetRunningMatches)

	// Match endpoints
	g.GET("/matches/running", h.GetRunningMatches)
	g.GET("/matches/upcoming", h.GetUpcomingMatches)
	g.GET("/matches/past", h.GetPastMatches)

	g.POST("/matches/by-date", h.GetMatchesByDate)
	g.GET("/matches/:id", h.GetMatch)
}

// GetRunningMatches returns matches currently running (live).
// Reads from Redis cache populated by the poller, normalizes to PandaMatch format.
func (h *MatchHandler) GetRunningMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	matches, err := h.readAndNormalizeMatches(ctx, cache.LiqMatchesRunningKey, wikis, "running")
	if err != nil {
		h.log.WithError(err).Warn("Error reading running matches from cache")
	}

	// Fallback to stale cache if fresh cache is empty
	if len(matches) == 0 {
		staleMatches, staleErr := h.readAndNormalizeMatches(ctx, func(wiki string) string {
			return cache.StaleKey(cache.LiqMatchesRunningKey(wiki))
		}, wikis, "running")
		if staleErr == nil && len(staleMatches) > 0 {
			h.log.Debug("Using stale cache for running matches")
			matches = staleMatches
		}
	}

	// Additional time-window filter: date between now-12h and now+6h
	now := time.Now().UTC()
	filtered := make([]models.NormalizedMatch, 0, len(matches))
	for _, m := range matches {
		if m.BeginAt == nil {
			continue
		}
		t, err := time.Parse(time.RFC3339, *m.BeginAt)
		if err != nil {
			continue
		}
		if t.After(now.Add(-12*time.Hour)) && t.Before(now.Add(6*time.Hour)) {
			filtered = append(filtered, m)
		}
	}

	sortNormalizedMatchesAsc(filtered)

	if filtered == nil {
		filtered = []models.NormalizedMatch{}
	}

	setPublicCache(c, 60, 300)
	return c.JSON(http.StatusOK, filtered)
}

// GetUpcomingMatches returns upcoming matches.
func (h *MatchHandler) GetUpcomingMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	matches, err := h.readAndNormalizeMatches(ctx, cache.LiqMatchesUpcomingKey, wikis, "not_started")
	if err != nil {
		h.log.WithError(err).Warn("Error reading upcoming matches from cache")
	}
	if matches == nil {
		matches = []models.NormalizedMatch{}
	}

	sortNormalizedMatchesAsc(matches)

	setPublicCache(c, 300, 600)
	return c.JSON(http.StatusOK, matches)
}

// GetPastMatches returns finished matches.
func (h *MatchHandler) GetPastMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	matches, err := h.readAndNormalizeMatches(ctx, cache.LiqMatchesPastKey, wikis, "finished")
	if err != nil {
		h.log.WithError(err).Warn("Error reading past matches from cache")
	}
	if matches == nil {
		matches = []models.NormalizedMatch{}
	}

	sortNormalizedMatchesDesc(matches)

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, matches)
}

// GetMatchesByDate returns matches for a specific date.
// Cache-first from the poller caches inside their coverage window, on-demand fallback otherwise.
// Returns NormalizedMatch[] with status derived per match.
func (h *MatchHandler) GetMatchesByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	date := c.FormValue("date")
	if date == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "date parameter required"})
	}
	dateTime, err := time.Parse("2006-01-02", date)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid date format, expected YYYY-MM-DD"})
	}

	// Fix #17: Validate date is within ±1 year to prevent abuse
	now := time.Now().UTC()
	if dateTime.Before(now.AddDate(-1, 0, 0)) || dateTime.After(now.AddDate(1, 0, 0)) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "date must be within ±1 year"})
	}

	gameAcronym := c.FormValue("game")
	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)

	// The poller caches cover [J-7, +∞) for matches: matches_past holds the last
	// 7 days, matches_upcoming holds ALL future matches (date ASC, limit 5000),
	// matches_running covers now. So every date from J-7 onward is fully served
	// from Redis — calendar navigation must NEVER fan out to the API within this
	// window. The on-demand burst there (10 wikis × several dates) is exactly what
	// got the egress IP Cloudflare-banned (2026-07). Only genuinely deep-past dates
	// (older than J-7) fall through to a bounded on-demand fetch.
	inPollerWindow := !dateTime.Before(today.AddDate(0, 0, -7))

	var allMatches []models.NormalizedMatch
	globalSeen := make(map[string]bool)
	var fallbackWikis []string

	if inPollerWindow {
		// Cache-only (fresh→stale). A missing cache contributes nothing instead of
		// triggering an on-demand fetch, so a blocked or cold poller degrades to
		// stale-then-empty rather than amplifying into an API burst (the 2026-07
		// per-IP-throttle spiral).
		for _, w := range wikis {
			cached, ok := h.matchesForDateFromPollerCache(ctx, w, date)
			if !ok {
				continue
			}
			h.log.WithFields(logrus.Fields{"wiki": w, "date": date, "count": len(cached)}).Info("[BYDATE] served from poller cache")
			for _, m := range cached {
				if key := m.UniqueKey(); !globalSeen[key] {
					globalSeen[key] = true
					allMatches = append(allMatches, models.NormalizeLiqMatch(m, w, ""))
				}
			}
		}
	} else {
		// Deep past (older than J-7): held by no poller cache. On-demand fetch of
		// immutable data → cached 24h.
		fallbackWikis = wikis
	}

	nextDay := dateTime.Add(24 * time.Hour).Format("2006-01-02")
	conditions := fmt.Sprintf(
		"[[date::>%s 00:00:00]] AND [[date::<%s 00:00:00]]",
		date, nextDay,
	)

	// Out-of-window dates are always deep-past (immutable) → long cache.
	cacheTTL := services.TTLMatchesByDatePast

	type wikiResult struct {
		wiki    string
		matches []models.LiqMatch
		err     error
	}
	results := make(chan wikiResult, len(fallbackWikis))

	for _, wiki := range fallbackWikis {
		go func(w string) {
			cacheKey := cache.LiqMatchesByDateKey(w, date)
			params := url.Values{}
			params.Set("wiki", w)
			params.Set("conditions", conditions)
			params.Set("order", "date ASC")
			params.Set("limit", "5000")
			params.Set("rawstreams", "true")
			params.Set("streamurls", "true")
			params.Set("query", services.LiqMatchQueryFields)

			data, fetchErr := h.liqService.MakeRequest(ctx, w, "match", params, cacheKey, cacheTTL)
			if fetchErr != nil {
				results <- wikiResult{wiki: w, err: fetchErr}
				return
			}

			seen := make(map[string]bool)
			parsed, parseErr := parseAndFilterMatches(data, seen)
			results <- wikiResult{wiki: w, matches: parsed, err: parseErr}
		}(wiki)
	}

	for i := 0; i < len(fallbackWikis); i++ {
		select {
		case res := <-results:
			if res.err != nil {
				h.log.WithError(res.err).Warn("Error fetching matches by date for a wiki")
				continue
			}
			for _, m := range res.matches {
				key := m.UniqueKey()
				if !globalSeen[key] {
					globalSeen[key] = true
					allMatches = append(allMatches, models.NormalizeLiqMatch(m, res.wiki, ""))
				}
			}
		case <-ctx.Done():
			h.log.Warn("Context deadline exceeded in GetMatchesByDate")
			break
		}
	}

	if allMatches == nil {
		allMatches = []models.NormalizedMatch{}
	}

	sortNormalizedMatchesAsc(allMatches)

	return c.JSON(http.StatusOK, allMatches)
}

// GetMatch returns a single match by ID (on-demand, cache-aside).
// The ID param is the Liquipedia match2id, used in frontend URLs.
// Optional ?wiki= query parameter to target a specific wiki (faster).
// If wiki is omitted, uses a 3-step approach to minimise API calls:
//  1. Wiki hint from Redis (1 read, zero API calls)
//  2. Scan poller caches running/upcoming/past (Redis only)
//  3. On-demand fetch wiki-by-wiki (sequential, stops on first hit)
func (h *MatchHandler) GetMatch(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	matchID := c.Param("id")
	if matchID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "match id required"})
	}

	wikiParam := c.QueryParam("wiki")

	// If wiki is provided, search only that wiki
	if wikiParam != "" {
		wiki, ok := models.GameWikiMapping[wikiParam]
		if !ok {
			if _, exists := models.WikiToAcronym[wikiParam]; exists {
				wiki = wikiParam
			} else {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "unknown game/wiki: " + wikiParam})
			}
		}

		// Cache-first: serve from the poller cache with zero API calls. Avoids an
		// on-demand fetch (and its 429/budget failure mode) for already-cached matches.
		if m, found := h.findMatchInCache(ctx, wiki, matchID); found {
			_ = h.redisCache.Set(ctx, cache.LiqWikiHintKey(matchID), wiki, 24*time.Hour)
			setPublicCache(c, 60, 120)
			return c.JSON(http.StatusOK, *m)
		}

		normalized, err := h.fetchMatchFromWiki(ctx, wiki, matchID)
		if err != nil {
			if errors.Is(err, errMatchNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{"error": "match not found"})
			}
			// Transient upstream failure (429 backoff / budget / network / no stale) —
			// 503 lets the SSR page render the client for retry instead of hard-404ing
			// a valid match (SEO: don't de-index a real entity on a transient blip).
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "match temporarily unavailable"})
		}
		// Store wiki hint for future lookups
		_ = h.redisCache.Set(ctx, cache.LiqWikiHintKey(matchID), wiki, 24*time.Hour)
		setPublicCache(c, 60, 120)
		return c.JSON(http.StatusOK, normalized)
	}

	// --- No wiki provided — 3-step optimised lookup ---

	allWikis := getAllWikis()

	// Helper: search match in poller caches for a given wiki (zero API calls)
	findInCache := func(wiki string) (*models.NormalizedMatch, bool) {
		return h.findMatchInCache(ctx, wiki, matchID)
	}

	// Helper: on-demand fetch from Liquipedia for a given wiki (1 API call)
	fetchOnDemand := func(wiki string) (*models.NormalizedMatch, bool) {
		normalized, err := h.fetchMatchFromWiki(ctx, wiki, matchID)
		if err != nil || normalized == nil {
			return nil, false
		}
		return normalized, true
	}

	// Helper: return match + store wiki hint for future lookups
	returnMatch := func(m models.NormalizedMatch, wiki string) error {
		_ = h.redisCache.Set(ctx, cache.LiqWikiHintKey(matchID), wiki, 24*time.Hour)
		setPublicCache(c, 60, 120)
		return c.JSON(http.StatusOK, m)
	}

	// Step 1: Check wiki hint from Redis (avoids scanning all 10 wikis)
	if hintWiki, err := h.redisCache.Get(ctx, cache.LiqWikiHintKey(matchID)); err == nil && hintWiki != "" {
		if m, found := findInCache(hintWiki); found {
			return returnMatch(*m, hintWiki)
		}
		if m, found := fetchOnDemand(hintWiki); found {
			return returnMatch(*m, hintWiki)
		}
		// Hint was stale — fall through to full scan
	}

	// Step 2: Search all poller caches (no API calls, just Redis reads)
	for _, wiki := range allWikis {
		if m, found := findInCache(wiki); found {
			return returnMatch(*m, wiki)
		}
	}

	// Step 3: On-demand fetch by match2id (1 API call per wiki, stops on first hit).
	// A purely numeric ID can only be a pageid (already covered by the cache scan
	// above) or a legacy PandaScore ID — never a Liquipedia match2id, which is
	// alphanumeric. Skip the 10-wiki scan for numeric IDs to 404 fast and spare
	// the API budget on stale URLs still crawled by search engines.
	if _, numErr := strconv.Atoi(matchID); numErr != nil {
		for _, wiki := range allWikis {
			if m, found := fetchOnDemand(wiki); found {
				return returnMatch(*m, wiki)
			}
		}
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "match not found"})
}

// fetchMatchFromWiki fetches a single match by match2id from a specific wiki.
// match2id is the unique identifier for each match (e.g. "BAS26LCQD6_0001").
// Uses adaptive TTL: finished matches are cached for 24h, others for 5min.
func (h *MatchHandler) fetchMatchFromWiki(ctx context.Context, wiki string, matchID string) (*models.NormalizedMatch, error) {
	cacheKey := cache.LiqMatchKey(wiki, matchID)
	params := url.Values{}
	params.Set("wiki", wiki)
	params.Set("conditions", fmt.Sprintf("[[match2id::%s]]", matchID))
	params.Set("limit", "1")
	params.Set("rawstreams", "true")
	params.Set("streamurls", "true")

	data, err := h.liqService.MakeRequest(ctx, wiki, "match", params, cacheKey, services.TTLMatchDetail)
	if err != nil {
		h.log.WithError(err).WithFields(logrus.Fields{
			"wiki":    wiki,
			"matchID": matchID,
		}).Debug("Failed to fetch match detail from wiki")
		return nil, err
	}

	resp, err := services.ParseResponse(data)
	if err != nil || len(resp.Result) == 0 {
		return nil, fmt.Errorf("%w in wiki %s", errMatchNotFound, wiki)
	}

	var match models.LiqMatch
	if err := json.Unmarshal(resp.Result[0], &match); err != nil {
		return nil, fmt.Errorf("failed to parse match from wiki %s: %w", wiki, err)
	}

	// Adaptive TTL: extend cache duration for finished matches since they won't change
	if match.Finished == 1 {
		_ = h.redisCache.Set(ctx, cacheKey, string(data), services.TTLMatchDetailFinished)
		_ = h.redisCache.Set(ctx, cache.StaleKey(cacheKey), string(data), services.TTLMatchDetailFinished)
	}

	normalized := models.NormalizeLiqMatch(match, wiki, "")
	return &normalized, nil
}

// findMatchInCache looks up a match2id (or pageid) in the poller's running/
// upcoming/past caches for a wiki — zero API calls. Used cache-first before any
// on-demand fetch so cached matches serve instantly and don't burn API budget.
func (h *MatchHandler) findMatchInCache(ctx context.Context, wiki, matchID string) (*models.NormalizedMatch, bool) {
	for _, keyFunc := range []func(string) string{
		cache.LiqMatchesRunningKey,
		cache.LiqMatchesUpcomingKey,
		cache.LiqMatchesPastKey,
	} {
		data, err := h.redisCache.Get(ctx, keyFunc(wiki))
		if err != nil || data == "" {
			continue
		}
		matches, err := parseAndFilterMatches([]byte(data), nil)
		if err != nil {
			continue
		}
		for _, m := range matches {
			if m.Match2ID == matchID || fmt.Sprintf("%d", m.PageID) == matchID {
				normalized := models.NormalizeLiqMatch(m, wiki, "")
				return &normalized, true
			}
		}
	}
	return nil, false
}

// matchesForDateFromPollerCache reads the three poller caches of a wiki and
// returns the matches dated dateStr — zero Liquipedia call. Each key falls back
// to its :stale copy (TTLStale 6h) when the fresh one is gone, so by-date keeps
// serving last-known data through a poller block instead of the caller fanning
// out on-demand. ok=false only when both fresh and stale are absent.
func (h *MatchHandler) matchesForDateFromPollerCache(ctx context.Context, wiki, dateStr string) ([]models.LiqMatch, bool) {
	var all []models.LiqMatch
	for _, keyFunc := range []func(string) string{
		cache.LiqMatchesRunningKey,
		cache.LiqMatchesUpcomingKey,
		cache.LiqMatchesPastKey,
	} {
		data, err := h.redisCache.Get(ctx, keyFunc(wiki))
		if err != nil || data == "" {
			data, err = h.redisCache.Get(ctx, cache.StaleKey(keyFunc(wiki)))
			if err != nil || data == "" {
				return nil, false
			}
		}
		parsed, err := parseAndFilterMatches([]byte(data), nil)
		if err != nil {
			return nil, false
		}
		all = append(all, parsed...)
	}
	return filterLiqMatchesByDate(all, dateStr), true
}

// filterLiqMatchesByDate keeps matches whose UTC day equals dateStr (YYYY-MM-DD),
// deduplicated by UniqueKey — same day semantics as the on-demand condition
// [[date::>D 00:00:00]] AND [[date::<D+1 00:00:00]].
func filterLiqMatchesByDate(matches []models.LiqMatch, dateStr string) []models.LiqMatch {
	out := make([]models.LiqMatch, 0)
	seen := make(map[string]bool)
	for _, m := range matches {
		t, err := m.ParsedDate()
		if err != nil || t.UTC().Format("2006-01-02") != dateStr {
			continue
		}
		if key := m.UniqueKey(); !seen[key] {
			seen[key] = true
			out = append(out, m)
		}
	}
	return out
}

// --- Helpers ---

// resolveWikis returns the list of Liquipedia wiki names to query.
// If gameAcronym is empty, returns all wikis. Otherwise resolves the acronym.
func resolveWikis(gameAcronym string) ([]string, error) {
	if gameAcronym == "" {
		wikis := make([]string, 0, len(models.GameWikiMapping))
		for _, wiki := range models.GameWikiMapping {
			wikis = append(wikis, wiki)
		}
		return wikis, nil
	}
	wiki, ok := models.GameWikiMapping[gameAcronym]
	if !ok {
		return nil, fmt.Errorf("unknown game: %s", gameAcronym)
	}
	return []string{wiki}, nil
}

// readAndNormalizeMatches reads matches from Redis for one or more wikis,
// parses, deduplicates, filters for valid opponents, and normalizes to PandaMatch format.
func (h *MatchHandler) readAndNormalizeMatches(ctx context.Context, keyFunc func(string) string, wikis []string, statusHint string) ([]models.NormalizedMatch, error) {
	var allMatches []models.NormalizedMatch
	seen := make(map[string]bool)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, wiki := range wikis {
		wg.Add(1)
		go func(w string) {
			defer wg.Done()

			key := keyFunc(w)
			data, err := h.redisCache.Get(ctx, key)
			if err != nil || data == "" {
				// Le TTL du cache poller est plus court que son intervalle de refresh
				// réel quand les webhooks sont actifs (le filet de sécurité ne se
				// déclenche qu'à 3× l'intervalle). Sans ce repli, un wiki sans
				// webhook servait une liste vide pendant des dizaines de minutes par
				// heure, alors que la copie stale — 6h de TTL — était juste à côté.
				data, err = h.redisCache.Get(ctx, cache.StaleKey(key))
				if err != nil || data == "" {
					return
				}
			}

			parsed, err := parseAndFilterMatches([]byte(data), nil)
			if err != nil {
				h.log.WithFields(logrus.Fields{
					"wiki": w,
					"key":  key,
				}).WithError(err).Warn("Failed to parse cached matches")
				return
			}

			mu.Lock()
			for _, m := range parsed {
				k := m.UniqueKey()
				if !seen[k] {
					seen[k] = true
					allMatches = append(allMatches, models.NormalizeLiqMatch(m, w, statusHint))
				}
			}
			mu.Unlock()
		}(wiki)
	}

	wg.Wait()
	return allMatches, nil
}

// parseAndFilterMatches parses a raw Liquipedia API response into typed matches,
// applying dedup and opponent validation.
func parseAndFilterMatches(data []byte, seen map[string]bool) ([]models.LiqMatch, error) {
	resp, err := services.ParseResponse(data)
	if err != nil {
		return nil, err
	}

	matches := make([]models.LiqMatch, 0, len(resp.Result))
	for _, raw := range resp.Result {
		var m models.LiqMatch
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}

		// Dedup (if seen map provided)
		if seen != nil {
			key := m.UniqueKey()
			if seen[key] {
				continue
			}
			seen[key] = true
		}

		// Filter: must have 2 named opponents
		if !m.HasTwoNamedOpponents() {
			continue
		}

		matches = append(matches, m)
	}

	return matches, nil
}

// sortNormalizedMatchesAsc sorts normalized matches by begin_at ascending.
func sortNormalizedMatchesAsc(matches []models.NormalizedMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return compareBeginAt(matches[i].BeginAt, matches[j].BeginAt) < 0
	})
}

// sortNormalizedMatchesDesc sorts normalized matches by begin_at descending.
func sortNormalizedMatchesDesc(matches []models.NormalizedMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return compareBeginAt(matches[i].BeginAt, matches[j].BeginAt) > 0
	})
}

// compareBeginAt compares two *string begin_at values (ISO 8601).
// Returns -1, 0, or 1.
func compareBeginAt(a, b *string) int {
	if a == nil && b == nil {
		return 0
	}
	if a == nil {
		return 1
	}
	if b == nil {
		return -1
	}
	ta, _ := time.Parse(time.RFC3339, *a)
	tb, _ := time.Parse(time.RFC3339, *b)
	if ta.Before(tb) {
		return -1
	}
	if ta.After(tb) {
		return 1
	}
	return 0
}
