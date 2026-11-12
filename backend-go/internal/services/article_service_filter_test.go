package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

func articleFilterService(t *testing.T) (*ArticleService, *gorm.DB) {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.Article{}))

	cleanup := func() { require.NoError(t, db.Exec(`DELETE FROM articles`).Error) }
	cleanup()
	t.Cleanup(cleanup)

	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	game3, game5 := int64(3), int64(5)
	seeds := []struct {
		slug, category string
		game           *int64
	}{
		{"s1", "Actus", &game3},
		{"s2", "Actus", &game5},
		{"s3", "Actus", nil},
		{"s4", "Analyse", &game3},
	}
	for i, seed := range seeds {
		slug, category := seed.slug, seed.category
		require.NoError(t, db.Create(&models.Article{
			Slug: &slug, Category: &category, GameID: seed.game,
			CreatedAt: base.Add(-time.Duration(i) * time.Hour),
		}).Error)
	}
	return NewArticleServiceWithGORM(&database.Database{DB: db}, nil), db
}

func slugsOf(rows []*models.Article) []string {
	out := []string{}
	for _, a := range rows {
		out = append(out, *a.Slug)
	}
	return out
}

// Des dates égales ne garantissent aucun ordre : le plus grand id passe devant.
func TestGetArticlesBreaksDateTiesOnID(t *testing.T) {
	s, db := articleFilterService(t)
	ctx := context.Background()

	require.NoError(t, db.Exec(`UPDATE articles SET created_at = '2026-01-01T12:00:00Z'`).Error)

	rows, err := s.GetArticles(ctx, 10, 0, ArticleFilter{})
	require.NoError(t, err)
	assert.Equal(t, []string{"s4", "s3", "s2", "s1"}, slugsOf(rows))
}
