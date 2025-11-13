package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

type MatchService struct {
	db    *pgxpool.Pool
	cache *cache.RedisCache
}

func NewMatchService(db *pgxpool.Pool, redisCache *cache.RedisCache) *MatchService {
	return &MatchService{
		db:    db,
		cache: redisCache,
	}
}

// GetMatches retrieves all matches with pagination
func (s *MatchService) GetMatches(ctx context.Context, limit, offset int) ([]*models.Match, error) {
	// Query database with pagination
	query := `SELECT id, created_at, panda_id, name, slug, status, match_type, number_of_games,
	                 begin_at, end_at, scheduled_at, original_scheduled_at, tournament_id, serie_id, league_id,
	                 winner_id, winner_type, rescheduled, forfeit, draw, detailed_stats, game_advantage,
	                 live_supported, live_url, modified_at, raw_data
	         FROM public.matches ORDER BY id DESC LIMIT $1 OFFSET $2`

	rows, err := s.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query matches: %w", err)
	}
	defer rows.Close()

	var matches []*models.Match
	for rows.Next() {
		var m models.Match
		if err := rows.Scan(&m.ID, &m.CreatedAt, &m.PandaID, &m.Name, &m.Slug, &m.Status, &m.MatchType, &m.NumberOfGames,
			&m.BeginAt, &m.EndAt, &m.ScheduledAt, &m.OriginalScheduledAt, &m.TournamentID, &m.SerieID, &m.LeagueID,
			&m.WinnerID, &m.WinnerType, &m.Rescheduled, &m.Forfeit, &m.Draw, &m.DetailedStats, &m.GameAdvantage,
			&m.LiveSupported, &m.LiveURL, &m.ModifiedAt, &m.RawData); err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}
		matches = append(matches, &m)
	}

	return matches, nil
}

// GetMatchesByDate retrieves matches for a specific date
func (s *MatchService) GetMatchesByDate(ctx context.Context, date, gameAcronym string) ([]*models.Match, error) {
	cacheKey := cache.MatchesKey(date, gameAcronym)
	
	// Try cache
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		var matches []*models.Match
		if err := json.Unmarshal([]byte(cached), &matches); err == nil {
			return matches, nil
		}
	}

	// Parse date
	startDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format")
	}
	endDate := startDate.AddDate(0, 0, 1)

	// Query database
	query := `SELECT id, created_at, panda_id, name, slug, status, match_type, number_of_games,
	                 begin_at, end_at, scheduled_at, original_scheduled_at, tournament_id, serie_id, league_id,
	                 winner_id, winner_type, rescheduled, forfeit, draw, detailed_stats, game_advantage,
	                 live_supported, live_url, modified_at, raw_data
	         FROM public.matches WHERE begin_at >= $1 AND begin_at < $2`

	args := []interface{}{startDate, endDate}

	if gameAcronym != "" {
		query += ` AND tournament_id IN (SELECT id FROM public.tournaments WHERE videogame_id = (SELECT id FROM public.games WHERE acronym = $3))`
		args = append(args, gameAcronym)
	}

	query += ` ORDER BY begin_at ASC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query matches: %w", err)
	}
	defer rows.Close()

	var matches []*models.Match
	for rows.Next() {
		var m models.Match
		if err := rows.Scan(&m.ID, &m.CreatedAt, &m.PandaID, &m.Name, &m.Slug, &m.Status, &m.MatchType, &m.NumberOfGames,
			&m.BeginAt, &m.EndAt, &m.ScheduledAt, &m.OriginalScheduledAt, &m.TournamentID, &m.SerieID, &m.LeagueID,
			&m.WinnerID, &m.WinnerType, &m.Rescheduled, &m.Forfeit, &m.Draw, &m.DetailedStats, &m.GameAdvantage,
			&m.LiveSupported, &m.LiveURL, &m.ModifiedAt, &m.RawData); err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}
		matches = append(matches, &m)
	}

	// Cache for 5 minutes
	if data, err := json.Marshal(matches); err == nil {
		s.cache.Set(ctx, cacheKey, string(data), 5*time.Minute)
	}

	return matches, nil
}

// GetMatch retrieves a single match by ID
func (s *MatchService) GetMatch(ctx context.Context, id int64) (*models.Match, error) {
	var m models.Match
	err := s.db.QueryRow(ctx,
		`SELECT id, created_at, panda_id, name, slug, status, match_type, number_of_games,
		        begin_at, end_at, scheduled_at, original_scheduled_at, tournament_id, serie_id, league_id,
		        winner_id, winner_type, rescheduled, forfeit, draw, detailed_stats, game_advantage,
		        live_supported, live_url, modified_at, raw_data
		 FROM public.matches WHERE id = $1`,
		id,
	).Scan(&m.ID, &m.CreatedAt, &m.PandaID, &m.Name, &m.Slug, &m.Status, &m.MatchType, &m.NumberOfGames,
		&m.BeginAt, &m.EndAt, &m.ScheduledAt, &m.OriginalScheduledAt, &m.TournamentID, &m.SerieID, &m.LeagueID,
		&m.WinnerID, &m.WinnerType, &m.Rescheduled, &m.Forfeit, &m.Draw, &m.DetailedStats, &m.GameAdvantage,
		&m.LiveSupported, &m.LiveURL, &m.ModifiedAt, &m.RawData)

	if err != nil {
		return nil, fmt.Errorf("match not found")
	}

	return &m, nil
}

// UpsertMatch creates or updates a match (for PandaScore sync)
func (s *MatchService) UpsertMatch(ctx context.Context, pandaID int64, name string, tournamentID *int64) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO public.matches (panda_id, name, tournament_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (panda_id) DO UPDATE SET modified_at = NOW()`,
		pandaID, name, tournamentID,
	)

	if err != nil {
		return fmt.Errorf("failed to upsert match: %w", err)
	}

	// Invalidate cache (matches cache is short-lived, will expire anyway)
	return nil
}
