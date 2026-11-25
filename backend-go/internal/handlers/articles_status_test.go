package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
)

func seedStatusArticle(t *testing.T, db *gorm.DB, slug, status string, age time.Duration) {
	t.Helper()
	title, category := "Titre "+slug, "Actus"
	a := models.Article{
		Slug: &slug, Title: &title, Category: &category, Status: status,
		Tags: models.StringArray{"commun"}, CreatedAt: time.Now().Add(-age),
	}
	require.NoError(t, db.Create(&a).Error)
}

func publicStatus(srv http.Handler, method, path string) int {
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec.Code
}

// The site reads through these routes and nothing else: a draft or a scheduled
// article must be absent from every one of them, whatever the filter.
func TestPublicArticleRoutesOnlyServePublished(t *testing.T) {
	srv, db := articleListServer(t)
	seedStatusArticle(t, db, "publie", models.ArticleStatusPublished, 3*time.Hour)
	seedStatusArticle(t, db, "voisin", models.ArticleStatusPublished, 4*time.Hour)
	seedStatusArticle(t, db, "brouillon", models.ArticleStatusDraft, time.Hour)
	seedStatusArticle(t, db, "programme", models.ArticleStatusScheduled, 2*time.Hour)

	for _, query := range []string{"", "category=Actus", "author=", "excludeNews=false"} {
		res := listGet(t, srv, "/api/articles?"+query)
		require.Equal(t, http.StatusOK, res.status, query)
		assert.Equal(t, []string{"publie", "voisin"}, res.slugs, "list ?%s", query)
		assert.Equal(t, "2", res.header.Get("X-Total-Count"), "X-Total-Count ?%s", query)
		assert.EqualValues(t, 2, listCount(t, srv, query), "count ?%s", query)
	}

	assert.Equal(t, http.StatusOK, publicStatus(srv, http.MethodGet, "/api/articles/publie"))
	for _, hidden := range []string{"brouillon", "programme"} {
		assert.Equal(t, http.StatusNotFound, publicStatus(srv, http.MethodGet, "/api/articles/"+hidden), hidden)
		assert.NotEqual(t, http.StatusOK, publicStatus(srv, http.MethodGet, "/api/articles/"+hidden+"/similar"), hidden+" similar")
	}

	// Same tag everywhere: only the published neighbour may come back.
	similar := listGet(t, srv, "/api/articles/publie/similar")
	require.Equal(t, http.StatusOK, similar.status)
	assert.Equal(t, []string{"voisin"}, similar.slugs)

	for _, slug := range []string{"publie", "brouillon", "programme"} {
		assert.Equal(t, http.StatusOK, publicStatus(srv, http.MethodPost, "/api/articles/"+slug+"/view"))
	}
	var views []struct {
		Slug  string
		Views int
	}
	require.NoError(t, db.Raw(`SELECT slug, views FROM articles WHERE views > 0`).Scan(&views).Error)
	require.Len(t, views, 1, "only the published article counts views")
	assert.Equal(t, "publie", views[0].Slug)
}

// An article saved the way the legacy admin panel and older code do it, without
// a status, is a published one.
func TestArticleWithoutStatusIsPublished(t *testing.T) {
	srv, db := articleListServer(t)
	seedArticleList(t, db, []listSeed{{slug: "ancien", category: "Actus"}})

	var status string
	var notify bool
	require.NoError(t, db.Raw(`SELECT status FROM articles WHERE slug = 'ancien'`).Scan(&status).Error)
	require.NoError(t, db.Raw(`SELECT notify_on_publish FROM articles WHERE slug = 'ancien'`).Scan(&notify).Error)
	assert.Equal(t, models.ArticleStatusPublished, status)
	assert.True(t, notify)
	assert.Equal(t, []string{"ancien"}, listGet(t, srv, "/api/articles").slugs)
}
