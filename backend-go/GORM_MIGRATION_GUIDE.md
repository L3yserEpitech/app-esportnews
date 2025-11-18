# GORM Migration Guide - ArticleService Example

## Overview

This document outlines the GORM migration strategy used in ArticleService as a template for migrating other services.

## Architecture

The ArticleService supports **dual-mode operation**:
- **pgxpool Mode**: Original raw SQL queries (backward compatible)
- **GORM Mode**: Type-safe GORM queries (new code path)

## Implementation Pattern

### 1. Service Structure

```go
type ArticleService struct {
    db     *pgxpool.Pool        // For backward compatibility
    gormDB *database.Database   // For GORM queries
    cache  *cache.RedisCache
}
```

### 2. Constructor Functions

Two factory functions allow initialization with either pgxpool or GORM:

```go
// Original: uses pgxpool
func NewArticleService(db *pgxpool.Pool, redisCache *cache.RedisCache) *ArticleService

// New: uses GORM
func NewArticleServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache) *ArticleService
```

### 3. Method Implementation Pattern

Each method checks if GORM is available and uses it, otherwise falls back to pgxpool:

```go
func (s *ArticleService) GetArticles(ctx context.Context, limit int, offset int) ([]*models.Article, error) {
    // Use GORM if available
    if s.gormDB != nil {
        var articles []*models.Article
        if err := s.gormDB.WithContext(ctx).
            Order("created_at DESC").
            Limit(limit).
            Offset(offset).
            Find(&articles).Error; err != nil {
            return nil, fmt.Errorf("failed to query articles: %w", err)
        }
        return articles, nil
    }

    // Fallback to pgxpool (original implementation)
    // ... existing code ...
}
```

## Key Benefits

1. **Zero Breaking Changes**: Existing code continues to work with pgxpool
2. **Gradual Migration**: New code can use GORM while old code remains unchanged
3. **Type Safety**: GORM provides compile-time type checking vs runtime errors
4. **Performance**: GORM can be optimized independently of pgxpool
5. **Test Coverage**: Easy to test both paths independently

## GORM Query Examples Used in ArticleService

### Find with Conditions

```go
// Get articles with pagination
s.gormDB.WithContext(ctx).
    Order("created_at DESC").
    Limit(limit).
    Offset(offset).
    Find(&articles)

// Get single article by slug
s.gormDB.WithContext(ctx).
    Where("slug = ?", slug).
    First(&a)

// Get articles with array overlap (PostgreSQL)
s.gormDB.WithContext(ctx).
    Where("slug != ? AND tags && ?", slug, tags).
    Order("created_at DESC").
    Limit(limit).
    Find(&articles)
```

### Updates with GORM

```go
// Increment views counter
s.gormDB.WithContext(ctx).Model(&models.Article{}).
    Where("slug = ?", slug).
    Update("views", gorm.Expr("views + ?", 1))
```

## Migration Checklist

When migrating other services (GameService, AuthService, etc.):

- [ ] Add GORM field to service struct
- [ ] Create `NewServiceWithGORM()` constructor
- [ ] Update all methods with dual-mode support
- [ ] Add cache invalidation for GORM path (if applicable)
- [ ] Write tests for GORM path
- [ ] Test against real database
- [ ] Performance benchmark against pgxpool

## Current Status

### ✅ Migrated Services
- ArticleService (all 3 methods)

### ⏳ Pending Migration
- GameService
- AuthService
- NotificationService
- MatchService
- TournamentService
- TeamService

## Testing

For unit tests:
1. Use test database (PostgreSQL or SQLite)
2. Test GORM path separately from pgxpool path
3. Verify caching behavior works in both paths
4. Test error handling (gorm.ErrRecordNotFound vs pgx errors)

## Configuration

GORM is initialized in `internal/config/config.go`:

```go
// Initialize both pgxpool and GORM for dual-mode database access
func InitDBWithGORM(cfg *Config, log *logrus.Logger) (*pgxpool.Pool, *database.Database, error) {
    // ... initialization code ...
}
```

Both connections are opened in `cmd/server/main.go` and available throughout the application.

## Performance Considerations

- **GORM** adds slight overhead due to reflection, but provides better ergonomics
- **caching** layer (Redis) is not affected by database layer
- Both paths use same underlying PostgreSQL connection pool
- Query performance should be similar (GORM generates similar SQL)

## References

- GORM Docs: https://gorm.io/docs/
- PostgreSQL Array Operations: https://www.postgresql.org/docs/current/arrays.html
- Go Context: https://pkg.go.dev/context

---

**Last Updated**: November 18, 2024
**Status**: ArticleService GORM migration complete ✓
