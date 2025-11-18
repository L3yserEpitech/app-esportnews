package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/esportnews/backend/internal/cache"
)

type PandaScoreService struct {
	apiKey string
	cache  *cache.RedisCache
}

// PandaScore API response structures
type PandaTournament struct {
	ID           int64       `json:"id"`
	Name         string      `json:"name"`
	Slug         *string     `json:"slug"`
	Status       *string     `json:"status"`
	Type         *string     `json:"type"`
	Tier         *string     `json:"tier"`
	BeginAt      *time.Time  `json:"begin_at"`
	EndAt        *time.Time  `json:"end_at"`
	Region       *string     `json:"region"`
	Prizepool    *string     `json:"prizepool"`
	HasBracket   bool        `json:"has_bracket"`
	Videogame    *Videogame  `json:"videogame"`
	Teams        []Team      `json:"teams,omitempty"`
	Matches      []PandaMatch `json:"matches,omitempty"`
}

type PandaMatch struct {
	ID                  int64       `json:"id"`
	Name                string      `json:"name"`
	Slug                *string     `json:"slug"`
	Status              *string     `json:"status"`
	BeginAt             *time.Time  `json:"begin_at"`
	EndAt               *time.Time  `json:"end_at"`
	ScheduledAt         *time.Time  `json:"scheduled_at"`
	OriginalScheduledAt *time.Time  `json:"original_scheduled_at"`
	MatchType           *string     `json:"match_type"`
	NumberOfGames       *int32      `json:"number_of_games"`
	Tournament          *PandaTournament `json:"tournament,omitempty"`
	Opponents           []Opponent  `json:"opponents,omitempty"`
}

type Team struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Image *string `json:"image_url"`
	Players []Player `json:"players,omitempty"`
}

type Player struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Role  *string `json:"role"`
	Image *string `json:"image_url"`
}

type Opponent struct {
	ID    int64  `json:"id"`
	Type  string `json:"type"`
	Team  *Team  `json:"team"`
}

type Videogame struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// NewPandaScoreService creates a new PandaScoreService
func NewPandaScoreService(apiKey string, redisCache *cache.RedisCache) *PandaScoreService {
	return &PandaScoreService{
		apiKey: apiKey,
		cache:  redisCache,
	}
}

// makePandaRequest makes an HTTP request to PandaScore API with cache support
func (s *PandaScoreService) makePandaRequest(ctx context.Context, endpoint string, cacheKey string) ([]byte, error) {
	// Try cache first (5 min TTL)
	if cached, err := s.cache.Get(ctx, cacheKey); err == nil && cached != "" {
		return []byte(cached), nil
	}

	// Make API request
	url := fmt.Sprintf("https://api.pandascore.co%s", endpoint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
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
func (s *PandaScoreService) GetTournament(ctx context.Context, id string) (*PandaTournament, error) {
	endpoint := fmt.Sprintf("/tournaments/%s", id)
	cacheKey := cache.PandaScoreTournamentKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var tournament PandaTournament
	if err := json.Unmarshal(data, &tournament); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournament: %w", err)
	}

	return &tournament, nil
}

// GetTournamentsForGame retrieves tournaments for a specific game and status
func (s *PandaScoreService) GetTournamentsForGame(ctx context.Context, game string, status string) ([]PandaTournament, error) {
	var endpoint string
	switch status {
	case "running":
		endpoint = fmt.Sprintf("/%s/tournaments", game)
	case "upcoming":
		endpoint = fmt.Sprintf("/%s/tournaments/upcoming", game)
	case "finished":
		endpoint = fmt.Sprintf("/%s/tournaments/past", game)
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	cacheKey := cache.PandaScoreTournamentsKey(game, status)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var tournaments []PandaTournament
	if err := json.Unmarshal(data, &tournaments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournaments: %w", err)
	}

	return tournaments, nil
}

// GetTournamentsAllGames retrieves tournaments for all games with a specific status
func (s *PandaScoreService) GetTournamentsAllGames(ctx context.Context, status string) ([]PandaTournament, error) {
	games := []string{"valorant", "fifa", "lol-wild-rift", "dota2", "overwatch", "cod-mw", "lol", "rainbow-six-siege", "rocket-league", "csgo"}
	var allTournaments []PandaTournament

	for _, game := range games {
		tournaments, err := s.GetTournamentsForGame(ctx, game, status)
		if err != nil {
			// Log but continue with other games
			continue
		}
		allTournaments = append(allTournaments, tournaments...)
	}

	return allTournaments, nil
}

// GetTournamentsByDate retrieves tournaments within a date range
func (s *PandaScoreService) GetTournamentsByDate(ctx context.Context, date string, game *string) ([]PandaTournament, error) {
	// Parse date for range
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format (use YYYY-MM-DD): %w", err)
	}

	dateStart := parsedDate.Format("2006-01-02T00:00:00Z")
	dateEnd := parsedDate.Format("2006-01-02T23:59:59Z")

	var endpoint string
	if game != nil && *game != "" {
		endpoint = fmt.Sprintf("/%s/tournaments?range[begin_at]=%s,%s&sort=-begin_at&page[size]=100", *game, dateStart, dateEnd)
	} else {
		endpoint = fmt.Sprintf("/tournaments?range[begin_at]=%s,%s&sort=-begin_at&page[size]=100", dateStart, dateEnd)
	}

	cacheKey := cache.PandaScoreTournamentsByDateKey(date, game)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var tournaments []PandaTournament
	if err := json.Unmarshal(data, &tournaments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tournaments: %w", err)
	}

	return tournaments, nil
}

// GetFilteredTournaments retrieves tournaments with multiple filters
func (s *PandaScoreService) GetFilteredTournaments(ctx context.Context, game *string, status string, tiers []string) ([]PandaTournament, error) {
	var allTournaments []PandaTournament

	// Determine which games to query
	var gamesToQuery []string
	if game != nil && *game != "" {
		gamesToQuery = []string{*game}
	} else {
		gamesToQuery = []string{"valorant", "fifa", "lol-wild-rift", "dota2", "overwatch", "cod-mw", "lol", "rainbow-six-siege", "rocket-league", "csgo"}
	}

	// Determine which tiers to query
	var tiersToQuery []string
	if len(tiers) > 0 {
		tiersToQuery = tiers
	} else {
		tiersToQuery = []string{"s", "a", "b", "c", "d"}
	}

	// Query each game/tier combination
	for _, g := range gamesToQuery {
		for _, tier := range tiersToQuery {
			var endpoint string
			switch status {
			case "running":
				endpoint = fmt.Sprintf("/%s/tournaments?filter[tier]=%s&page[size]=100", g, tier)
			case "upcoming":
				endpoint = fmt.Sprintf("/%s/tournaments/upcoming?filter[tier]=%s&page[size]=100", g, tier)
			case "finished":
				endpoint = fmt.Sprintf("/%s/tournaments/past?filter[tier]=%s&page[size]=100", g, tier)
			default:
				continue
			}

			cacheKey := cache.PandaScoreFilteredTournamentsKey(g, status, tier)
			data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
			if err != nil {
				continue
			}

			var tournaments []PandaTournament
			if err := json.Unmarshal(data, &tournaments); err != nil {
				continue
			}

			allTournaments = append(allTournaments, tournaments...)
		}
	}

	return allTournaments, nil
}

// ============ MATCH ENDPOINTS ============

// GetMatch retrieves a single match by ID
func (s *PandaScoreService) GetMatch(ctx context.Context, id string) (*PandaMatch, error) {
	endpoint := fmt.Sprintf("/matches/%s", id)
	cacheKey := cache.PandaScoreMatchKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var match PandaMatch
	if err := json.Unmarshal(data, &match); err != nil {
		return nil, fmt.Errorf("failed to unmarshal match: %w", err)
	}

	return &match, nil
}

// GetMatchesByDate retrieves matches within a date range
func (s *PandaScoreService) GetMatchesByDate(ctx context.Context, date string, game *string) ([]PandaMatch, error) {
	// Parse date for range
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format (use YYYY-MM-DD): %w", err)
	}

	dateStart := parsedDate.Format("2006-01-02T00:00:00Z")
	dateEnd := parsedDate.Format("2006-01-02T23:59:59Z")

	var endpoint string
	if game != nil && *game != "" {
		endpoint = fmt.Sprintf("/%s/matches?range[begin_at]=%s,%s&per_page=100&sort=-begin_at", *game, dateStart, dateEnd)
	} else {
		endpoint = fmt.Sprintf("/matches?range[begin_at]=%s,%s&per_page=100&sort=-begin_at", dateStart, dateEnd)
	}

	cacheKey := cache.PandaScoreMatchesByDateKey(date, game)
	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var matches []PandaMatch
	if err := json.Unmarshal(data, &matches); err != nil {
		return nil, fmt.Errorf("failed to unmarshal matches: %w", err)
	}

	return matches, nil
}

// ============ TEAM ENDPOINTS ============

// GetTeam retrieves a single team by ID
func (s *PandaScoreService) GetTeam(ctx context.Context, id string) (*Team, error) {
	endpoint := fmt.Sprintf("/teams/%s", id)
	cacheKey := cache.PandaScoreTeamKey(id)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var team Team
	if err := json.Unmarshal(data, &team); err != nil {
		return nil, fmt.Errorf("failed to unmarshal team: %w", err)
	}

	return &team, nil
}

// SearchTeams searches for teams by name
func (s *PandaScoreService) SearchTeams(ctx context.Context, query string, pageSize int) ([]Team, error) {
	if pageSize <= 0 {
		pageSize = 50
	}

	endpoint := fmt.Sprintf("/teams?search[name]=%s&page[size]=%d", query, pageSize)
	cacheKey := cache.PandaScoreSearchTeamsKey(query)

	data, err := s.makePandaRequest(ctx, endpoint, cacheKey)
	if err != nil {
		return nil, err
	}

	var teams []Team
	if err := json.Unmarshal(data, &teams); err != nil {
		return nil, fmt.Errorf("failed to unmarshal teams: %w", err)
	}

	return teams, nil
}

// GetTeams retrieves multiple teams by IDs (parallel requests)
func (s *PandaScoreService) GetTeams(ctx context.Context, teamIDs []int64) ([]Team, error) {
	var teams []Team
	teamChan := make(chan *Team, len(teamIDs))
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
