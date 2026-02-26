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

	// Try to find the tournament in all running/upcoming/finished caches first
	allWikis := getAllWikis()
	for _, wiki := range allWikis {
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
					return c.JSON(http.StatusOK, t)
				}
			}
		}
	}

	// Not found in cache — try on-demand fetch from all wikis
	for _, wiki := range allWikis {
		cacheKey := cache.LiqTournamentKey(wiki, decodedID)
		params := url.Values{}
		params.Set("conditions", fmt.Sprintf("[[pagename::%s]]", decodedID))
		params.Set("limit", "1")

		data, err := h.liqService.MakeRequest(ctx, wiki, "tournament", params, cacheKey, services.TTLTournamentDetail)
		if err != nil {
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
		return c.JSON(http.StatusOK, normalized)
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "tournament not found"})
}

// ListTournamentsByDate retrieves tournaments overlapping a specific date (on-demand, cache-aside).
func (h *TournamentHandler) ListTournamentsByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	date := c.FormValue("date")
	if date == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "date parameter required"})
	}
	_, err := time.Parse("2006-01-02", date)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid date format, expected YYYY-MM-DD"})
	}

	gameAcronym := c.FormValue("game")
	wikis, err := resolveWikis(gameAcronym)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Tournaments overlapping the given date: startdate <= date AND enddate >= date
	conditions := fmt.Sprintf(
		"[[startdate::<=%s]] AND [[enddate::>=%s]] AND [[status::!finished]]",
		date, date,
	)

	type wikiResult struct {
		tournaments []models.NormalizedTournament
		err         error
	}
	results := make(chan wikiResult, len(wikis))

	for _, wiki := range wikis {
		go func(w string) {
			cacheKey := fmt.Sprintf("liq:tournaments:date:%s:%s", w, date)
			params := url.Values{}
			params.Set("conditions", conditions)
			params.Set("order", "liquipediatier ASC, startdate ASC")
			params.Set("limit", "50")

			data, fetchErr := h.liqService.MakeRequest(ctx, w, "tournament", params, cacheKey, 10*time.Minute)
			if fetchErr != nil {
				results <- wikiResult{err: fetchErr}
				return
			}

			parsed, parseErr := parseTournaments(data, w)
			results <- wikiResult{tournaments: parsed, err: parseErr}
		}(wiki)
	}

	var allTournaments []models.NormalizedTournament
	globalSeen := make(map[string]bool)
	for i := 0; i < len(wikis); i++ {
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

	return c.JSON(http.StatusOK, tournaments)
}

// --- Helpers ---

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
				return
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
	limit := 20
	offset := 0

	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
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
