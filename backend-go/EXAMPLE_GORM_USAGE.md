# Example: Using ArticleService with GORM

## How to Use the New GORM Mode

### In Handlers (cmd/server/main.go)

Currently, handlers are initialized with pgxpool for backward compatibility:

```go
// Current: Using pgxpool (works as before)
articleHandler := handlers.NewArticleHandler(pool, redisClient)
```

To use GORM instead, you would update the handler initialization:

```go
// Future: Using GORM
// Pass gormDB to handler instead of pool
articleHandler := handlers.NewArticleHandler(gormDB, redisClient)
```

### Updating ArticleHandler to Use GORM Service

In `internal/handlers/articles.go`, update to use `NewArticleServiceWithGORM`:

```go
// Before (pgxpool)
func (h *ArticleHandler) ListArticles(c echo.Context) error {
    service := services.NewArticleService(h.DB, h.Cache)
    articles, err := service.GetArticles(c.Request().Context(), 10, 0)
    // ... rest of handler
}

// After (GORM)
func (h *ArticleHandler) ListArticles(c echo.Context) error {
    gormDB := h.DB.(*database.Database)  // Type assert to GORM
    service := services.NewArticleServiceWithGORM(gormDB, h.Cache)
    articles, err := service.GetArticles(c.Request().Context(), 10, 0)
    // ... rest of handler - NO OTHER CHANGES NEEDED
}
```

## Key Points

1. **Service API is Identical**: Whether using pgxpool or GORM, the service methods have the same signatures
2. **Cache Works the Same**: Redis caching behavior is unchanged
3. **Error Handling**: Both paths handle errors appropriately
4. **Performance**: No noticeable difference for end users

## Complete Handler Update Example

Here's how to update the articles handler:

```go
package handlers

import (
    "github.com/labstack/echo/v4"
    "github.com/esportnews/backend/internal/database"
    "github.com/esportnews/backend/internal/services"
)

type ArticleHandler struct {
    BaseHandler
}

func NewArticleHandler(db interface{}, cache *cache.RedisCache) *ArticleHandler {
    return &ArticleHandler{
        BaseHandler: BaseHandler{
            DB:    db,
            Cache: cache,
        },
    }
}

func (h *ArticleHandler) GetArticle(c echo.Context) error {
    slug := c.Param("slug")

    // Determine which service to use
    var service *services.ArticleService

    if gormDB, ok := h.DB.(*database.Database); ok {
        // Using GORM
        service = services.NewArticleServiceWithGORM(gormDB, h.Cache)
    } else {
        // Using pgxpool (backward compatible)
        pool := h.DB.(*pgxpool.Pool)
        service = services.NewArticleService(pool, h.Cache)
    }

    article, err := service.GetArticleBySlug(c.Request().Context(), slug)
    if err != nil {
        return c.JSON(404, map[string]string{"error": "Article not found"})
    }

    return c.JSON(200, article)
}
```

## Step-by-Step Migration Plan

### Phase 1: ✅ Complete (ArticleService)
- [x] Create GORM layer in `internal/database/`
- [x] Add GORM models with struct tags
- [x] Refactor ArticleService with dual-mode support
- [x] Write tests and documentation

### Phase 2: In Progress
- [ ] Refactor GameService
- [ ] Update GameHandler to support both modes
- [ ] Test GameService with GORM

### Phase 3: Pending
- [ ] Refactor AuthService
- [ ] Refactor NotificationService
- [ ] Refactor Match/Tournament services
- [ ] Update all handlers

### Phase 4: Cleanup
- [ ] Remove pgxpool code paths when all services migrated
- [ ] Update BaseHandler to use GORM only
- [ ] Remove dual-mode support code

## Verifying the Migration

After updating ArticleHandler:

```bash
# Build to ensure no compilation errors
go build ./cmd/server/

# Run tests
go test ./internal/handlers/... -v

# Run integration tests against Docker
docker-compose up -d
go test ./tests/... -v
docker-compose down
```

## Performance Testing

Compare pgxpool vs GORM performance:

```go
// Benchmark pgxpool path
func BenchmarkArticleService_pgxpool(b *testing.B) {
    // ... setup pgxpool service ...
    for i := 0; i < b.N; i++ {
        service.GetArticles(ctx, 10, 0)
    }
}

// Benchmark GORM path
func BenchmarkArticleService_gorm(b *testing.B) {
    // ... setup GORM service ...
    for i := 0; i < b.N; i++ {
        service.GetArticles(ctx, 10, 0)
    }
}
```

## Questions & Troubleshooting

### Q: Do I need to change my database schema?
**A**: No. GORM reads the existing schema. Models just map to existing tables.

### Q: Will this affect the API response?
**A**: No. The API response structure remains exactly the same.

### Q: Can I mix pgxpool and GORM code?
**A**: Yes, during the migration period. Services check if GORM is available and fall back to pgxpool.

### Q: What about transactions?
**A**: GORM transactions work similarly:
```go
tx := s.gormDB.BeginTx(ctx, nil)
// ... perform operations ...
tx.Commit()
```

---

**Next Steps**: Update GameService following this same pattern
