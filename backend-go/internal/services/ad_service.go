package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

type AdService struct {
	db     *pgxpool.Pool      // For backward compatibility
	gormDB *database.Database // For GORM queries
	Cache  *cache.RedisCache  // Exported for handler access
}

// NewAdService creates a new AdService with pgxpool
func NewAdService(db *pgxpool.Pool, redisCache *cache.RedisCache) *AdService {
	return &AdService{
		db:    db,
		Cache: redisCache,
	}
}

// NewAdServiceWithGORM creates a new AdService with GORM
func NewAdServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache) *AdService {
	return &AdService{
		gormDB: gormDB,
		Cache:  redisCache,
	}
}

// GetAllAds retrieves all ads ordered by position
func (s *AdService) GetAllAds(ctx context.Context) ([]*models.Ad, error) {
	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		var ads []*models.Ad
		if err := s.gormDB.WithContext(ctx).
			Order("position ASC").
			Find(&ads).Error; err != nil {
			return nil, fmt.Errorf("failed to query ads using GORM: %w", err)
		}
		return ads, nil
	}

	// Fallback to pgxpool
	if s.db == nil {
		return nil, fmt.Errorf("database connection is nil")
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, created_at, title, position, type, url, redirect_link
		 FROM public.ads ORDER BY position ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query ads from pgxpool: %w", err)
	}
	defer rows.Close()

	var ads []*models.Ad
	for rows.Next() {
		var ad models.Ad
		var title, adType, url, redirectLink string
		var position int16

		if err := rows.Scan(&ad.ID, &ad.CreatedAt, &title, &position, &adType, &url, &redirectLink); err != nil {
			return nil, fmt.Errorf("failed to scan ad: %w", err)
		}

		// Convert to pointers
		ad.Title = &title
		ad.Position = &position
		ad.Type = &adType
		ad.URL = &url
		ad.RedirectLink = &redirectLink

		ads = append(ads, &ad)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating ads: %w", err)
	}

	return ads, nil
}
