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
	"github.com/esportnews/backend/internal/utils"
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

// --- ADMIN METHODS ---

// CreateArticle creates a new article with auto-generation of slug, content variants, etc.
func (s *ArticleService) CreateArticle(ctx context.Context, input *models.CreateArticleInput) (*models.Article, error) {
	if s.gormDB == nil {
		return nil, fmt.Errorf("GORM not initialized")
	}

	// Auto-generate slug
	slug := generateSlug(input.Title, 80, 10)

	// Auto-generate content variants
	contentWhite := generateContentWhite(input.ArticleContent)
	contentBlack := generateContentBlack(input.ArticleContent)

	// Create article
	article := &models.Article{
		Title:          &input.Title,
		Subtitle:       input.Subtitle,
		Author:         &input.Author,
		ArticleContent: &input.ArticleContent,
		ContentWhite:   &contentWhite,
		ContentBlack:   &contentBlack,
		Category:       input.Category,
		Tags:           models.StringArray(input.Tags),
		Description:    input.Description,
		FeaturedImage:  input.FeaturedImage,
		VideoURL:       input.VideoURL,
		VideoType:      input.VideoType,
		Credit:         input.Credit,
		Slug:           &slug,
		Views:          0,
	}

	if err := s.gormDB.WithContext(ctx).Create(article).Error; err != nil {
		return nil, fmt.Errorf("failed to create article: %w", err)
	}

	return article, nil
}

// UpdateArticle updates an existing article
func (s *ArticleService) UpdateArticle(ctx context.Context, id int64, input *models.UpdateArticleInput) (*models.Article, error) {
	if s.gormDB == nil {
		return nil, fmt.Errorf("GORM not initialized")
	}

	// Find existing article
	var article models.Article
	if err := s.gormDB.WithContext(ctx).First(&article, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("article not found")
		}
		return nil, fmt.Errorf("failed to query article: %w", err)
	}

	// Build updates map
	updates := make(map[string]interface{})

	if input.Title != nil {
		updates["title"] = *input.Title
		// Regenerate slug if title changed
		slug := generateSlug(*input.Title, 80, 10)
		updates["slug"] = slug
	}
	if input.Subtitle != nil {
		updates["subtitle"] = *input.Subtitle
	}
	if input.Author != nil {
		updates["author"] = *input.Author
	}
	if input.ArticleContent != nil {
		updates["article_content"] = *input.ArticleContent
		// Regenerate content variants
		updates["content_white"] = generateContentWhite(*input.ArticleContent)
		updates["content_black"] = generateContentBlack(*input.ArticleContent)
	}
	if input.Category != nil {
		updates["category"] = *input.Category
	}
	if input.Tags != nil {
		updates["tags"] = models.StringArray(input.Tags)
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}
	if input.FeaturedImage != nil {
		updates["featuredImage"] = *input.FeaturedImage
	}
	if input.VideoURL != nil {
		updates["videoUrl"] = *input.VideoURL
	}
	if input.VideoType != nil {
		updates["videoType"] = *input.VideoType
	}
	if input.Credit != nil {
		updates["credit"] = *input.Credit
	}

	// Apply updates
	if err := s.gormDB.WithContext(ctx).Model(&article).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update article: %w", err)
	}

	// Fetch updated article
	if err := s.gormDB.WithContext(ctx).First(&article, id).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch updated article: %w", err)
	}

	// Clear cache
	if article.Slug != nil {
		s.cache.Del(ctx, cache.ArticleKey(*article.Slug))
		s.cache.Del(ctx, cache.ArticleSimilarKey(*article.Slug))
	}

	return &article, nil
}

// DeleteArticle deletes an article by ID
func (s *ArticleService) DeleteArticle(ctx context.Context, id int64) error {
	if s.gormDB == nil {
		return fmt.Errorf("GORM not initialized")
	}

	// Find article first to get slug for cache clearing
	var article models.Article
	if err := s.gormDB.WithContext(ctx).First(&article, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("article not found")
		}
		return fmt.Errorf("failed to query article: %w", err)
	}

	// Delete article
	if err := s.gormDB.WithContext(ctx).Delete(&models.Article{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete article: %w", err)
	}

	// Clear cache
	if article.Slug != nil {
		s.cache.Del(ctx, cache.ArticleKey(*article.Slug))
		s.cache.Del(ctx, cache.ArticleSimilarKey(*article.Slug))
	}

	return nil
}

// GetArticleByID retrieves an article by ID (for admin editing)
func (s *ArticleService) GetArticleByID(ctx context.Context, id int64) (*models.Article, error) {
	if s.gormDB == nil {
		return nil, fmt.Errorf("GORM not initialized")
	}

	var article models.Article
	if err := s.gormDB.WithContext(ctx).First(&article, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("article not found")
		}
		return nil, fmt.Errorf("failed to query article: %w", err)
	}

	return &article, nil
}

// GetAllArticles retrieves all articles (for admin list)
func (s *ArticleService) GetAllArticles(ctx context.Context) ([]*models.Article, error) {
	if s.gormDB == nil {
		return nil, fmt.Errorf("GORM not initialized")
	}

	var articles []*models.Article
	if err := s.gormDB.WithContext(ctx).
		Order("created_at DESC").
		Find(&articles).Error; err != nil {
		return nil, fmt.Errorf("failed to query articles: %w", err)
	}

	return articles, nil
}

// IncrementViews increments the view count for an article
func (s *ArticleService) IncrementViews(ctx context.Context, slug string) error {
	if s.gormDB == nil {
		return fmt.Errorf("GORM not initialized")
	}

	if err := s.gormDB.WithContext(ctx).
		Model(&models.Article{}).
		Where("slug = ?", slug).
		Update("views", gorm.Expr("views + ?", 1)).Error; err != nil {
		return fmt.Errorf("failed to increment views: %w", err)
	}

	return nil
}

// Helper functions

func generateSlug(title string, maxChars, maxWords int) string {
	return utils.GenerateSlug(title, maxChars, maxWords)
}

func generateContentWhite(content string) string {
	return utils.GenerateContentWhite(content)
}

func generateContentBlack(content string) string {
	return utils.GenerateContentBlack(content)
}
