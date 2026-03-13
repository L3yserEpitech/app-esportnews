package services

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"golang.org/x/sync/singleflight"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

const (
	liquipediaBaseURL = "https://api.liquipedia.net/api/v3"
	liquipediaUA      = "EsportNews/1.0 (contact@esportnews.fr)"

	// Budget: 60 requests per wiki per hour
	budgetLimitPerWiki = 60
)

// Cache TTLs — must be > polling interval to avoid gaps where cache is empty.
// Aligned with reduced polling intervals (~17 req/wiki/hr).
const (
	TTLMatchesRunning      = 10 * time.Minute  // > PollIntervalMatchesRunning (8m)
	TTLMatchesUpcoming     = 22 * time.Minute  // > PollIntervalMatchesUpcoming (20m)
	TTLMatchesPast         = 50 * time.Minute  // > PollIntervalMatchesPast (45m)
	TTLTournamentsRunning  = 22 * time.Minute  // > PollIntervalTournamentsRunning (20m)
	TTLTournamentsUpcoming = 35 * time.Minute  // > PollIntervalTournamentsUpcoming (30m)
	TTLTournamentsFinished = 100 * time.Minute // > PollIntervalTournamentsFinished (90m)
	TTLMatchDetail         = 5 * time.Minute
	TTLMatchDetailFinished = 24 * time.Hour
	TTLMatchesByDatePast   = 6 * time.Hour
	TTLTournamentDetail    = 10 * time.Minute
	TTLTeam                = 6 * time.Hour  // roster data changes infrequently
	TTLTeamMatches         = 15 * time.Minute
	TTLTeamPlacements      = 1 * time.Hour
	TTLStale               = 2 * time.Hour // stale-while-revalidate fallback
)

// RequestBudget tracks API usage per wiki (game) to enforce the 60 req/hour limit.
// The counter is persisted in Redis so restarts don't reset the count within a live hour.
// Includes exponential backoff on 429 responses to avoid hammering.
type RequestBudget struct {
	Wiki    string
	Used    int
	Limit   int
	ResetAt time.Time
	mu      sync.Mutex

	// Backoff: when we receive a 429, stop making requests until this time
	blockedUntil time.Time

	// Redis persistence (optional — best-effort)
	redisCache *cache.RedisCache
}

// budgetRedisKey returns the Redis key for this wiki's current hour budget.
func (b *RequestBudget) budgetRedisKey() string {
	hour := time.Now().UTC().Truncate(time.Hour).Format("2006010215")
	return fmt.Sprintf("liq:budget:%s:%s", b.Wiki, hour)
}

// CanMakeRequest checks if there's budget remaining for this wiki.
func (b *RequestBudget) CanMakeRequest() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeReset()
	// Respect backoff from 429
	if time.Now().Before(b.blockedUntil) {
		return false
	}
	return b.Used < b.Limit
}

// Record429 marks a 429 response — sets the budget to exhausted and applies backoff.
// Each consecutive 429 doubles the backoff: 5min, 10min, 20min, capped at 30min.
func (b *RequestBudget) Record429() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.Used = b.Limit // mark as exhausted

	now := time.Now()
	remaining := time.Until(b.blockedUntil)
	if remaining <= 0 {
		// First 429 in this cycle — backoff 5 minutes
		b.blockedUntil = now.Add(5 * time.Minute)
	} else {
		// Consecutive 429 — double the backoff, cap at 30 minutes
		newBackoff := remaining * 2
		if newBackoff > 30*time.Minute {
			newBackoff = 30 * time.Minute
		}
		b.blockedUntil = now.Add(newBackoff)
	}
}

// RecordRequest increments the usage counter (in-memory + Redis best-effort).
func (b *RequestBudget) RecordRequest() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.maybeReset()
	b.Used++
	// Persist to Redis (best-effort, async)
	if b.redisCache != nil {
		key := b.budgetRedisKey()
		used := b.Used
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			ttl := time.Until(b.ResetAt) + 2*time.Minute // slightly beyond reset
			_ = b.redisCache.Set(ctx, key, fmt.Sprintf("%d", used), ttl)
		}()
	}
}

// loadFromRedis initializes the in-memory counter from Redis (called once at startup).
func (b *RequestBudget) loadFromRedis(ctx context.Context) {
	if b.redisCache == nil {
		return
	}
	val, err := b.redisCache.Get(ctx, b.budgetRedisKey())
	if err != nil || val == "" {
		return
	}
	var used int
	if _, err := fmt.Sscanf(val, "%d", &used); err == nil && used > 0 {
		b.mu.Lock()
		b.maybeReset()
		if used > b.Used {
			b.Used = used
		}
		b.mu.Unlock()
	}
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
	sfGroup    singleflight.Group // deduplicates concurrent API calls for the same cache key
}

// NewLiquipediaService creates the service with budget trackers for all known wikis.
func NewLiquipediaService(apiKey string, redisCache *cache.RedisCache, logger *logrus.Logger) *LiquipediaService {
	budgets := make(map[string]*RequestBudget, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		budgets[wiki] = &RequestBudget{
			Wiki:       wiki,
			Limit:      budgetLimitPerWiki,
			ResetAt:    time.Now().Truncate(time.Hour).Add(time.Hour),
			redisCache: redisCache,
		}
	}

	// Load persisted budget counts from Redis (survives restarts within the same hour)
	if redisCache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, b := range budgets {
			b.loadFromRedis(ctx)
		}
	}

	httpClient := &http.Client{
		Timeout: 15 * time.Second,
	}

	// Liquipedia API (api.liquipedia.net) is only properly accessible via IPv6.
	// The IPv4 address serves the main website cert (liquipedia.net), not the API cert.
	// Docker containers often prefer IPv4 via Happy Eyeballs, hitting the wrong server.
	// Fix: use a custom DialContext that tries IPv6 ("tcp6") first with a short timeout,
	// falling back to IPv4 only for other hosts (Redis, Postgres, etc.).
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, _ := net.SplitHostPort(addr)
		if host == "api.liquipedia.net" {
			// Short IPv6 probe — if IPv6 works, it connects in <1s
			ipv6Dialer := &net.Dialer{Timeout: 3 * time.Second}
			conn, err := ipv6Dialer.DialContext(ctx, "tcp6", addr)
			if err != nil {
				logger.WithError(err).Warn("IPv6 connection to Liquipedia failed, falling back to IPv4")
				ipv4Dialer := &net.Dialer{Timeout: 8 * time.Second}
				return ipv4Dialer.DialContext(ctx, "tcp4", addr)
			}
			return conn, nil
		}
		dialer := &net.Dialer{Timeout: 10 * time.Second}
		return dialer.DialContext(ctx, network, addr)
	}

	if os.Getenv("LIQUIPEDIA_SKIP_TLS") == "true" {
		logger.Warn("TLS verification disabled for Liquipedia API (LIQUIPEDIA_SKIP_TLS=true)")
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	httpClient.Transport = transport

	return &LiquipediaService{
		apiKey:     apiKey,
		cache:      redisCache,
		httpClient: httpClient,
		budgets:    budgets,
		log:        logger,
	}
}

// MakeRequest performs a cached, budget-aware GET to the Liquipedia API.
// It handles: cache lookup → singleflight dedup → budget check → HTTP request → cache store + stale copy.
// Singleflight ensures that N concurrent requests for the same cacheKey result in only 1 API call.
// wiki: the Liquipedia wiki name (e.g. "valorant")
// endpoint: the API path after the wiki (e.g. "match")
// params: query parameters (conditions, limit, etc.)
// cacheKey: Redis key for this data
// cacheTTL: how long to cache the fresh data
func (s *LiquipediaService) MakeRequest(ctx context.Context, wiki, endpoint string, params url.Values, cacheKey string, cacheTTL time.Duration) ([]byte, error) {
	// 1. Check fresh cache (fast path, no dedup needed)
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		return []byte(cached), nil
	}

	// 2. Singleflight: deduplicate concurrent API calls for the same cache key.
	// If 5 users request the same uncached data simultaneously, only 1 API call is made.
	v, err, shared := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		// Re-check cache (another goroutine may have populated it while we waited)
		if cached, cErr := s.cache.Get(ctx, cacheKey); cErr == nil && cached != "" {
			return []byte(cached), nil
		}

		// Check budget
		budget := s.getBudget(wiki)
		if budget == nil {
			return nil, fmt.Errorf("unknown wiki: %s", wiki)
		}

		if !budget.CanMakeRequest() {
			s.log.WithFields(logrus.Fields{
				"wiki": wiki,
				"key":  cacheKey,
			}).Warn("Budget exhausted, attempting stale cache")
			return s.getStaleOrError(ctx, cacheKey, wiki)
		}

		// Build URL — Liquipedia API v3 uses /v3/{endpoint}?wiki={wiki}
		fetchParams := params
		if fetchParams == nil {
			fetchParams = url.Values{}
		}
		fetchParams.Set("wiki", wiki)
		encoded := strings.ReplaceAll(fetchParams.Encode(), "+", "%20")
		reqURL := fmt.Sprintf("%s/%s?%s", liquipediaBaseURL, endpoint, encoded)

		// Build HTTP request
		req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if reqErr != nil {
			return nil, fmt.Errorf("building request: %w", reqErr)
		}
		req.Header.Set("Authorization", "Apikey "+s.apiKey)
		req.Header.Set("User-Agent", liquipediaUA)
		req.Header.Set("Accept", "application/json")

		// Execute
		resp, doErr := s.httpClient.Do(req)
		if doErr != nil {
			s.log.WithError(doErr).WithField("wiki", wiki).Error("HTTP request failed")
			return s.getStaleOrError(ctx, cacheKey, wiki)
		}
		defer resp.Body.Close()

		// Handle rate limit (429)
		if resp.StatusCode == http.StatusTooManyRequests {
			s.log.WithField("wiki", wiki).Warn("Rate limited by Liquipedia (429)")
			budget.Record429()
			return s.getStaleOrError(ctx, cacheKey, wiki)
		}

		// Handle other errors
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			s.log.WithFields(logrus.Fields{
				"wiki":   wiki,
				"status": resp.StatusCode,
				"body":   string(body),
			}).Error("Liquipedia API error")
			return s.getStaleOrError(ctx, cacheKey, wiki)
		}

		// Read body (limit to 10MB to prevent memory exhaustion)
		const maxResponseSize = 10 * 1024 * 1024
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxResponseSize))
		if readErr != nil {
			return nil, fmt.Errorf("reading response body: %w", readErr)
		}

		// Record the request in the budget
		budget.RecordRequest()

		// Store in cache (fresh + stale copy)
		_ = s.cache.Set(ctx, cacheKey, string(body), cacheTTL)
		_ = s.cache.Set(ctx, cache.StaleKey(cacheKey), string(body), TTLStale)

		s.log.WithFields(logrus.Fields{
			"wiki":     wiki,
			"endpoint": endpoint,
			"key":      cacheKey,
			"ttl":      cacheTTL.String(),
		}).Debug("Liquipedia API request successful")

		return body, nil
	})

	if shared {
		s.log.WithFields(logrus.Fields{
			"wiki": wiki,
			"key":  cacheKey,
		}).Debug("Singleflight: shared result from concurrent request")
	}

	if err != nil {
		return nil, err
	}
	return v.([]byte), nil
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

	// Limit concurrent wiki searches to avoid flooding Liquipedia API
	sem := make(chan struct{}, 4)
	for _, wiki := range s.getAllWikis() {
		wg.Add(1)
		go func(w string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

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
// Fix #18: Searches all wikis in parallel for faster lookups.
// Returns the team with its active roster (from /squadplayer).
func (s *LiquipediaService) GetTeamByPageID(ctx context.Context, pageID int64) (*models.NormalizedTeam, error) {
	pageIDStr := fmt.Sprintf("%d", pageID)

	type result struct {
		team *models.NormalizedTeam
	}

	allWikis := s.getAllWikis()
	results := make(chan result, len(allWikis))

	for _, wiki := range allWikis {
		go func(w string) {
			cacheKey := cache.LiqTeamKey(w, pageIDStr)
			params := url.Values{}
			params.Set("wiki", w)
			params.Set("conditions", fmt.Sprintf("[[pageid::%d]]", pageID))
			params.Set("limit", "1")

			data, err := s.MakeRequest(ctx, w, "team", params, cacheKey, TTLTeam)
			if err != nil {
				results <- result{nil}
				return
			}

			resp, err := ParseResponse(data)
			if err != nil || len(resp.Result) == 0 {
				results <- result{nil}
				return
			}

			var team models.LiqTeam
			if err := json.Unmarshal(resp.Result[0], &team); err != nil {
				results <- result{nil}
				return
			}

			players := s.fetchSquadPlayers(ctx, w, team.PageName)
			normalized := models.NormalizeLiqTeam(team, w, players)
			results <- result{&normalized}
		}(wiki)
	}

	for i := 0; i < len(allWikis); i++ {
		select {
		case res := <-results:
			if res.team != nil {
				return res.team, nil
			}
		case <-ctx.Done():
			return nil, fmt.Errorf("team search timeout for pageid %d", pageID)
		}
	}

	return nil, fmt.Errorf("team with pageid %d not found", pageID)
}

// GetTeamByTemplate fetches a single team by its Liquipedia template shortname on a specific wiki.
// The template param is the team's shortname (e.g. "genone"), which maps to the `template` field
// in Liquipedia's team cargo table — NOT to pagename (e.g. "Gen.ONE").
// Returns the team with its active roster (from /squadplayer).
func (s *LiquipediaService) GetTeamByTemplate(ctx context.Context, wiki string, template string) (*models.NormalizedTeam, error) {
	cacheKey := cache.LiqTeamKey(wiki, template)
	params := url.Values{}
	params.Set("wiki", wiki)
	params.Set("conditions", fmt.Sprintf("[[template::%s]]", template))
	params.Set("limit", "1")

	data, err := s.MakeRequest(ctx, wiki, "team", params, cacheKey, TTLTeam)
	if err != nil {
		return nil, err
	}

	resp, err := ParseResponse(data)
	if err != nil || len(resp.Result) == 0 {
		return nil, fmt.Errorf("team %q not found in wiki %s", template, wiki)
	}

	var team models.LiqTeam
	if err := json.Unmarshal(resp.Result[0], &team); err != nil {
		return nil, fmt.Errorf("failed to parse team %q from wiki %s: %w", template, wiki, err)
	}

	players := s.fetchSquadPlayers(ctx, wiki, team.PageName)
	normalized := models.NormalizeLiqTeam(team, wiki, players)
	return &normalized, nil
}

// GetTeamsByPageIDs fetches multiple teams by their Liquipedia pageids.
// Uses parallel goroutines for efficiency.
func (s *LiquipediaService) GetTeamsByPageIDs(ctx context.Context, pageIDs []int64) []models.NormalizedTeam {
	var results []models.NormalizedTeam
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Limit concurrent team fetches to avoid flooding Liquipedia API
	sem := make(chan struct{}, 4)
	for _, pid := range pageIDs {
		wg.Add(1)
		go func(id int64) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release
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
	params.Set("conditions", fmt.Sprintf("[[pagename::%s]]", teamPageName))
	params.Set("limit", "100")

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

// FetchBatchSquadPlayers fetches squad players for multiple teams in a single API call.
// Uses OR conditions on pagename ([[pagename::T1]] OR [[pagename::T2]] OR ...) since
// Liquipedia's teamtemplate field includes date suffixes (e.g. "heroic sep 2024").
// teamNames are the Liquipedia page names (opponent Name from match data).
// Returns a map of lowercase team name → []NormalizedRosterPlayer (active players only).
func (s *LiquipediaService) FetchBatchSquadPlayers(ctx context.Context, wiki string, teamNames []string, cacheKey string, ttl time.Duration) map[string][]models.NormalizedRosterPlayer {
	if len(teamNames) == 0 {
		return map[string][]models.NormalizedRosterPlayer{}
	}

	// Build OR condition: [[pagename::T1]] OR [[pagename::T2]] OR ...
	// The || operator doesn't work with pagename, so we use the OR keyword.
	parts := make([]string, len(teamNames))
	for i, name := range teamNames {
		parts[i] = fmt.Sprintf("[[pagename::%s]]", name)
	}
	condition := strings.Join(parts, " OR ")

	params := url.Values{}
	params.Set("conditions", condition)
	params.Set("limit", "5000")

	s.log.WithFields(logrus.Fields{
		"wiki":  wiki,
		"teams": len(teamNames),
	}).Info("Batch fetching squad players by pagename")

	data, err := s.MakeRequest(ctx, wiki, "squadplayer", params, cacheKey, ttl)
	if err != nil {
		s.log.WithError(err).WithField("wiki", wiki).Warn("Failed to batch fetch squad players")
		return map[string][]models.NormalizedRosterPlayer{}
	}

	resp, err := ParseResponse(data)
	if err != nil {
		return map[string][]models.NormalizedRosterPlayer{}
	}

	s.log.WithFields(logrus.Fields{
		"wiki":       wiki,
		"rawResults": len(resp.Result),
	}).Info("Batch squad players API response")

	// Group players by pagename (lowercase for matching), filter type=player and status!=former
	teamPlayers := make(map[string][]models.LiqSquadPlayer)
	for _, raw := range resp.Result {
		var sp models.LiqSquadPlayer
		if err := json.Unmarshal(raw, &sp); err != nil {
			continue
		}
		// Only keep current roster: type=player, not former
		if sp.Type != "player" || sp.Status == "former" {
			continue
		}
		key := strings.ToLower(sp.PageName)
		teamPlayers[key] = append(teamPlayers[key], sp)
	}

	// Normalize each group
	result := make(map[string][]models.NormalizedRosterPlayer)
	for teamKey, players := range teamPlayers {
		normalized := models.NormalizeLiqSquadPlayers(players)
		rosterPlayers := make([]models.NormalizedRosterPlayer, 0, len(normalized))
		for _, p := range normalized {
			rp := models.NormalizedRosterPlayer{
				ID:     p.ID,
				Name:   p.Name,
				Active: p.Active,
				Role:   p.Role,
			}
			if p.ImageURL != "" {
				v := p.ImageURL
				rp.ImageURL = &v
			}
			if p.FirstName != "" {
				v := p.FirstName
				rp.FirstName = &v
			}
			if p.LastName != "" {
				v := p.LastName
				rp.LastName = &v
			}
			if p.Nationality != "" {
				v := p.Nationality
				rp.Nationality = &v
			}
			rosterPlayers = append(rosterPlayers, rp)
		}
		result[teamKey] = rosterPlayers
	}

	return result
}

// GetTeamDetailByPageID fetches comprehensive team details for the team detail page.
// Returns enriched team info + roster (2 API calls max, both cached 2h).
func (s *LiquipediaService) GetTeamDetailByPageID(ctx context.Context, pageID int64) (*models.EnrichedTeamDetail, error) {
	pageIDStr := fmt.Sprintf("%d", pageID)

	for _, wiki := range s.getAllWikis() {
		cacheKey := cache.LiqTeamKey(wiki, pageIDStr)
		params := url.Values{}
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

		// Fetch roster (cached 2h via TTLTeam)
		players := s.fetchSquadPlayers(ctx, wiki, team.PageName)

		detail := models.NormalizeLiqTeamDetail(team, wiki, players)
		return &detail, nil
	}

	return nil, fmt.Errorf("team with pageid %d not found", pageID)
}

// FetchTeamMatches fetches recent or upcoming matches for a team from Liquipedia.
// matchType: "recent" (finished, desc) or "upcoming" (not started, asc).
// Uses [[opponent::teamTemplate]] condition to filter by team.
func (s *LiquipediaService) FetchTeamMatches(ctx context.Context, wiki, teamTemplate, matchType string) ([]models.NormalizedMatch, error) {
	var conditions string
	var order string
	var cacheKey string

	if matchType == "recent" {
		conditions = fmt.Sprintf("[[opponent::%s]] AND [[finished::1]]", teamTemplate)
		order = "date DESC"
		cacheKey = cache.LiqTeamMatchesRecentKey(wiki, teamTemplate)
	} else {
		now := time.Now().UTC().Format("2006-01-02 15:04:05")
		conditions = fmt.Sprintf("[[opponent::%s]] AND [[finished::0]] AND [[date::>%s]]", teamTemplate, now)
		order = "date ASC"
		cacheKey = cache.LiqTeamMatchesUpcomingKey(wiki, teamTemplate)
	}

	params := url.Values{}
	params.Set("conditions", conditions)
	params.Set("order", order)
	params.Set("limit", "10")

	data, err := s.MakeRequest(ctx, wiki, "match", params, cacheKey, TTLTeamMatches)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch %s matches for team %s: %w", matchType, teamTemplate, err)
	}

	resp, err := ParseResponse(data)
	if err != nil {
		return nil, err
	}

	matches := make([]models.NormalizedMatch, 0, len(resp.Result))
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

		if !m.HasTwoNamedOpponents() {
			continue
		}

		statusHint := ""
		if matchType == "recent" {
			statusHint = "finished"
		} else {
			statusHint = "not_started"
		}

		matches = append(matches, models.NormalizeLiqMatch(m, wiki, statusHint))
	}

	return matches, nil
}

// FetchTeamPlacements fetches tournament placements for a team from the Liquipedia /placement endpoint.
// Returns the most recent placements with actual results (non-empty placement string).
func (s *LiquipediaService) FetchTeamPlacements(ctx context.Context, wiki, teamName string, limit int) ([]models.NormalizedPlacement, error) {
	if limit <= 0 {
		limit = 20
	}

	cacheKey := cache.LiqTeamPlacementsKey(wiki, teamName)

	conditions := fmt.Sprintf("[[opponentname::%s]]", teamName)
	params := url.Values{}
	params.Set("conditions", conditions)
	params.Set("order", "date DESC")
	params.Set("limit", fmt.Sprintf("%d", limit))

	data, err := s.MakeRequest(ctx, wiki, "placement", params, cacheKey, TTLTeamPlacements)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch placements for team %s: %w", teamName, err)
	}

	resp, err := ParseResponse(data)
	if err != nil {
		return nil, err
	}

	placements := make([]models.NormalizedPlacement, 0, len(resp.Result))
	for _, raw := range resp.Result {
		var p models.LiqPlacement
		if err := json.Unmarshal(raw, &p); err != nil {
			continue
		}
		// Only include entries that have an actual placement result
		if p.Placement == "" {
			continue
		}
		placements = append(placements, models.NormalizeLiqPlacement(p))
	}

	return placements, nil
}

// getAllWikis returns a list of all known Liquipedia wiki names.
func (s *LiquipediaService) getAllWikis() []string {
	wikis := make([]string, 0, len(models.GameWikiMapping))
	for _, wiki := range models.GameWikiMapping {
		wikis = append(wikis, wiki)
	}
	return wikis
}
