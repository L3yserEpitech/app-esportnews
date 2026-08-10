package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

// TournamentHandler handles tournament-related HTTP endpoints.
// List endpoints (running, upcoming, finished) read from Redis (populated by the poller).
// On-demand endpoints (by-date, by-id) call LiquipediaService.MakeRequest() directly.
type TournamentHandler struct {
	liqService *services.LiquipediaService
	redisCache *cache.RedisCache
	log        *logrus.Logger
}

func (h *TournamentHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/tournaments/filtered", h.FilterTournaments)
	g.GET("/tournaments/upcoming", h.ListAllUpcomingTournaments)
	g.GET("/tournaments/finished", h.ListAllFinishedTournaments)
	g.GET("/tournaments/all", h.ListAllTournaments)
	g.GET("/tournaments", h.ListTournaments)
	g.GET("/tournaments/:id", h.GetTournament)
	g.POST("/tournaments/by-date", h.ListTournamentsByDate)
}

// ListTournaments retrieves running tournaments with optional game filter, pagination, and sorting.
// Reads from Redis cache populated by the poller.
func (h *TournamentHandler) ListTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")
	sortParam := c.QueryParam("sort")
	limit, offset := parsePagination(c)

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	tournaments := h.readTournamentsFromCache(ctx, cache.LiqTournamentsRunningKey, wikis)

	sortNormalizedTournaments(tournaments, sortParam)
	tournaments = paginateTournaments(tournaments, limit, offset)

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, tournaments)
}

// ListAllTournaments retrieves all running tournaments (all games).
func (h *TournamentHandler) ListAllTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	sortParam := c.QueryParam("sort")

	allWikis := getAllWikis()
	tournaments := h.readTournamentsFromCache(ctx, cache.LiqTournamentsRunningKey, allWikis)

	sortNormalizedTournaments(tournaments, sortParam)

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, tournaments)
}

// ListAllUpcomingTournaments retrieves upcoming tournaments with optional game filter.
func (h *TournamentHandler) ListAllUpcomingTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")
	sortParam := c.QueryParam("sort")
	limit, offset := parsePagination(c)

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	tournaments := h.readTournamentsFromCache(ctx, cache.LiqTournamentsUpcomingKey, wikis)

	sortNormalizedTournaments(tournaments, sortParam)
	tournaments = paginateTournaments(tournaments, limit, offset)

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, tournaments)
}

// ListAllFinishedTournaments retrieves finished tournaments with optional game filter.
func (h *TournamentHandler) ListAllFinishedTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")
	sortParam := c.QueryParam("sort")
	limit, offset := parsePagination(c)

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	tournaments := h.readTournamentsFromCache(ctx, cache.LiqTournamentsFinishedKey, wikis)

	sortNormalizedTournaments(tournaments, sortParam)
	tournaments = paginateTournaments(tournaments, limit, offset)

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, tournaments)
}

// GetTournament retrieves a single tournament by ID (pagename).
// On-demand cache-aside: checks cache first, then fetches from Liquipedia.
func (h *TournamentHandler) GetTournament(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	tournamentID := c.Param("id")
	if tournamentID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tournament id required"})
	}

	// URL-decode the ID (page names can contain encoded slashes etc.)
	decodedID, err := url.PathUnescape(tournamentID)
	if err != nil {
		decodedID = tournamentID
	}

	// Helper: search tournament in poller caches for a given wiki
	findInCache := func(wiki string) (*models.NormalizedTournament, bool) {
		for _, keyFunc := range []func(string) string{
			cache.LiqTournamentsRunningKey,
			cache.LiqTournamentsUpcomingKey,
			cache.LiqTournamentsFinishedKey,
		} {
			data, err := h.redisCache.Get(ctx, keyFunc(wiki))
			if err != nil || data == "" {
				continue
			}
			tournaments, err := parseTournaments([]byte(data), wiki)
			if err != nil {
				continue
			}
			for _, t := range tournaments {
				if t.PageName == decodedID || t.Slug == decodedID || fmt.Sprintf("%d", t.ID) == decodedID {
					return &t, true
				}
			}
		}
		return nil, false
	}

	// Helper: on-demand fetch from Liquipedia for a given wiki. transient=true
	// when at least one upstream call failed (429 backoff, budget, network) —
	// the tournament may exist but be temporarily unreachable.
	fetchOnDemandDetailed := func(wiki string) (t *models.NormalizedTournament, found bool, transient bool) {
		_, isNumeric := strconv.Atoi(decodedID)
		conditions := []string{fmt.Sprintf("[[pagename::%s]]", decodedID)}
		if isNumeric == nil {
			conditions = []string{fmt.Sprintf("[[pageid::%s]]", decodedID), fmt.Sprintf("[[pagename::%s]]", decodedID)}
		}
		for _, condition := range conditions {
			cacheKey := cache.LiqTournamentKey(wiki, decodedID)
			params := url.Values{}
			params.Set("conditions", condition)
			params.Set("limit", "1")

			data, err := h.liqService.MakeRequest(ctx, wiki, "tournament", params, cacheKey, services.TTLTournamentDetail)
			if err != nil {
				transient = true
				continue
			}
			resp, err := services.ParseResponse(data)
			if err != nil || len(resp.Result) == 0 {
				continue
			}
			var liqT models.LiqTournament
			if err := json.Unmarshal(resp.Result[0], &liqT); err != nil {
				continue
			}
			normalized := models.NormalizeLiqTournament(liqT, wiki)
			return &normalized, true, false
		}
		return nil, false, transient
	}
	fetchOnDemand := func(wiki string) (*models.NormalizedTournament, bool) {
		t, found, _ := fetchOnDemandDetailed(wiki)
		return t, found
	}

	// Helper: return enriched tournament + store wiki hint for future lookups
	returnTournament := func(t models.NormalizedTournament, wiki string) error {
		// Cache wiki hint so future requests skip the all-wiki scan (24h TTL)
		_ = h.redisCache.Set(ctx, cache.LiqWikiHintKey(decodedID), wiki, 24*time.Hour)
		// Also store by numeric ID if available
		if idStr := fmt.Sprintf("%d", t.ID); idStr != decodedID && t.ID > 0 {
			_ = h.redisCache.Set(ctx, cache.LiqWikiHintKey(idStr), wiki, 24*time.Hour)
		}
		enriched := h.enrichTournamentWithMatches(ctx, t, wiki)
		setPublicCache(c, 300, 600)
		return c.JSON(http.StatusOK, enriched)
	}

	// Wiki-scoped path (game-first URLs /<slug>/tournois/<id>): cache-first,
	// then a single on-demand fetch — no 10-wiki scan, no cross-wiki budget cost.
	if wikiParam := c.QueryParam("wiki"); wikiParam != "" {
		wiki, ok := models.GameWikiMapping[wikiParam]
		if !ok {
			if _, exists := models.WikiToAcronym[wikiParam]; exists {
				wiki = wikiParam
			} else {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "unknown game/wiki: " + wikiParam})
			}
		}
		if t, found := findInCache(wiki); found {
			return returnTournament(*t, wiki)
		}
		t, found, transient := fetchOnDemandDetailed(wiki)
		if found {
			return returnTournament(*t, wiki)
		}
		if transient {
			// 503 (not 404) so a valid tournament isn't de-indexed on a 429 blip.
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "tournament temporarily unavailable"})
		}
		return c.JSON(http.StatusNotFound, map[string]string{"error": "tournament not found"})
	}

	allWikis := getAllWikis()

	// Step 1: Check wiki hint from Redis (avoids scanning all 10 wikis)
	if hintWiki, err := h.redisCache.Get(ctx, cache.LiqWikiHintKey(decodedID)); err == nil && hintWiki != "" {
		if t, found := findInCache(hintWiki); found {
			return returnTournament(*t, hintWiki)
		}
		if t, found := fetchOnDemand(hintWiki); found {
			return returnTournament(*t, hintWiki)
		}
		// Hint was stale — fall through to full scan
	}

	// Step 2: Search all poller caches (no API calls, just Redis reads)
	for _, wiki := range allWikis {
		if t, found := findInCache(wiki); found {
			return returnTournament(*t, wiki)
		}
	}

	// Step 3: On-demand fetch — try each wiki (costs 1-2 API calls per wiki)
	for _, wiki := range allWikis {
		if t, found := fetchOnDemand(wiki); found {
			return returnTournament(*t, wiki)
		}
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "tournament not found"})
}

// ListTournamentsByDate retrieves tournaments overlapping a specific date.
// Cache-first from the poller caches inside their coverage window, on-demand fallback otherwise.
func (h *TournamentHandler) ListTournamentsByDate(c echo.Context) error {
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

	// The poller caches cover [J-30, +∞) for tournaments: tournaments_finished
	// holds the last 30 days, tournaments_upcoming holds ALL future (startdate ASC,
	// limit 5000), tournaments_running covers active-now (incl. long events ending
	// in the future). So every date from J-30 onward is fully served from Redis —
	// calendar navigation must NEVER fan out within it (the on-demand burst caused
	// the 2026-07 IP ban). Only pre-J-30 dates fall through to on-demand.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	inPollerWindow := !dateTime.Before(today.AddDate(0, 0, -30))

	var allTournaments []models.NormalizedTournament
	globalSeen := make(map[string]bool)
	var fallbackWikis []string

	if inPollerWindow {
		// Cache-only (fresh→stale): a missing cache contributes nothing instead of
		// fanning out, so a blocked or cold poller degrades gracefully.
		for _, w := range wikis {
			cached, ok := h.tournamentsForDateFromPollerCache(ctx, w, date)
			if !ok {
				continue
			}
			h.log.WithFields(logrus.Fields{"wiki": w, "date": date, "count": len(cached)}).Info("[BYDATE] served from poller cache")
			for _, t := range cached {
				if !globalSeen[t.PageName] {
					globalSeen[t.PageName] = true
					allTournaments = append(allTournaments, t)
				}
			}
		}
	} else {
		// Deep past (older than J-30): on-demand, immutable → cached 24h.
		fallbackWikis = wikis
	}

	// Tournaments overlapping the given date: startdate < date+1 AND enddate > date-1
	// Liquipedia API doesn't support <= and >= operators
	nextDay := dateTime.Add(24 * time.Hour).Format("2006-01-02")
	prevDay := dateTime.Add(-24 * time.Hour).Format("2006-01-02")
	conditions := fmt.Sprintf(
		"[[startdate::<%s]] AND [[enddate::>%s]] AND [[status::!finished]]",
		nextDay, prevDay,
	)

	type wikiResult struct {
		tournaments []models.NormalizedTournament
		err         error
	}
	results := make(chan wikiResult, len(fallbackWikis))

	for _, wiki := range fallbackWikis {
		go func(w string) {
			cacheKey := cache.LiqTournamentsByDateKey(w, date)
			params := url.Values{}
			params.Set("conditions", conditions)
			params.Set("order", "liquipediatier ASC, startdate ASC")
			params.Set("limit", "5000")
			params.Set("query", services.LiqTournamentQueryFields)

			data, fetchErr := h.liqService.MakeRequest(ctx, w, "tournament", params, cacheKey, services.TTLTournamentsByDatePast)
			if fetchErr != nil {
				results <- wikiResult{err: fetchErr}
				return
			}

			parsed, parseErr := parseTournaments(data, w)
			results <- wikiResult{tournaments: parsed, err: parseErr}
		}(wiki)
	}

	for i := 0; i < len(fallbackWikis); i++ {
		res := <-results
		if res.err != nil {
			h.log.WithError(res.err).Warn("Error fetching tournaments by date for a wiki")
			continue
		}
		for _, t := range res.tournaments {
			key := t.PageName
			if !globalSeen[key] {
				globalSeen[key] = true
				allTournaments = append(allTournaments, t)
			}
		}
	}

	if allTournaments == nil {
		allTournaments = []models.NormalizedTournament{}
	}

	sortNormalizedTournaments(allTournaments, "tier")

	return c.JSON(http.StatusOK, allTournaments)
}

// FilterTournaments retrieves tournaments with multiple filters (game, status, tier).
// Reads from poller-populated Redis cache and filters in-memory.
func (h *TournamentHandler) FilterTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")
	status := c.QueryParam("status")
	tierFilter := c.QueryParam("filter[tier]")

	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Determine which cache to read from based on status
	var keyFunc func(string) string
	switch status {
	case "upcoming":
		keyFunc = cache.LiqTournamentsUpcomingKey
	case "finished":
		keyFunc = cache.LiqTournamentsFinishedKey
	default:
		// running or unspecified
		keyFunc = cache.LiqTournamentsRunningKey
	}

	tournaments := h.readTournamentsFromCache(ctx, keyFunc, wikis)

	// Apply tier filter in-memory
	if tierFilter != "" {
		tiers := strings.Split(tierFilter, ",")
		tierSet := make(map[string]bool)
		for _, t := range tiers {
			tierSet[strings.TrimSpace(t)] = true
		}

		filtered := make([]models.NormalizedTournament, 0)
		for _, t := range tournaments {
			if tierSet[t.Tier] {
				filtered = append(filtered, t)
			}
		}
		tournaments = filtered
	}

	sortNormalizedTournaments(tournaments, "tier")

	setPublicCache(c, 600, 1200)
	return c.JSON(http.StatusOK, tournaments)
}

// --- Helpers ---

// enrichTournamentWithMatches fetches all matches for a tournament from Liquipedia,
// extracts teams from match opponents, and returns an enriched detail response.
// Unlike the list endpoints, this does NOT filter by HasTwoNamedOpponents because
// tournament brackets often contain TBD/upcoming match slots.
func (h *TournamentHandler) enrichTournamentWithMatches(ctx context.Context, tournament models.NormalizedTournament, wiki string) models.EnrichedTournamentDetail {
	cacheKey := cache.LiqTournamentMatchesKey(wiki, tournament.PageName)
	params := url.Values{}
	// Use [[parent::PageName]] because the match's "tournament" field is a display name,
	// while "parent" contains the actual pagename matching the tournament's pagename.
	condition := fmt.Sprintf("[[parent::%s]]", tournament.PageName)
	params.Set("conditions", condition)
	params.Set("order", "date ASC")
	params.Set("limit", "5000")
	params.Set("rawstreams", "true")
	params.Set("streamurls", "true")

	h.log.WithFields(logrus.Fields{
		"wiki":      wiki,
		"pagename":  tournament.PageName,
		"condition": condition,
	}).Info("Enriching tournament with matches")

	var matches []models.NormalizedMatch

	data, err := h.liqService.MakeRequest(ctx, wiki, "match", params, cacheKey, services.TTLTournamentDetail)
	if err != nil {
		h.log.WithError(err).WithFields(logrus.Fields{
			"wiki":       wiki,
			"tournament": tournament.PageName,
		}).Warn("Failed to fetch tournament matches")
		matches = []models.NormalizedMatch{}
	} else {
		// Parse all matches without opponent filter (tournament detail shows all matches)
		resp, parseErr := services.ParseResponse(data)
		if parseErr != nil {
			h.log.WithError(parseErr).Warn("Failed to parse tournament matches response")
			matches = []models.NormalizedMatch{}
		} else {
			h.log.WithFields(logrus.Fields{
				"wiki":       wiki,
				"tournament": tournament.PageName,
				"rawCount":   len(resp.Result),
			}).Info("Tournament matches API response")

			seen := make(map[string]bool)
			for _, raw := range resp.Result {
				var m models.LiqMatch
				if err := json.Unmarshal(raw, &m); err != nil {
					continue
				}
				key := m.UniqueKey()
				if seen[key] {
					continue
				}
				seen[key] = true
				matches = append(matches, models.NormalizeLiqMatch(m, wiki, ""))
			}
		}
	}

	if matches == nil {
		matches = []models.NormalizedMatch{}
	}

	// Filter out stale TBD matches: past/invalid date + no real opponents (0-0 placeholders)
	now := time.Now().UTC()
	filtered := make([]models.NormalizedMatch, 0, len(matches))
	for _, m := range matches {
		// Check if match has no real opponents (TBD vs TBD or empty)
		hasOpponents := false
		for _, opp := range m.Opponents {
			if opp.Opponent != nil && opp.Opponent.Name != "" && !strings.EqualFold(opp.Opponent.Name, "tbd") {
				hasOpponents = true
				break
			}
		}

		// If opponents are set, always keep the match
		if hasOpponents {
			filtered = append(filtered, m)
			continue
		}

		// No real opponents — check if the date is valid and in the future
		matchTime := time.Time{}
		if m.BeginAt != nil {
			if t, err := time.Parse(time.RFC3339, *m.BeginAt); err == nil {
				matchTime = t
			}
		} else if m.ScheduledAt != nil {
			if t, err := time.Parse(time.RFC3339, *m.ScheduledAt); err == nil {
				matchTime = t
			}
		}

		// Keep TBD matches only if date is valid (year >= 2000) and in the future
		if !matchTime.IsZero() && matchTime.Year() >= 2000 && matchTime.After(now) {
			filtered = append(filtered, m)
		}
	}
	matches = filtered

	teams, rosters := models.ExtractTeamsAndRostersFromMatches(matches)

	// Collect unique team names (pagenames) for batch squad fetch
	var teamNames []string
	nameSeen := make(map[string]bool)
	for _, roster := range rosters {
		if roster.Team != nil && roster.Team.Name != "" {
			if !nameSeen[roster.Team.Name] {
				nameSeen[roster.Team.Name] = true
				teamNames = append(teamNames, roster.Team.Name)
			}
		}
	}

	// Batch fetch squad players for all teams in 1 API call
	if len(teamNames) > 0 {
		squadCacheKey := cache.LiqTournamentSquadsKey(wiki, tournament.PageName)
		playersByTeam := h.liqService.FetchBatchSquadPlayers(ctx, wiki, teamNames, squadCacheKey, services.TTLTournamentDetail)

		// Attach players to their roster entries (match by lowercase team name = pagename)
		for i, roster := range rosters {
			if roster.Team == nil {
				continue
			}
			key := strings.ToLower(roster.Team.Name)
			if players, ok := playersByTeam[key]; ok && len(players) > 0 {
				rosters[i].Players = players
			}
		}

		h.log.WithFields(logrus.Fields{
			"wiki":       wiki,
			"tournament": tournament.PageName,
			"teamNames":  len(teamNames),
			"teamsFound": len(playersByTeam),
		}).Info("Batch squad fetch complete")
	}

	h.log.WithFields(logrus.Fields{
		"wiki":       wiki,
		"tournament": tournament.PageName,
		"matches":    len(matches),
		"teams":      len(teams),
		"rosters":    len(rosters),
	}).Info("Tournament enrichment complete")

	return models.EnrichedTournamentDetail{
		NormalizedTournament: tournament,
		Matches:              matches,
		Teams:                teams,
		ExpectedRoster:       rosters,
	}
}

// tournamentsForDateFromPollerCache reads the three poller caches of a wiki and
// returns the tournaments active on dateStr — zero Liquipedia call. Each key
// falls back to its :stale copy (TTLStale 6h) when the fresh one is gone, so
// by-date keeps serving through a poller block instead of fanning out on-demand.
// ok=false only when both fresh and stale are absent.
func (h *TournamentHandler) tournamentsForDateFromPollerCache(ctx context.Context, wiki, dateStr string) ([]models.NormalizedTournament, bool) {
	var all []models.NormalizedTournament
	for _, keyFunc := range []func(string) string{
		cache.LiqTournamentsRunningKey,
		cache.LiqTournamentsUpcomingKey,
		cache.LiqTournamentsFinishedKey,
	} {
		data, err := h.redisCache.Get(ctx, keyFunc(wiki))
		if err != nil || data == "" {
			data, err = h.redisCache.Get(ctx, cache.StaleKey(keyFunc(wiki)))
			if err != nil || data == "" {
				return nil, false
			}
		}
		parsed, err := parseTournaments([]byte(data), wiki)
		if err != nil {
			return nil, false
		}
		all = append(all, parsed...)
	}
	return filterTournamentsActiveOn(all, dateStr), true
}

// filterTournamentsActiveOn keeps tournaments active on dateStr (startdate <= D <= enddate),
// deduplicated by pagename — same overlap semantics as the on-demand condition
// [[startdate::<D+1]] AND [[enddate::>D-1]].
func filterTournamentsActiveOn(tournaments []models.NormalizedTournament, dateStr string) []models.NormalizedTournament {
	out := make([]models.NormalizedTournament, 0)
	seen := make(map[string]bool)
	for _, t := range tournaments {
		if t.BeginAt == nil || t.EndAt == nil || len(*t.BeginAt) < 10 || len(*t.EndAt) < 10 {
			continue
		}
		// BeginAt/EndAt are "YYYY-MM-DDT00:00:00Z" — lexicographic compare on the date prefix
		if (*t.BeginAt)[:10] > dateStr || (*t.EndAt)[:10] < dateStr {
			continue
		}
		if !seen[t.PageName] {
			seen[t.PageName] = true
			out = append(out, t)
		}
	}
	return out
}

// readTournamentsFromCache reads tournaments from Redis for one or more wikis,
// parses and normalizes them, and deduplicates.
func (h *TournamentHandler) readTournamentsFromCache(ctx context.Context, keyFunc func(string) string, wikis []string) []models.NormalizedTournament {
	var allTournaments []models.NormalizedTournament
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

			parsed, err := parseTournaments([]byte(data), w)
			if err != nil {
				h.log.WithFields(logrus.Fields{
					"wiki": w,
					"key":  key,
				}).WithError(err).Warn("Failed to parse cached tournaments")
				return
			}

			mu.Lock()
			for _, t := range parsed {
				k := t.PageName
				if k == "" {
					k = t.Slug
				}
				if !seen[k] {
					seen[k] = true
					allTournaments = append(allTournaments, t)
				}
			}
			mu.Unlock()
		}(wiki)
	}

	wg.Wait()

	if allTournaments == nil {
		return []models.NormalizedTournament{}
	}

	return allTournaments
}

// parseTournaments parses a raw Liquipedia API response into normalized tournaments.
func parseTournaments(data []byte, wiki string) ([]models.NormalizedTournament, error) {
	resp, err := services.ParseResponse(data)
	if err != nil {
		return nil, err
	}

	var liqTournaments []models.LiqTournament
	for _, raw := range resp.Result {
		var t models.LiqTournament
		if err := json.Unmarshal(raw, &t); err != nil {
			continue
		}
		liqTournaments = append(liqTournaments, t)
	}

	return models.NormalizeLiqTournaments(liqTournaments, wiki), nil
}

// parsePagination extracts limit and offset from query parameters.
func parsePagination(c echo.Context) (int, int) {
	limit := 5000
	offset := 0

	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	if o := c.QueryParam("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	return limit, offset
}

// paginateTournaments applies limit/offset pagination to a slice.
func paginateTournaments(tournaments []models.NormalizedTournament, limit, offset int) []models.NormalizedTournament {
	if offset >= len(tournaments) {
		return []models.NormalizedTournament{}
	}

	end := offset + limit
	if end > len(tournaments) {
		end = len(tournaments)
	}

	return tournaments[offset:end]
}

// sortNormalizedTournaments sorts tournaments based on the sort parameter.
func sortNormalizedTournaments(tournaments []models.NormalizedTournament, sortParam string) {
	if sortParam == "" {
		return
	}

	descending := false
	field := sortParam
	if len(sortParam) > 0 && sortParam[0] == '-' {
		descending = true
		field = sortParam[1:]
	}

	sort.Slice(tournaments, func(i, j int) bool {
		var less bool
		switch field {
		case "tier":
			tierOrder := map[string]int{"s": 0, "a": 1, "b": 2, "c": 3, "d": 4}
			tierI := tierOrder["d"]
			tierJ := tierOrder["d"]
			if val, ok := tierOrder[tournaments[i].Tier]; ok {
				tierI = val
			}
			if val, ok := tierOrder[tournaments[j].Tier]; ok {
				tierJ = val
			}
			less = tierI < tierJ
		case "begin_at":
			var timeI, timeJ time.Time
			if tournaments[i].BeginAt != nil {
				timeI, _ = time.Parse(time.RFC3339, *tournaments[i].BeginAt)
			}
			if tournaments[j].BeginAt != nil {
				timeJ, _ = time.Parse(time.RFC3339, *tournaments[j].BeginAt)
			}
			less = timeI.Before(timeJ)
		default:
			return false
		}
		if descending {
			return !less
		}
		return less
	})
}

// getAllWikis returns all known wiki names.
func getAllWikis() []string {
	wikis := make([]string, 0, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		wikis = append(wikis, wiki)
	}
	return wikis
}
