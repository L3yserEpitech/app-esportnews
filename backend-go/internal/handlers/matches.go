package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

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

	return c.JSON(http.StatusOK, matches)
}

// GetMatchesByDate returns matches for a specific date (on-demand, cache-aside).
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

	gameAcronym := c.FormValue("game")
	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	nextDay := dateTime.Add(24 * time.Hour).Format("2006-01-02")
	conditions := fmt.Sprintf(
		"[[date::>%s 00:00:00]] AND [[date::<%s 00:00:00]]",
		date, nextDay,
	)

	type wikiResult struct {
		wiki    string
		matches []models.LiqMatch
		err     error
	}
	results := make(chan wikiResult, len(wikis))

	for _, wiki := range wikis {
		go func(w string) {
			cacheKey := cache.LiqMatchesByDateKey(w, date)
			params := url.Values{}
			params.Set("wiki", w)
			params.Set("conditions", conditions)
			params.Set("order", "date ASC")
			params.Set("limit", "5000")
			params.Set("rawstreams", "true")
			params.Set("streamurls", "true")

			data, fetchErr := h.liqService.MakeRequest(ctx, w, "match", params, cacheKey, 10*time.Minute)
			if fetchErr != nil {
				results <- wikiResult{wiki: w, err: fetchErr}
				return
			}

			seen := make(map[string]bool)
			parsed, parseErr := parseAndFilterMatches(data, seen)
			results <- wikiResult{wiki: w, matches: parsed, err: parseErr}
		}(wiki)
	}

	var allMatches []models.NormalizedMatch
	globalSeen := make(map[string]bool)
	for i := 0; i < len(wikis); i++ {
		res := <-results
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
	}

	if allMatches == nil {
		allMatches = []models.NormalizedMatch{}
	}

	sortNormalizedMatchesAsc(allMatches)

	return c.JSON(http.StatusOK, allMatches)
}

// GetMatch returns a single match by ID (on-demand, cache-aside).
// The ID param is the Liquipedia PageID (integer), used in frontend URLs.
// Optional ?wiki= query parameter to target a specific wiki (faster).
// If wiki is omitted, searches all wikis in parallel.
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

		normalized, err := h.fetchMatchFromWiki(ctx, wiki, matchID)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "match not found"})
		}
		return c.JSON(http.StatusOK, normalized)
	}

	// No wiki provided — search all wikis in parallel
	type wikiMatchResult struct {
		wiki       string
		normalized *models.NormalizedMatch
	}

	allWikis := make([]string, 0, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		allWikis = append(allWikis, wiki)
	}

	results := make(chan wikiMatchResult, len(allWikis))
	for _, wiki := range allWikis {
		go func(w string) {
			normalized, err := h.fetchMatchFromWiki(ctx, w, matchID)
			if err != nil || normalized == nil {
				results <- wikiMatchResult{wiki: w, normalized: nil}
				return
			}
			results <- wikiMatchResult{wiki: w, normalized: normalized}
		}(wiki)
	}

	for i := 0; i < len(allWikis); i++ {
		res := <-results
		if res.normalized != nil {
			return c.JSON(http.StatusOK, res.normalized)
		}
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "match not found"})
}

// fetchMatchFromWiki fetches a single match by PageID from a specific wiki.
func (h *MatchHandler) fetchMatchFromWiki(ctx context.Context, wiki string, matchID string) (*models.NormalizedMatch, error) {
	cacheKey := cache.LiqMatchKey(wiki, matchID)
	params := url.Values{}
	params.Set("wiki", wiki)
	params.Set("conditions", fmt.Sprintf("[[pageid::%s]]", matchID))
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
		return nil, fmt.Errorf("match not found in wiki %s", wiki)
	}

	var match models.LiqMatch
	if err := json.Unmarshal(resp.Result[0], &match); err != nil {
		return nil, fmt.Errorf("failed to parse match from wiki %s: %w", wiki, err)
	}

	normalized := models.NormalizeLiqMatch(match, wiki, "")
	return &normalized, nil
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
				return
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
