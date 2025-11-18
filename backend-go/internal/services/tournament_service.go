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

type TournamentService struct {
	db    *pgxpool.Pool
	cache *cache.RedisCache
}

func NewTournamentService(db *pgxpool.Pool, redisCache *cache.RedisCache) *TournamentService {
	return &TournamentService{
		db:    db,
		cache: redisCache,
	}
}

// GetTournaments retrieves tournaments with optional filters
func (s *TournamentService) GetTournaments(ctx context.Context, filter *models.TournamentFilter) ([]*models.DatabaseTournament, error) {
	// Try cache first
	cacheKey := cache.TournamentsKey(filter.GameAcronym)
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		var tournaments []*models.DatabaseTournament
		if err := json.Unmarshal([]byte(cached), &tournaments); err == nil {
			return tournaments, nil
		}
	}

	// Build query
	query := `SELECT id, created_at, panda_id, name, slug, type, status, begin_at, end_at,
	         region, tier, prizepool, has_bracket, videogame_id, league_id, serie_id, winner_id, modified_at, raw_data
	         FROM public.tournaments WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	// Add videogame filter by acronym
	if filter.GameAcronym != "" {
		query += fmt.Sprintf(` AND videogame_id = (SELECT id FROM public.games WHERE acronym = $%d)`, argIndex)
		args = append(args, filter.GameAcronym)
		argIndex++
	}

	// Add status filter
	if filter.Status != nil {
		query += fmt.Sprintf(` AND status = $%d`, argIndex)
		args = append(args, *filter.Status)
		argIndex++
	}

	// Add tier filter
	if filter.Tier != nil {
		query += fmt.Sprintf(` AND tier = $%d`, argIndex)
		args = append(args, *filter.Tier)
		argIndex++
	}

	query += ` ORDER BY begin_at DESC LIMIT $` + fmt.Sprintf("%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, filter.Limit, filter.Offset)

	// Query database
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tournaments: %w", err)
	}
	defer rows.Close()

	var tournaments []*models.DatabaseTournament
	for rows.Next() {
		var t models.DatabaseTournament
		if err := rows.Scan(&t.ID, &t.CreatedAt, &t.PandaID, &t.Name, &t.Slug, &t.Type, &t.Status, &t.BeginAt, &t.EndAt,
			&t.Region, &t.Tier, &t.Prizepool, &t.HasBracket, &t.VideogameID, &t.LeagueID, &t.SerieID, &t.WinnerID, &t.ModifiedAt, &t.RawData); err != nil {
			return nil, fmt.Errorf("failed to scan tournament: %w", err)
		}
		tournaments = append(tournaments, &t)
	}

	// Cache for 5 minutes
	if data, err := json.Marshal(tournaments); err == nil {
		s.cache.Set(ctx, cacheKey, string(data), 5*time.Minute)
	}

	return tournaments, nil
}

// GetTournament retrieves a single tournament by ID
func (s *TournamentService) GetTournament(ctx context.Context, id int64) (*models.DatabaseTournament, error) {
	var t models.DatabaseTournament
	err := s.db.QueryRow(ctx,
		`SELECT id, created_at, panda_id, name, slug, type, status, begin_at, end_at,
		        region, tier, prizepool, has_bracket, videogame_id, league_id, serie_id, winner_id, modified_at, raw_data
		 FROM public.tournaments WHERE id = $1`,
		id,
	).Scan(&t.ID, &t.CreatedAt, &t.PandaID, &t.Name, &t.Slug, &t.Type, &t.Status, &t.BeginAt, &t.EndAt,
		&t.Region, &t.Tier, &t.Prizepool, &t.HasBracket, &t.VideogameID, &t.LeagueID, &t.SerieID, &t.WinnerID, &t.ModifiedAt, &t.RawData)

	if err != nil {
		return nil, fmt.Errorf("tournament not found")
	}

	return &t, nil
}

// UpsertTournament creates or updates a tournament (for PandaScore sync)
func (s *TournamentService) UpsertTournament(ctx context.Context, pandaID int64, name string, videogameID int64) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO public.tournaments (panda_id, name, videogame_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (panda_id) DO UPDATE SET modified_at = NOW()`,
		pandaID, name, videogameID,
	)

	if err != nil {
		return fmt.Errorf("failed to upsert tournament: %w", err)
	}

	// Invalidate cache
	games, _ := s.getAllGameAcronyms(ctx)
	for _, acronym := range games {
		s.cache.Del(ctx, cache.TournamentsKey(acronym))
	}

	return nil
}

// Helper to get all game acronyms for cache invalidation
func (s *TournamentService) getAllGameAcronyms(ctx context.Context) ([]string, error) {
	rows, err := s.db.Query(ctx, "SELECT acronym FROM public.games")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acronyms []string
	for rows.Next() {
		var acronym string
		if err := rows.Scan(&acronym); err != nil {
			continue
		}
		acronyms = append(acronyms, acronym)
	}

	return acronyms, nil
}
