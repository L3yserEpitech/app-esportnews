package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

func TestTrackPageViewStoresNoSecretAndNoForeignIdentity(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.PageView{}))

	const visitor = "6f1c3f7e-58a1-4c34-9a55-0b8c1d2e3f40"
	require.NoError(t, db.Exec(`DELETE FROM page_views WHERE visitor_id = ?`, visitor).Error)
	t.Cleanup(func() { db.Exec(`DELETE FROM page_views WHERE visitor_id = ?`, visitor) })

	e := echo.New()
	e.Validator = utils.NewEchoValidator()
	NewAnalyticsHandler(services.NewAnalyticsService(&database.Database{DB: db}, testCache(t))).RegisterRoutes(e.Group("/api"))

	rec := authRequest(e, http.MethodPost, "/api/analytics/track", map[string]any{
		"visitor_id": visitor,
		"user_id":    42,
		"path":       "/auth/login?email=a%40b.c&password=secret#frag",
		"referer":    "https://www.esportnews.fr/auth/reset-password?token=secret",
		"user_agent": strings.Repeat("é", 5000),
	}, "")
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var row models.PageView
	require.NoError(t, db.WithContext(context.Background()).Where("visitor_id = ?", visitor).First(&row).Error)
	assert.Equal(t, "/auth/login", row.Path)
	assert.Equal(t, "https://www.esportnews.fr/auth/reset-password", row.Referer)
	assert.Nil(t, row.UserID, "a public route can't attribute a view to someone by taking their word for it")
	assert.LessOrEqual(t, len(row.UserAgent), 512)
	assert.True(t, strings.ToValidUTF8(row.UserAgent, "") == row.UserAgent, "cut on a rune boundary")

	rec = authRequest(e, http.MethodPost, "/api/analytics/track", map[string]any{"visitor_id": "not-a-uuid", "path": "/"}, "")
	assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	rec = authRequest(e, http.MethodPost, "/api/analytics/track", map[string]any{"visitor_id": visitor, "path": ""}, "")
	assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	rec = authRequest(e, http.MethodPost, "/api/analytics/track", map[string]any{"visitor_id": visitor, "path": strings.Repeat("a", 10000)}, "")
	require.Equal(t, http.StatusCreated, rec.Code)
}
