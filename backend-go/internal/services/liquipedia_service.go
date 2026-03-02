package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

const (
	liquipediaBaseURL = "https://api.liquipedia.net/api/v3"
	liquipediaUA      = "EsportNews/1.0 (contact@esportnews.fr)"

	// Budget: 60 requests per wiki per hour
	budgetLimitPerWiki = 60
)

// Cache TTLs — aligned with polling intervals (TTL > poll interval)
const (
	TTLMatchesRunning      = 3 * time.Minute
	TTLMatchesUpcoming     = 15 * time.Minute
	TTLMatchesPast         = 20 * time.Minute
	TTLTournamentsRunning  = 15 * time.Minute
	TTLTournamentsUpcoming = 20 * time.Minute
	TTLTournamentsFinished = 1 * time.Hour
	TTLMatchDetail         = 5 * time.Minute
	TTLTournamentDetail    = 10 * time.Minute
	TTLTeam                = 30 * time.Minute
	TTLStale               = 1 * time.Hour // stale-while-revalidate fallback
)

// RequestBudget tracks API usage per wiki (game) to enforce the 60 req/hour limit.
type RequestBudget struct {
	Wiki    string
	Used    int
	Limit   int
	ResetAt time.Time
	mu      sync.Mutex
}

// CanMakeRequest checks if there's budget remaining for this wiki.
func (b *RequestBudget) CanMakeRequest() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeReset()
	return b.Used < b.Limit
}

// RecordRequest increments the usage counter.
func (b *RequestBudget) RecordRequest() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeReset()
	b.Used++
}

// Status returns a snapshot of the budget state (for monitoring endpoint).
func (b *RequestBudget) Status() map[string]interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeReset()
	return map[string]interface{}{
		"wiki":      b.Wiki,
		"used":      b.Used,
		"limit":     b.Limit,
		"remaining": b.Limit - b.Used,
		"resets_at": b.ResetAt.Format(time.RFC3339),
	}
}

// maybeReset resets the counter if the hour has elapsed. Must be called with lock held.
func (b *RequestBudget) maybeReset() {
	if time.Now().After(b.ResetAt) {
		b.Used = 0
		b.ResetAt = time.Now().Truncate(time.Hour).Add(time.Hour)
	}
}

// LiquipediaService is the core HTTP client for the Liquipedia API v3.
type LiquipediaService struct {
	apiKey     string
	cache      *cache.RedisCache
	httpClient *http.Client
	budgets    map[string]*RequestBudget // keyed by wiki name
	log        *logrus.Logger
	mu         sync.RWMutex
}

// NewLiquipediaService creates the service with budget trackers for all known wikis.
func NewLiquipediaService(apiKey string, redisCache *cache.RedisCache, logger *logrus.Logger) *LiquipediaService {
	budgets := make(map[string]*RequestBudget, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		budgets[wiki] = &RequestBudget{
			Wiki:    wiki,
			Limit:   budgetLimitPerWiki,
			ResetAt: time.Now().Truncate(time.Hour).Add(time.Hour),
		}
	}

	return &LiquipediaService{
		apiKey: apiKey,
		cache:  redisCache,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		budgets: budgets,
		log:     logger,
	}
}

// MakeRequest performs a cached, budget-aware GET to the Liquipedia API.
// It handles: cache lookup → budget check → HTTP request → cache store + stale copy.
// wiki: the Liquipedia wiki name (e.g. "valorant")
// endpoint: the API path after the wiki (e.g. "match")
// params: query parameters (conditions, limit, etc.)
// cacheKey: Redis key for this data
// cacheTTL: how long to cache the fresh data
func (s *LiquipediaService) MakeRequest(ctx context.Context, wiki, endpoint string, params url.Values, cacheKey string, cacheTTL time.Duration) ([]byte, error) {
	// 1. Check fresh cache
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		return []byte(cached), nil
	}

	// 2. Check budget
	budget := s.getBudget(wiki)
	if budget == nil {
		return nil, fmt.Errorf("unknown wiki: %s", wiki)
	}

	if !budget.CanMakeRequest() {
		// Budget exhausted — try stale cache
		s.log.WithFields(logrus.Fields{
			"wiki":  wiki,
			"key":   cacheKey,
		}).Warn("Budget exhausted, attempting stale cache")
		return s.getStaleOrError(ctx, cacheKey, wiki)
	}

	// 3. Build URL — Liquipedia API v3 uses /v3/{endpoint}?wiki={wiki}
	if params == nil {
		params = url.Values{}
	}
	params.Set("wiki", wiki)
	reqURL := fmt.Sprintf("%s/%s?%s", liquipediaBaseURL, endpoint, params.Encode())

	// 4. Build HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Apikey "+s.apiKey)
	req.Header.Set("User-Agent", liquipediaUA)
	req.Header.Set("Accept", "application/json")

	// 5. Execute
	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Network error — try stale
		s.log.WithError(err).WithField("wiki", wiki).Error("HTTP request failed")
		return s.getStaleOrError(ctx, cacheKey, wiki)
	}
	defer resp.Body.Close()

	// 6. Handle rate limit (429)
	if resp.StatusCode == http.StatusTooManyRequests {
		s.log.WithField("wiki", wiki).Warn("Rate limited by Liquipedia (429)")
		budget.RecordRequest() // still count it
		return s.getStaleOrError(ctx, cacheKey, wiki)
	}

	// 7. Handle other errors
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		s.log.WithFields(logrus.Fields{
			"wiki":   wiki,
			"status": resp.StatusCode,
			"body":   string(body),
		}).Error("Liquipedia API error")
		return s.getStaleOrError(ctx, cacheKey, wiki)
	}

	// 8. Read body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	// 9. Record the request in the budget
	budget.RecordRequest()

	// 10. Store in cache (fresh + stale copy)
	_ = s.cache.Set(ctx, cacheKey, string(body), cacheTTL)
	_ = s.cache.Set(ctx, cache.StaleKey(cacheKey), string(body), TTLStale)

	s.log.WithFields(logrus.Fields{
		"wiki":     wiki,
		"endpoint": endpoint,
		"key":      cacheKey,
		"ttl":      cacheTTL.String(),
	}).Debug("Liquipedia API request successful")

	return body, nil
}

// getStaleOrError returns stale cached data, or an error if none available.
func (s *LiquipediaService) getStaleOrError(ctx context.Context, cacheKey, wiki string) ([]byte, error) {
	stale, err := s.cache.Get(ctx, cache.StaleKey(cacheKey))
	if err == nil && stale != "" {
		s.log.WithFields(logrus.Fields{
			"wiki": wiki,
			"key":  cacheKey,
		}).Info("Returning stale data")
		return []byte(stale), nil
	}
	return nil, fmt.Errorf("no data available for %s (budget exhausted, no stale cache)", wiki)
}

// getBudget returns the budget tracker for a wiki.
func (s *LiquipediaService) getBudget(wiki string) *RequestBudget {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.budgets[wiki]
}

// MapAcronymToWiki converts an internal game acronym to the Liquipedia wiki name.
func (s *LiquipediaService) MapAcronymToWiki(acronym string) (string, bool) {
	wiki, ok := models.GameWikiMapping[acronym]
	return wiki, ok
}

// GetBudgetStatus returns the current budget state for all wikis (for /admin/api-budget).
func (s *LiquipediaService) GetBudgetStatus() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	wikiBudgets := make(map[string]interface{}, len(s.budgets))
	totalUsed := 0
	totalLimit := 0

	for wiki, budget := range s.budgets {
		status := budget.Status()
		wikiBudgets[wiki] = status
		totalUsed += status["used"].(int)
		totalLimit += status["limit"].(int)
	}

	return map[string]interface{}{
		"budgets":     wikiBudgets,
		"total_used":  totalUsed,
		"total_limit": totalLimit,
	}
}

// ParseResponse parses a raw Liquipedia API response into the generic wrapper.
func ParseResponse(data []byte) (*models.LiquipediaResponse, error) {
	var resp models.LiquipediaResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parsing Liquipedia response: %w", err)
	}
	return &resp, nil
}

// GetCache returns the Redis cache (needed by the poller to write directly).
func (s *LiquipediaService) GetCache() *cache.RedisCache {
	return s.cache
}

// TTLTeamSearch is the cache TTL for team search results.
const TTLTeamSearch = 30 * time.Minute

// SearchTeams searches teams across all wikis matching the query string.
// Since Liquipedia doesn't support partial text search, we fetch active teams
// and filter client-side (in Go) by name containing the query.
func (s *LiquipediaService) SearchTeams(ctx context.Context, query string, pageSize int) ([]models.NormalizedTeam, error) {
	if query == "" {
		return []models.NormalizedTeam{}, nil
	}
	if pageSize <= 0 {
		pageSize = 10
	}

	queryLower := strings.ToLower(query)
	var allTeams []models.NormalizedTeam
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, wiki := range s.getAllWikis() {
		wg.Add(1)
		go func(w string) {
			defer wg.Done()

			cacheKey := cache.LiqTeamSearchKey(w, queryLower)
			params := url.Values{}
			params.Set("wiki", w)
			params.Set("conditions", "[[status::active]]")
			params.Set("query", "pageid, pagename, objectname, name, locations, region, logourl, logodarkurl, template, status, extradata")
			params.Set("limit", "50")
			params.Set("order", "name ASC")

			data, err := s.MakeRequest(ctx, w, "team", params, cacheKey, TTLTeamSearch)
			if err != nil {
				s.log.WithError(err).WithField("wiki", w).Debug("Team search failed for wiki")
				return
			}

			resp, err := ParseResponse(data)
			if err != nil {
				return
			}

			for _, raw := range resp.Result {
				var team models.LiqTeam
				if err := json.Unmarshal(raw, &team); err != nil {
					continue
				}
				// Client-side partial match filter
				if !strings.Contains(strings.ToLower(team.Name), queryLower) &&
					!strings.Contains(strings.ToLower(team.Template), queryLower) &&
					!strings.Contains(strings.ToLower(team.PageName), queryLower) {
					continue
				}
				normalized := models.NormalizeLiqTeam(team, w, nil)
				mu.Lock()
				allTeams = append(allTeams, normalized)
				mu.Unlock()
			}
		}(wiki)
	}

	wg.Wait()

	// Deduplicate by ID
	seen := make(map[int]bool)
	deduped := make([]models.NormalizedTeam, 0, len(allTeams))
	for _, t := range allTeams {
		if !seen[t.ID] {
			seen[t.ID] = true
			deduped = append(deduped, t)
		}
	}

	// Limit results
	if len(deduped) > pageSize {
		deduped = deduped[:pageSize]
	}

	return deduped, nil
}

// GetTeamByPageID fetches a single team by its Liquipedia pageid across all wikis.
// Returns the team with its active roster (from /squadplayer).
func (s *LiquipediaService) GetTeamByPageID(ctx context.Context, pageID int64) (*models.NormalizedTeam, error) {
	pageIDStr := fmt.Sprintf("%d", pageID)

	for _, wiki := range s.getAllWikis() {
		cacheKey := cache.LiqTeamKey(wiki, pageIDStr)
		params := url.Values{}
		params.Set("wiki", wiki)
		params.Set("conditions", fmt.Sprintf("[[pageid::%d]]", pageID))
		params.Set("limit", "1")

		data, err := s.MakeRequest(ctx, wiki, "team", params, cacheKey, TTLTeam)
		if err != nil {
			continue
		}

		resp, err := ParseResponse(data)
		if err != nil || len(resp.Result) == 0 {
			continue
		}

		var team models.LiqTeam
		if err := json.Unmarshal(resp.Result[0], &team); err != nil {
			continue
		}

		// Fetch roster
		players := s.fetchSquadPlayers(ctx, wiki, team.PageName)
		normalized := models.NormalizeLiqTeam(team, wiki, players)
		return &normalized, nil
	}

	return nil, fmt.Errorf("team with pageid %d not found", pageID)
}

// GetTeamsByPageIDs fetches multiple teams by their Liquipedia pageids.
// Uses parallel goroutines for efficiency.
func (s *LiquipediaService) GetTeamsByPageIDs(ctx context.Context, pageIDs []int64) []models.NormalizedTeam {
	var results []models.NormalizedTeam
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, pid := range pageIDs {
		wg.Add(1)
		go func(id int64) {
			defer wg.Done()
			team, err := s.GetTeamByPageID(ctx, id)
			if err != nil {
				s.log.WithError(err).WithField("pageid", id).Debug("Failed to fetch team for favorites")
				return
			}
			mu.Lock()
			results = append(results, *team)
			mu.Unlock()
		}(pid)
	}

	wg.Wait()
	return results
}

// fetchSquadPlayers fetches the active roster for a team from /squadplayer.
func (s *LiquipediaService) fetchSquadPlayers(ctx context.Context, wiki, teamPageName string) []models.NormalizedPlayer {
	cacheKey := cache.LiqTeamSquadKey(wiki, teamPageName)
	params := url.Values{}
	params.Set("wiki", wiki)
	params.Set("conditions", fmt.Sprintf("[[pagename::%s]] AND [[type::player]]", teamPageName))
	params.Set("limit", "20")

	data, err := s.MakeRequest(ctx, wiki, "squadplayer", params, cacheKey, TTLTeam)
	if err != nil {
		s.log.WithError(err).WithFields(logrus.Fields{
			"wiki": wiki,
			"team": teamPageName,
		}).Debug("Failed to fetch squad players")
		return []models.NormalizedPlayer{}
	}

	resp, err := ParseResponse(data)
	if err != nil {
		return []models.NormalizedPlayer{}
	}

	var squadPlayers []models.LiqSquadPlayer
	for _, raw := range resp.Result {
		var sp models.LiqSquadPlayer
		if err := json.Unmarshal(raw, &sp); err != nil {
			continue
		}
		squadPlayers = append(squadPlayers, sp)
	}

	return models.NormalizeLiqSquadPlayers(squadPlayers)
}

// getAllWikis returns a list of all known Liquipedia wiki names.
func (s *LiquipediaService) getAllWikis() []string {
	wikis := make([]string, 0, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		wikis = append(wikis, wiki)
	}
	return wikis
}
