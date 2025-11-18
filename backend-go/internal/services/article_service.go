package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

type ArticleService struct {
	db     *pgxpool.Pool        // For backward compatibility
	gormDB *database.Database   // For GORM queries
	cache  *cache.RedisCache
}

// NewArticleService creates a new ArticleService with pgxpool
func NewArticleService(db *pgxpool.Pool, redisCache *cache.RedisCache) *ArticleService {
	return &ArticleService{
		db:    db,
		cache: redisCache,
	}
}

// NewArticleServiceWithGORM creates a new ArticleService with GORM
func NewArticleServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache) *ArticleService {
	return &ArticleService{
		gormDB: gormDB,
		cache:  redisCache,
	}
}

// GetArticles retrieves articles with pagination
func (s *ArticleService) GetArticles(ctx context.Context, limit int, offset int) ([]*models.Article, error) {
	// Use GORM if available, otherwise fall back to pgxpool
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

	// Fallback to pgxpool
	rows, err := s.db.Query(ctx,
		`SELECT id, created_at, slug, tags, title, views, author, content, category, subtitle, description,
		        content_black, content_white, "featuredImage", "videoUrl", "videoType"
		 FROM public.articles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query articles: %w", err)
	}
	defer rows.Close()

	var articles []*models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.CreatedAt, &a.Slug, &a.Tags, &a.Title, &a.Views, &a.Author, &a.Content,
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType); err != nil {
			return nil, fmt.Errorf("failed to scan article: %w", err)
		}
		articles = append(articles, &a)
	}

	return articles, nil
}

// GetArticleBySlug retrieves a single article by slug with caching
func (s *ArticleService) GetArticleBySlug(ctx context.Context, slug string) (*models.Article, error) {
	// Try cache first
	cacheKey := cache.ArticleKey(slug)
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		var article models.Article
		if err := json.Unmarshal([]byte(cached), &article); err == nil {
			return &article, nil
		}
	}

	var a models.Article

	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		// Query with GORM
		if err := s.gormDB.WithContext(ctx).
			Where("slug = ?", slug).
			First(&a).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("article not found")
			}
			return nil, fmt.Errorf("failed to query article: %w", err)
		}

		// Increment views asynchronously
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			s.gormDB.WithContext(ctx).Model(&models.Article{}).
				Where("slug = ?", slug).
				Update("views", gorm.Expr("views + ?", 1))
		}()
	} else {
		// Fallback to pgxpool
		err = s.db.QueryRow(ctx,
			`SELECT id, created_at, slug, tags, title, views, author, content, category, subtitle, description,
			        content_black, content_white, "featuredImage", "videoUrl", "videoType"
			 FROM public.articles WHERE slug = $1`,
			slug,
		).Scan(&a.ID, &a.CreatedAt, &a.Slug, &a.Tags, &a.Title, &a.Views, &a.Author, &a.Content,
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType)

		if err != nil {
			return nil, fmt.Errorf("article not found")
		}

		// Increment views
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			s.db.Exec(ctx, "UPDATE public.articles SET views = views + 1 WHERE slug = $1", slug)
		}()
	}

	// Cache for 1 hour
	if data, err := json.Marshal(a); err == nil {
		s.cache.Set(ctx, cacheKey, string(data), 1*time.Hour)
	}

	return &a, nil
}

// GetSimilarArticles retrieves articles with similar tags
func (s *ArticleService) GetSimilarArticles(ctx context.Context, slug string, limit int) ([]*models.Article, error) {
	// Try cache
	cacheKey := cache.ArticleSimilarKey(slug)
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		var articles []*models.Article
		if err := json.Unmarshal([]byte(cached), &articles); err == nil {
			return articles, nil
		}
	}

	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		// Get current article tags
		var currentArticle models.Article
		if err := s.gormDB.WithContext(ctx).
			Select("tags").
			Where("slug = ?", slug).
			First(&currentArticle).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("article not found")
			}
			return nil, fmt.Errorf("failed to query article: %w", err)
		}

		// Query similar articles (with overlapping tags)
		var articles []*models.Article
		if err := s.gormDB.WithContext(ctx).
			Where("slug != ? AND tags && ?", slug, currentArticle.Tags).
			Order("created_at DESC").
			Limit(limit).
			Find(&articles).Error; err != nil {
			return nil, fmt.Errorf("failed to query similar articles: %w", err)
		}

		// Cache for 1 hour
		if data, err := json.Marshal(articles); err == nil {
			s.cache.Set(ctx, cacheKey, string(data), 1*time.Hour)
		}

		return articles, nil
	}

	// Fallback to pgxpool
	// Get current article tags
	var tags []string
	err = s.db.QueryRow(ctx, "SELECT tags FROM public.articles WHERE slug = $1", slug).Scan(&tags)
	if err != nil {
		return nil, fmt.Errorf("article not found")
	}

	// Query similar articles (with overlapping tags)
	rows, err := s.db.Query(ctx,
		`SELECT id, created_at, slug, tags, title, views, author, content, category, subtitle, description,
		        content_black, content_white, "featuredImage", "videoUrl", "videoType"
		 FROM public.articles
		 WHERE slug != $1 AND tags && $2
		 ORDER BY created_at DESC LIMIT $3`,
		slug, tags, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query similar articles: %w", err)
	}
	defer rows.Close()

	var articles []*models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.CreatedAt, &a.Slug, &a.Tags, &a.Title, &a.Views, &a.Author, &a.Content,
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType); err != nil {
			return nil, fmt.Errorf("failed to scan article: %w", err)
		}
		articles = append(articles, &a)
	}

	// Cache for 1 hour
	if data, err := json.Marshal(articles); err == nil {
		s.cache.Set(ctx, cacheKey, string(data), 1*time.Hour)
	}

	return articles, nil
}
