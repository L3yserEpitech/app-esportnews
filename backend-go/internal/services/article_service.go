package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

type ArticleService struct {
	db     *pgxpool.Pool      // For backward compatibility
	gormDB *database.Database // For GORM queries
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

// GetArticles retrieves articles with pagination and optional category filter
// If category is empty, returns all articles
func (s *ArticleService) GetArticles(ctx context.Context, limit int, offset int, category string, excludeNews ...bool) ([]*models.Article, error) {
	// Use GORM if available, otherwise fall back to pgxpool
	if s.gormDB != nil {
		shouldExcludeNews := len(excludeNews) > 0 && excludeNews[0]
		var articles []*models.Article
		query := s.gormDB.WithContext(ctx).Order("created_at DESC")

		if category != "" {
			// Filter by specific category
			query = query.Where("category = ?", category)
		} else if shouldExcludeNews {
			// Exclude "Actus" when excludeNews is true
			query = query.Where("category != ?", "Actus")
		}

		if err := query.Limit(limit).Offset(offset).Find(&articles).Error; err != nil {
			return nil, fmt.Errorf("failed to query articles: %w", err)
		}

		// Fallback for articles where Content is missing but ArticleContent exists
		for _, a := range articles {
			if (a.Content == nil || *a.Content == "") && (a.ArticleContent != nil && *a.ArticleContent != "") {
				a.Content = a.ArticleContent
			}
		}
		return articles, nil
	}

	// Fallback to pgxpool
	var rows pgx.Rows
	var err error

	if category != "" {
		rows, err = s.db.Query(ctx,
			`SELECT id, created_at, slug, tags, title, views, author, content, category, subtitle, description,
					content_black, content_white, "featuredImage", "videoUrl", "videoType", "article_content"
			 FROM public.articles WHERE category = $3 ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			limit, offset, category,
		)
	} else {
		rows, err = s.db.Query(ctx,
			`SELECT id, created_at, slug, tags, title, views, author, content, category, subtitle, description,
					content_black, content_white, "featuredImage", "videoUrl", "videoType", "article_content"
			 FROM public.articles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			limit, offset,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query articles: %w", err)
	}
	defer rows.Close()

	var articles []*models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.CreatedAt, &a.Slug, &a.Tags, &a.Title, &a.Views, &a.Author, &a.Content,
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType, &a.ArticleContent); err != nil {
			return nil, fmt.Errorf("failed to scan article: %w", err)
		}
		// Fallback: if Content is empty but ArticleContent is set (though not scanned here yet), we can't do much in pgx without query change.
		// However, for GORM path above (which is prioritized), we can fix it.
		articles = append(articles, &a)
	}

	return articles, nil
}

// CountArticles counts articles with optional category filter
// If category is empty, counts all articles
func (s *ArticleService) CountArticles(ctx context.Context, category string, excludeNews ...bool) (int64, error) {
	if s.gormDB != nil {
		shouldExcludeNews := len(excludeNews) > 0 && excludeNews[0]
		var count int64
		query := s.gormDB.WithContext(ctx).Model(&models.Article{})

		if category != "" {
			// Count specific category
			query = query.Where("category = ?", category)
		} else if shouldExcludeNews {
			// Exclude "Actus" when excludeNews is true
			query = query.Where("category != ?", "Actus")
		}

		if err := query.Count(&count).Error; err != nil {
			return 0, fmt.Errorf("failed to count articles: %w", err)
		}
		return count, nil
	}

	// Fallback to pgxpool
	var count int64
	var err error

	if category != "" {
		err = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM public.articles WHERE category = $1", category).Scan(&count)
	} else {
		err = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM public.articles").Scan(&count)
	}

	if err != nil {
		return 0, fmt.Errorf("failed to count articles: %w", err)
	}

	return count, nil
}

// GetArticleBySlug retrieves a single article by slug with caching
func (s *ArticleService) GetArticleBySlug(ctx context.Context, slug string) (*models.Article, error) {
	// Try cache first
	cacheKey := cache.ArticleKey(slug)
	cached, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		var article models.Article
		if err := json.Unmarshal([]byte(cached), &article); err == nil {
			// Check if cached article has content. If not, ignore cache to self-heal.
			if article.Content != nil && *article.Content != "" {
				return &article, nil
			}
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

		// Fallback: if Content is empty, use ArticleContent
		if (a.Content == nil || *a.Content == "") && (a.ArticleContent != nil && *a.ArticleContent != "") {
			a.Content = a.ArticleContent
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
			        content_black, content_white, "featuredImage", "videoUrl", "videoType", "article_content"
			 FROM public.articles WHERE slug = $1`,
			slug,
		).Scan(&a.ID, &a.CreatedAt, &a.Slug, &a.Tags, &a.Title, &a.Views, &a.Author, &a.Content,
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType, &a.ArticleContent)

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

// SearchArticles runs a full-text search over the articles table using the
// tsvector built by the 00013 migration, with a pg_trgm similarity branch
// as a fuzzy fallback for typos. Results are ranked by:
//
//	GREATEST(
//	  ts_rank_cd(search_vector, websearch_to_tsquery(q)) * 2.0,   -- exact term hits, weighted
//	  similarity(unaccent(title),       unaccent(q))   * 1.5,    -- fuzzy on title
//	  similarity(unaccent(description), unaccent(q))             -- fuzzy on description
//	)
//
// Then by created_at DESC as a tiebreaker so newer articles surface first.
//
// The category / excludeNews filters mirror GetArticles so the caller can
// scope the search to "Actus" (news page) or "everything except Actus"
// (articles page).
//
// An empty query returns no results — the caller should fall through to the
// regular paginated list when the user clears the search box.
func (s *ArticleService) SearchArticles(
	ctx context.Context,
	query string,
	category string,
	excludeNews bool,
	limit int,
) ([]*models.Article, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []*models.Article{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	// Cache hot queries for a minute. Articles change infrequently and the
	// search modal often re-issues the same query as the user navigates.
	cacheKey := cache.ArticleSearchKey(trimmed, category, excludeNews, limit)
	if s.cache != nil {
		if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
			var articles []*models.Article
			if jsonErr := json.Unmarshal([]byte(cached), &articles); jsonErr == nil {
				return articles, nil
			}
		}
	}

	if s.gormDB == nil {
		return nil, fmt.Errorf("article search requires GORM connection")
	}

	// Single query that combines weighted full-text search with a pg_trgm
	// fuzzy fallback. Both branches are GIN-indexed (see migration 00013).
	const sqlQuery = `
		WITH q AS (
			SELECT
				public.immutable_unaccent(?) AS raw,
				websearch_to_tsquery('french', public.immutable_unaccent(?)) AS tsq
		)
		SELECT a.*
		FROM public.articles a, q
		WHERE
			(
				(a.search_vector @@ q.tsq)
				OR (public.immutable_unaccent(coalesce(a.title, '')) % q.raw)
				OR (public.immutable_unaccent(coalesce(a.description, '')) % q.raw)
			)
			AND (
				CASE
					WHEN ?::text <> '' THEN a.category = ?
					WHEN ?::boolean THEN a.category IS DISTINCT FROM 'Actus'
					ELSE TRUE
				END
			)
		ORDER BY
			GREATEST(
				ts_rank_cd(a.search_vector, q.tsq) * 2.0,
				similarity(public.immutable_unaccent(coalesce(a.title, '')), q.raw) * 1.5,
				similarity(public.immutable_unaccent(coalesce(a.description, '')), q.raw)
			) DESC NULLS LAST,
			a.created_at DESC
		LIMIT ?
	`

	var articles []*models.Article
	if err := s.gormDB.WithContext(ctx).Raw(
		sqlQuery,
		trimmed, trimmed, // q.raw / q.tsq input
		category, category, // category filter
		excludeNews, // excludeNews flag
		limit,
	).Scan(&articles).Error; err != nil {
		return nil, fmt.Errorf("failed to run article search: %w", err)
	}

	// Mirror GetArticles' fallback for the legacy article_content column.
	for _, a := range articles {
		if (a.Content == nil || *a.Content == "") && (a.ArticleContent != nil && *a.ArticleContent != "") {
			a.Content = a.ArticleContent
		}
	}

	if articles == nil {
		articles = []*models.Article{}
	}

	if s.cache != nil {
		if data, err := json.Marshal(articles); err == nil {
			s.cache.Set(ctx, cacheKey, string(data), 1*time.Minute)
		}
	}

	return articles, nil
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

		// Fallback for Content
		for _, a := range articles {
			if (a.Content == nil || *a.Content == "") && (a.ArticleContent != nil && *a.ArticleContent != "") {
				a.Content = a.ArticleContent
			}
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
			&a.Category, &a.Subtitle, &a.Description, &a.ContentBlack, &a.ContentWhite, &a.FeaturedImage, &a.VideoURL, &a.VideoType, &a.ArticleContent); err != nil {
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

	// Auto-generate unique slug with validation
	slug, err := s.generateUniqueSlug(ctx, input.Title)
	if err != nil {
		return nil, fmt.Errorf("failed to generate unique slug: %w", err)
	}

	// Auto-generate content variants
	contentWhite := generateContentWhite(input.ArticleContent)
	contentBlack := generateContentBlack(input.ArticleContent)

	// Create article
	article := &models.Article{
		Title:          &input.Title,
		Subtitle:       input.Subtitle,
		Author:         &input.Author,
		ArticleContent: &input.ArticleContent,
		Content:        &input.ArticleContent, // Map "article_content" input to "content" column for compatibility
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

	// Invalidate every cached search result so a freshly published article
	// shows up immediately in the search modal instead of waiting on the
	// 1-minute search cache TTL.
	if s.cache != nil {
		s.cache.DelPattern(ctx, cache.ArticleSearchPattern)
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
		// Regenerate unique slug if title changed
		newSlug, err := s.generateUniqueSlugForUpdate(ctx, *input.Title, id)
		if err != nil {
			return nil, fmt.Errorf("failed to generate unique slug: %w", err)
		}
		updates["slug"] = newSlug
	}
	if input.Subtitle != nil {
		updates["subtitle"] = *input.Subtitle
	}
	if input.Author != nil {
		updates["author"] = *input.Author
	}
	if input.ArticleContent != nil {
		updates["article_content"] = *input.ArticleContent
		updates["content"] = *input.ArticleContent // Map "article_content" input to "content" column for compatibility
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
	if s.cache != nil {
		s.cache.DelPattern(ctx, cache.ArticleSearchPattern)
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
	if s.cache != nil {
		s.cache.DelPattern(ctx, cache.ArticleSearchPattern)
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

// generateUniqueSlug generates a unique slug for an article by checking database for conflicts
func (s *ArticleService) generateUniqueSlug(ctx context.Context, title string) (string, error) {
	// Define the checkExists callback that queries the database
	checkExists := func(slug string) (bool, error) {
		var count int64
		err := s.gormDB.WithContext(ctx).
			Model(&models.Article{}).
			Where("slug = ?", slug).
			Count(&count).Error

		if err != nil {
			return false, fmt.Errorf("failed to check slug existence: %w", err)
		}

		return count > 0, nil
	}

	// Use the utility function with 150 char limit (increased from 80)
	return utils.GenerateUniqueSlug(title, 150, checkExists)
}

// generateUniqueSlugForUpdate generates a unique slug for article update, excluding the current article
func (s *ArticleService) generateUniqueSlugForUpdate(ctx context.Context, title string, currentArticleID int64) (string, error) {
	// Define the checkExists callback that queries the database, excluding current article
	checkExists := func(slug string) (bool, error) {
		var count int64
		err := s.gormDB.WithContext(ctx).
			Model(&models.Article{}).
			Where("slug = ? AND id != ?", slug, currentArticleID).
			Count(&count).Error

		if err != nil {
			return false, fmt.Errorf("failed to check slug existence: %w", err)
		}

		return count > 0, nil
	}

	// Use the utility function with 150 char limit (increased from 80)
	return utils.GenerateUniqueSlug(title, 150, checkExists)
}
