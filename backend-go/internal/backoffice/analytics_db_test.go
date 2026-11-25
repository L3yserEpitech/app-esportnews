package backoffice

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

// analyticsDBModule needs a real Postgres (TEST_DATABASE_URL): the queries use
// FILTER, regexp_replace and date_trunc.
func analyticsDBModule(t *testing.T) *Module {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(
		&models.User{}, &models.Article{}, &models.PageView{}, &models.PushToken{},
		&models.MatchSubscription{}, &models.TournamentSubscription{},
	))
	require.NoError(t, EnsureSchema(db))
	reset := func() {
		for _, table := range []string{"page_views", "bo_store_downloads", "bo_metric_daily"} {
			require.NoError(t, db.Exec("TRUNCATE "+table).Error)
		}
	}
	reset()
	t.Cleanup(reset)
	m := analyticsModule(t, Config{SiteURL: "https://www.esportnews.fr"})
	m.db = db
	return m
}

func TestInternalSiteCountsVisitorsPagesAndReferrers(t *testing.T) {
	m := analyticsDBModule(t)
	const alice, bob = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
	p := periodEnding(time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC), 7)
	at := func(day, hour int) time.Time { return time.Date(2026, 11, day, hour, 0, 0, 0, time.UTC) }

	views := []struct {
		visitor, path, referer string
		at                     time.Time
	}{
		{alice, "/", "https://www.google.com/search?q=esport", at(13, 9)},
		{alice, "/match", "https://www.esportnews.fr/", at(13, 10)},
		{bob, "/", "https://t.co/abc?utm=1#x", at(14, 9)},
		{bob, "/", "", at(18, 23)},
		{bob, "/news", "https://www.google.com/", at(10, 9)}, // previous period
		{alice, "/", "", at(19, 0)},                          // after the period
	}
	for _, v := range views {
		require.NoError(t, m.db.Exec("INSERT INTO page_views (visitor_id, path, referer, user_agent, created_at) VALUES (?, ?, ?, '', ?)",
			v.visitor, v.path, v.referer, v.at).Error)
	}

	var out siteAnalytics
	require.NoError(t, m.internalSite(context.Background(), p, &out))
	require.Equal(t, siteTotals{Visitors: 2, Pageviews: 4, PrevVisitors: 1, PrevPageviews: 1}, out.Totals)
	require.Len(t, out.Series, 7)
	require.Equal(t, "2026-11-13", out.Series[1].Date)
	require.Equal(t, 1.0, out.Series[1].Value, "one visitor on the 13th")
	require.Equal(t, 2.0, out.Series[1].Other, "two page views on the 13th")
	require.Equal(t, "/", out.Pages[0].Key)
	require.Equal(t, 3.0, out.Pages[0].Pageviews)

	// The site's own pages are not a provenance, and « www. » is dropped.
	hosts := map[string]float64{}
	for _, r := range out.Referrers {
		hosts[r.Key] = r.Pageviews
	}
	require.Equal(t, map[string]float64{"google.com": 1, "t.co": 1}, hosts)
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
