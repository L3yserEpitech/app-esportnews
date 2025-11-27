package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

type PandaScoreService struct {
	apiKey string
	cache  *cache.RedisCache
}

// NewPandaScoreService creates a new PandaScoreService
func NewPandaScoreService(apiKey string, redisCache *cache.RedisCache) *PandaScoreService {
	return &PandaScoreService{
		apiKey: apiKey,
		cache:  redisCache,
	}
}

// makePandaRequest makes an HTTP request to PandaScore API with cache support
func (s *PandaScoreService) makePandaRequest(ctx context.Context, endpoint string, cacheKey string, bodyParams map[string]string) ([]byte, error) {
	// Try cache first (5 min TTL)
	if cached, err := s.cache.Get(ctx, cacheKey); err == nil && cached != "" {
		fmt.Printf("[makePandaRequest] Cache HIT for key: %s\n", cacheKey)
		return []byte(cached), nil
	}
	fmt.Printf("[makePandaRequest] Cache MISS for key: %s, making API request\n", cacheKey)

	// Build full URL with query parameters
	fullURL := fmt.Sprintf("https://api.pandascore.co%s", endpoint)

	// Add params as query string (GET request)
	if len(bodyParams) > 0 {
		values := url.Values{}
		for k, v := range bodyParams {
			values.Set(k, v)
		}
		encoded := values.Encode()
		fullURL = fmt.Sprintf("%s?%s", fullURL, encoded)
	}
	fmt.Printf("[makePandaRequest] Full URL: %s\n", fullURL)

	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call PandaScore API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("PandaScore API returned %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Cache the response (5 min)
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.cache.Set(cacheCtx, cacheKey, string(body), 5*time.Minute)

	return body, nil
}

// ============ TOURNAMENT ENDPOINTS ============

// GetTournament retrieves a single tournament by ID
func (s *PandaScoreService) GetTournament(ctx context.Context, id string) (*models.Tournament, error) {
	endpoint := fmt.Sprintf("/tournaments/%s", id)
	cacheKey := cache.PandaScoreTournamentKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var tournament models.Tournament
	if err := json.Unmarshal(data, &tournament); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournament: %w", err)
	}

	return &tournament, nil
}

// GetTournamentsForGame retrieves tournaments for a specific game and status
// Uses game-specific endpoint format: /{game}/tournaments/{status}
func (s *PandaScoreService) GetTournamentsForGame(ctx context.Context, game string, status string) ([]models.Tournament, error) {
	var endpoint string
	switch status {
	case "running":
		endpoint = fmt.Sprintf("/%s/tournaments/running", game)
	case "upcoming":
		endpoint = fmt.Sprintf("/%s/tournaments/upcoming", game)
	case "finished":
		endpoint = fmt.Sprintf("/%s/tournaments/past", game)
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	fmt.Printf("[GetTournamentsForGame] Game: %s, Status: %s, Endpoint: %s\n", game, status, endpoint)

	cacheKey := cache.PandaScoreTournamentsKey(game, status)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var tournaments []models.Tournament
	if err := json.Unmarshal(data, &tournaments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournaments: %w", err)
	}

	return tournaments, nil
}

// GetTournamentsAllGames retrieves tournaments for all games with a specific status
func (s *PandaScoreService) GetTournamentsAllGames(ctx context.Context, status string) ([]models.Tournament, error) {
	var endpoint string
	switch status {
	case "running":
		endpoint = "/tournaments/running"
	case "upcoming":
		endpoint = "/tournaments/upcoming"
	case "finished":
		endpoint = "/tournaments/past"
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	cacheKey := cache.PandaScoreTournamentsAllGamesKey(status)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var tournaments []models.Tournament
	if err := json.Unmarshal(data, &tournaments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournaments: %w", err)
	}

	return tournaments, nil
}

// GetTournamentsByDate retrieves tournaments within a date range
func (s *PandaScoreService) GetTournamentsByDate(ctx context.Context, date string, game *string) ([]models.Tournament, error) {
	// Parse date for range
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format (use YYYY-MM-DD): %w", err)
	}

	dateStart := parsedDate.Format("2006-01-02T") + "00:00:00Z"
	dateEnd := parsedDate.Format("2006-01-02T") + "23:59:59Z"

	// Build endpoint - use global tournaments endpoint with filters
	endpoint := "/tournaments"

	// Build body params with properly escaped range
	bodyParams := map[string]string{
		"range[begin_at]": fmt.Sprintf("%s,%s", dateStart, dateEnd),
		"sort":            "-begin_at",
		"page[size]":      "100",
	}

	// Add game filter if provided
	if game != nil && *game != "" {
		bodyParams["filter[videogame_title]"] = *game
	}

	cacheKey := cache.PandaScoreTournamentsByDateKey(date, game)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, bodyParams)
	if err != nil {
		return nil, err
	}

	var tournaments []models.Tournament
	if err := json.Unmarshal(data, &tournaments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournaments: %w", err)
	}

	return tournaments, nil
}

// GetFilteredTournaments retrieves tournaments with multiple filters
func (s *PandaScoreService) GetFilteredTournaments(ctx context.Context, game *string, status string, tiers []string) ([]models.Tournament, error) {
	var allTournaments []models.Tournament

	// Determine which tiers to query
	var tiersToQuery []string
	if len(tiers) > 0 {
		tiersToQuery = tiers
	} else {
		tiersToQuery = []string{"s", "a", "b", "c", "d"}
	}

	// Build base endpoint
	var baseEndpoint string
	switch status {
	case "running":
		baseEndpoint = "/tournaments/running"
	case "upcoming":
		baseEndpoint = "/tournaments/upcoming"
	case "finished":
		baseEndpoint = "/tournaments/past"
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	// Query each tier with filters
	for _, tier := range tiersToQuery {
		// Build filter string
		var endpoint string
		filterParts := []string{fmt.Sprintf("filter[tier]=%s", tier)}
		if game != nil && *game != "" {
			filterParts = append(filterParts, fmt.Sprintf("filter[videogame_title]=%s", *game))
		}

		endpoint = fmt.Sprintf("%s?%s&page[size]=100", baseEndpoint, filterParts[0])
		if len(filterParts) > 1 {
			endpoint = fmt.Sprintf("%s&%s", endpoint, filterParts[1])
		}

		gameStr := "all"
		if game != nil && *game != "" {
			gameStr = *game
		}

		cacheKey := cache.PandaScoreFilteredTournamentsKey(gameStr, status, tier)
		data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
		if err != nil {
			continue
		}

		var tournaments []models.Tournament
		if err := json.Unmarshal(data, &tournaments); err != nil {
			continue
		}

		allTournaments = append(allTournaments, tournaments...)
	}

	return allTournaments, nil
}

// ============ MATCH ENDPOINTS ============

// GetRunningMatches retrieves matches currently running (live)
// gameAcronym is optional - if provided, uses game-specific endpoint (e.g., "/csgo/matches/running")
// If not provided, uses global endpoint "/matches/running"
func (s *PandaScoreService) GetRunningMatches(ctx context.Context, gameAcronym *string) ([]models.PandaMatch, error) {
	// Build endpoint: if gameAcronym provided, use game-specific endpoint
	var endpoint string
	if gameAcronym != nil && *gameAcronym != "" {
		endpoint = fmt.Sprintf("/%s/matches/running", *gameAcronym)
		fmt.Printf("[GetRunningMatches] Game acronym provided: %s, endpoint: %s\n", *gameAcronym, endpoint)
	} else {
		endpoint = "/matches/running"
		fmt.Printf("[GetRunningMatches] No game acronym, using global endpoint: %s\n", endpoint)
	}
	
	// Build query parameters
	params := map[string]string{
		"sort":     "-begin_at",
		"per_page": "50",
	}
	
	cacheKey := cache.PandaScoreRunningMatchesKey(gameAcronym)
	fmt.Printf("[GetRunningMatches] Cache key: %s\n", cacheKey)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, params)
	if err != nil {
		return nil, err
	}
	
	// Handle empty response
	if len(data) == 0 || string(data) == "null" {
		return []models.PandaMatch{}, nil
	}
	
	// Try to unmarshal as array
	var matches []models.PandaMatch
	if err := json.Unmarshal(data, &matches); err == nil {
		return matches, nil
	}
	
	// If array parsing fails, try as an object (for paginated responses)
	var respObj map[string]interface{}
	if err := json.Unmarshal(data, &respObj); err == nil {
		for _, key := range []string{"data", "matches", "results", "items"} {
			if val, ok := respObj[key]; ok {
				if matchesJSON, err := json.Marshal(val); err == nil {
					if err := json.Unmarshal(matchesJSON, &matches); err == nil {
						return matches, nil
					}
				}
			}
		}
	}
	
	return nil, fmt.Errorf("failed to parse running matches response")
}

// GetMatch retrieves a single match by ID
func (s *PandaScoreService) GetMatch(ctx context.Context, id string) (*models.PandaMatch, error) {
	endpoint := fmt.Sprintf("/matches/%s", id)
	cacheKey := cache.PandaScoreMatchKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var match models.PandaMatch
	if err := json.Unmarshal(data, &match); err != nil {
		return nil, fmt.Errorf("failed to unmarshal match: %w", err)
	}

	return &match, nil
}

// GetMatchesByDate retrieves matches within a date range
func (s *PandaScoreService) GetMatchesByDate(ctx context.Context, date string, game *string) ([]models.PandaMatch, error) {
	// Parse date for range
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format (use YYYY-MM-DD): %w", err)
	}

	dateStart := parsedDate.Format("2006-01-02T") + "00:00:00Z"
	dateEnd := parsedDate.Format("2006-01-02T") + "23:59:59Z"

	// Build endpoint - use global matches endpoint
	endpoint := "/matches"

	// Build body params with properly escaped range
	bodyParams := map[string]string{
		"range[begin_at]": fmt.Sprintf("%s,%s", dateStart, dateEnd),
		"per_page":        "100",
		"sort":            "-begin_at",
	}

	// Add game filter if provided
	if game != nil && *game != "" {
		bodyParams["filter[videogame_title]"] = *game
	}

	cacheKey := cache.PandaScoreMatchesByDateKey(date, game)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, bodyParams)
	if err != nil {
		return nil, err
	}

	// First check if response is empty or null
	if len(data) == 0 || string(data) == "null" {
		return []models.PandaMatch{}, nil
	}

	// Try to unmarshal as array first
	var matches []models.PandaMatch
	if err := json.Unmarshal(data, &matches); err == nil {
		return matches, nil
	}

	// If array parsing fails, try as an object (for paginated responses)
	var respObj map[string]interface{}
	if err := json.Unmarshal(data, &respObj); err == nil {
		// Try to find the data in common keys
		for _, key := range []string{"data", "matches", "results", "items"} {
			if val, ok := respObj[key]; ok {
				// Try to unmarshal this field as matches
				if matchData, err := json.Marshal(val); err == nil {
					var matches []models.PandaMatch
					if err := json.Unmarshal(matchData, &matches); err == nil {
						return matches, nil
					}
				}
			}
		}
	}

	// If we get here, log the response for debugging
	truncated := data
	if len(data) > 1000 {
		truncated = data[:1000]
	}
	fmt.Printf("[GetMatchesByDate] Failed to parse response\n[GetMatchesByDate] Raw response: %s\n", string(truncated))

	return nil, fmt.Errorf("failed to unmarshal matches: unsupported response format")
}

// ============ TEAM ENDPOINTS ============

// GetTeam retrieves a single team by ID
func (s *PandaScoreService) GetTeam(ctx context.Context, id string) (*models.PandaTeam, error) {
	endpoint := fmt.Sprintf("/teams/%s", id)
	cacheKey := cache.PandaScoreTeamKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var team models.PandaTeam
	if err := json.Unmarshal(data, &team); err != nil {
		return nil, fmt.Errorf("failed to unmarshal team: %w", err)
	}

	return &team, nil
}

// SearchTeams searches for teams by name
func (s *PandaScoreService) SearchTeams(ctx context.Context, query string, pageSize int) ([]models.PandaTeam, error) {
	if pageSize <= 0 {
		pageSize = 50
	}

	endpoint := fmt.Sprintf("/teams?search[name]=%s&page[size]=%d", query, pageSize)
	cacheKey := cache.PandaScoreSearchTeamsKey(query)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey, map[string]string{})
	if err != nil {
		return nil, err
	}

	var teams []models.PandaTeam
	if err := json.Unmarshal(data, &teams); err != nil {
		return nil, fmt.Errorf("failed to unmarshal teams: %w", err)
	}

	return teams, nil
}

// GetTeams retrieves multiple teams by IDs (parallel requests)
func (s *PandaScoreService) GetTeams(ctx context.Context, teamIDs []int64) ([]models.PandaTeam, error) {
	var teams []models.PandaTeam
	teamChan := make(chan *models.PandaTeam, len(teamIDs))
	errChan := make(chan error, len(teamIDs))

	// Fetch teams in parallel
	for _, id := range teamIDs {
		go func(teamID int64) {
			team, err := s.GetTeam(ctx, fmt.Sprintf("%d", teamID))
			if err != nil {
				errChan <- err
				return
			}
			teamChan <- team
		}(id)
	}

	// Collect results
	for i := 0; i < len(teamIDs); i++ {
		select {
		case team := <-teamChan:
			if team != nil {
				teams = append(teams, *team)
			}
		case <-errChan:
			// Skip failed requests
			continue
		}
	}

	return teams, nil
}
