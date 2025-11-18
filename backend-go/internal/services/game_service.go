package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

type GameService struct {
	db     *pgxpool.Pool      // For backward compatibility
	gormDB *database.Database // For GORM queries
	Cache  *cache.RedisCache  // Exported for handler access
}

// NewGameService creates a new GameService with pgxpool
func NewGameService(db *pgxpool.Pool, redisCache *cache.RedisCache) *GameService {
	return &GameService{
		db:    db,
		Cache: redisCache,
	}
}

// NewGameServiceWithGORM creates a new GameService with GORM
func NewGameServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache) *GameService {
	return &GameService{
		gormDB: gormDB,
		Cache:  redisCache,
	}
}

// GetAllGames retrieves all games ordered by name
func (s *GameService) GetAllGames(ctx context.Context) ([]*models.Game, error) {
	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		var games []*models.Game
		if err := s.gormDB.WithContext(ctx).
			Order("name").
			Find(&games).Error; err != nil {
			return nil, fmt.Errorf("failed to query games: %w", err)
		}
		return games, nil
	}

	// Fallback to pgxpool
	rows, err := s.db.Query(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("failed to query games: %w", err)
	}
	defer rows.Close()

	var games []*models.Game
	for rows.Next() {
		var game models.Game
		if err := rows.Scan(&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName); err != nil {
			return nil, fmt.Errorf("failed to scan game: %w", err)
		}
		games = append(games, &game)
	}

	return games, nil
}

// GetGameByID retrieves a single game by ID
func (s *GameService) GetGameByID(ctx context.Context, id string) (*models.Game, error) {
	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		var game models.Game
		if err := s.gormDB.WithContext(ctx).
			Where("id = ?", id).
			First(&game).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("game not found")
			}
			return nil, fmt.Errorf("failed to query game: %w", err)
		}
		return &game, nil
	}

	// Fallback to pgxpool
	var game models.Game
	err := s.db.QueryRow(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games WHERE id = $1", id).Scan(
		&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName,
	)
	if err != nil {
		return nil, fmt.Errorf("game not found")
	}

	return &game, nil
}

// GetGameByAcronym retrieves a single game by acronym
func (s *GameService) GetGameByAcronym(ctx context.Context, acronym string) (*models.Game, error) {
	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		var game models.Game
		if err := s.gormDB.WithContext(ctx).
			Where("acronym = ?", acronym).
			First(&game).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("game not found")
			}
			return nil, fmt.Errorf("failed to query game: %w", err)
		}
		return &game, nil
	}

	// Fallback to pgxpool
	var game models.Game
	err := s.db.QueryRow(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games WHERE acronym = $1", acronym).Scan(
		&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName,
	)
	if err != nil {
		return nil, fmt.Errorf("game not found")
	}

	return &game, nil
}
