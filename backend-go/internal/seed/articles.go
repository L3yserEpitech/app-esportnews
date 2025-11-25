package seed

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
)

// ArticleData represents the JSON structure of articles from Supabase export
type ArticleData struct {
	Idx            int64          `json:"idx"`
	ID             int64          `json:"id"`
	CreatedAt      string         `json:"created_at"`
	Slug           *string        `json:"slug"`
	Tags           []string       `json:"tags"`
	Title          *string        `json:"title"`
	Views          int32          `json:"views"`
	Author         *string        `json:"author"`
	Content        *string        `json:"content"`
	Category       *string        `json:"category"`
	Subtitle       *string        `json:"subtitle"`
	Description    *string        `json:"description"`
	ContentBlack   *string        `json:"content_black"`
	ContentWhite   *string        `json:"content_white"`
	FeaturedImage  *string        `json:"featuredImage"`
	VideoURL       *string        `json:"videoUrl"`
	VideoType      *string        `json:"videoType"`
	Credit         *string        `json:"credit"`
}

// SeedResult contains statistics about the seeding operation
type SeedResult struct {
	Inserted int
	Skipped  int
	Total    int
}

// LoadArticles reads and parses the JSON file containing articles
func LoadArticles(jsonPath string) ([]ArticleData, error) {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var articles []ArticleData
	if err := json.Unmarshal(data, &articles); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return articles, nil
}

// ValidateArticles checks that all articles have required fields
func ValidateArticles(articles []ArticleData) error {
	if len(articles) == 0 {
		return fmt.Errorf("no articles to import")
	}

	for i, article := range articles {
		// Check required fields
		if article.Slug == nil || strings.TrimSpace(*article.Slug) == "" {
			return fmt.Errorf("article at index %d: missing or empty slug", i)
		}

		if article.Title == nil || strings.TrimSpace(*article.Title) == "" {
			return fmt.Errorf("article at index %d (%s): missing or empty title", i, *article.Slug)
		}

		// Validate created_at timestamp
		if article.CreatedAt == "" {
			return fmt.Errorf("article at index %d (%s): missing created_at", i, *article.Slug)
		}

		// Try parsing the timestamp to ensure it's valid
		if _, err := time.Parse("2006-01-02 15:04:05.999999-07", article.CreatedAt); err != nil {
			// Try alternative format without timezone
			if _, err := time.Parse("2006-01-02 15:04:05.999999", article.CreatedAt); err != nil {
				return fmt.Errorf("article at index %d (%s): invalid created_at format: %v", i, *article.Slug, err)
			}
		}
	}

	return nil
}

// SeedArticles inserts articles into the database with conflict handling
func SeedArticles(db *gorm.DB, articles []ArticleData) (*SeedResult, error) {
	result := &SeedResult{
		Inserted: 0,
		Skipped:  0,
	}

	for i, articleData := range articles {
		// Parse timestamp
		var createdAt time.Time
		var err error

		// Try parsing with timezone first
		createdAt, err = time.Parse("2006-01-02 15:04:05.999999-07", articleData.CreatedAt)
		if err != nil {
			// Try without timezone
			createdAt, err = time.Parse("2006-01-02 15:04:05.999999", articleData.CreatedAt)
			if err != nil {
				return nil, fmt.Errorf("failed to parse timestamp for article at index %d: %w", i, err)
			}
		}

		// Check if article with this slug already exists
		if articleData.Slug != nil {
			var existingArticle models.Article
			checkErr := db.Where("slug = ?", *articleData.Slug).First(&existingArticle).Error
			if checkErr == nil {
				// Article already exists, skip it
				result.Skipped++
				continue
			} else if checkErr != gorm.ErrRecordNotFound {
				// Some other error occurred
				return nil, fmt.Errorf("failed to check article '%s': %w", *articleData.Slug, checkErr)
			}
		}

			// Build tags array string for PostgreSQL
		var tagsSQL string
		if len(articleData.Tags) > 0 {
			// Convert tags array to PostgreSQL format with proper escaping
			escapedTags := make([]string, len(articleData.Tags))
			for j, tag := range articleData.Tags {
				// Escape single quotes by doubling them for SQL
				escapedTags[j] = "'" + strings.ReplaceAll(tag, "'", "''") + "'"
			}
			tagsSQL = "ARRAY[" + strings.Join(escapedTags, ",") + "]"
		} else {
			tagsSQL = "ARRAY[]::text[]"
		}

		// Use raw SQL for insertion to properly handle the PostgreSQL array type
		// This avoids GORM's type conversion issues with arrays
		sql := `INSERT INTO articles (id, created_at, slug, tags, title, views, author, content, category,
		        subtitle, description, content_black, content_white, "featuredImage", "videoUrl", "videoType", credit)
		       VALUES (?, ?, ?, ` + tagsSQL + `, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		       ON CONFLICT (slug) DO NOTHING`

		err = db.Exec(sql,
			articleData.ID,
			createdAt,
			articleData.Slug,
			articleData.Title,
			articleData.Views,
			articleData.Author,
			articleData.Content,
			articleData.Category,
			articleData.Subtitle,
			articleData.Description,
			articleData.ContentBlack,
			articleData.ContentWhite,
			articleData.FeaturedImage,
			articleData.VideoURL,
			articleData.VideoType,
			articleData.Credit,
		).Error

		if err != nil {
			// Check if it's a duplicate key error (UNIQUE constraint on slug)
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
				result.Skipped++
				continue
			}
			return nil, fmt.Errorf("failed to insert article '%s': %w", *articleData.Slug, err)
		}

		result.Inserted++
	}

	// Count total articles in database using raw SQL to avoid table name confusion
	var total int64
	if err := db.Raw("SELECT COUNT(*) FROM articles").Scan(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count articles: %w", err)
	}
	result.Total = int(total)

	return result, nil
}
