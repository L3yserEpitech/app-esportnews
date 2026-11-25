package backoffice

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

// analyticsDBModule needs a real Postgres (TEST_DATABASE_URL): the queries use FILTER.
func analyticsDBModule(t *testing.T) *Module {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(
		&models.User{}, &models.Article{}, &models.PushToken{},
		&models.MatchSubscription{}, &models.TournamentSubscription{},
	))
	require.NoError(t, EnsureSchema(db))
	reset := func() {
		for _, table := range []string{"bo_store_downloads", "bo_metric_daily"} {
			require.NoError(t, db.Exec("TRUNCATE "+table).Error)
		}
	}
	reset()
	t.Cleanup(reset)
	m := analyticsModule(t, Config{SiteURL: "https://www.esportnews.fr"})
	m.db = db
	return m
}

func TestAppAnalyticsReadsStoredDownloadsOnlyForConnectedStores(t *testing.T) {
	m := analyticsDBModule(t)
	m.cfg.AppStoreKeyID, m.cfg.AppStoreIssuerID, m.cfg.AppStoreKeyContent, m.cfg.AppStoreVendorID = "k", "i", "pem", "8123"
	p := periodEnding(time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC), 7)
	m.saveDownloads(context.Background(), storeApple, map[string]int{"2026-11-13": 12, "2026-11-16": 8, "2026-11-08": 5})
	// Rows of a store that is not connected must not surface.
	m.saveDownloads(context.Background(), storeGoogle, map[string]int{"2026-11-13": 99})

	out, err := m.appAnalytics(context.Background(), p)
	require.NoError(t, err)
	apple, google := out.Stores[0], out.Stores[1]
	require.True(t, apple.Configured)
	require.Equal(t, 20.0, apple.Total)
	require.Equal(t, 5.0, apple.Prev)
	require.Equal(t, "2026-11-16", apple.Through, "later days are unknown, not zero")
	require.Len(t, apple.Series, 7)
	require.False(t, google.Configured)
	require.Zero(t, google.Total)
	require.Equal(t, []string{"PLAY_REPORTS_BUCKET", "PLAY_REPORTS_CREDENTIALS_JSON"}, google.Missing)
}
