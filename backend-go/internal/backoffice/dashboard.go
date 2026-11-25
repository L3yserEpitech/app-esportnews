package backoffice

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

func init() {
	schemaStatements = append(schemaStatements,
		// One value a day for figures the database only knows « now »: without
		// it the dashboard could not say how Premium moved over the period.
		`CREATE TABLE IF NOT EXISTS bo_metric_daily (
			metric text NOT NULL,
			day date NOT NULL,
			value bigint NOT NULL,
			PRIMARY KEY (metric, day)
		)`,
	)
}

const metricPremiumActive = "premium_active"

func (m *Module) registerDashboardRoutes(g *echo.Group) {
	g.GET("/dashboard", m.handleDashboard)
}

type dashboardKPI struct {
	Configured bool      `json:"configured"`
	Source     string    `json:"source,omitempty"`
	Value      float64   `json:"value"`
	Prev       *float64  `json:"prev"`
	Series     []float64 `json:"series"`
}

type dashboardArticle struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"created_at"`
	Views     int64     `json:"views"`
}

type dashboardService struct {
	Key    string       `json:"key"`
	Name   string       `json:"name"`
	Status HealthStatus `json:"status"`
	Note   string       `json:"note,omitempty"`
}

func values(points []dayPoint) []float64 {
	out := make([]float64, len(points))
	for i, p := range points {
		out[i] = p.Value
	}
	return out
}

// recordDailyMetrics stores today's value of the figures that have no history.
func (m *Module) recordDailyMetrics(ctx context.Context) {
	var premium int64
	if err := m.db.WithContext(ctx).Raw("SELECT count(*) FROM users WHERE COALESCE(premium, false) OR premium_gifted").Scan(&premium).Error; err != nil {
		m.log.WithError(err).Warn("[BO] daily metrics not read")
		return
	}
	if err := m.db.WithContext(ctx).Exec(
		`INSERT INTO bo_metric_daily (metric, day, value) VALUES (?, CURRENT_DATE, ?)
		 ON CONFLICT (metric, day) DO UPDATE SET value = EXCLUDED.value`, metricPremiumActive, premium).Error; err != nil {
		m.log.WithError(err).Warn("[BO] daily metrics not saved")
	}
}

func (m *Module) handleDashboard(c echo.Context) error {
	ctx := c.Request().Context()
	s := sessionOf(c)
	days := daysParam(c)
	db := m.db.WithContext(ctx)
	out := map[string]interface{}{"days": days}

	site, err := m.siteAnalytics(ctx, periodEnding(time.Now(), days))
	if err != nil {
		return m.internal(c, err)
	}
	visitors := dashboardKPI{Configured: site.Source != "", Source: site.Source, Series: values(site.Series)}
	if visitors.Configured {
		visitors.Value, visitors.Prev = site.Totals.Visitors, &site.Totals.PrevVisitors
	}
	out["visitors"] = visitors
	out["traffic"] = map[string]interface{}{
		"configured": visitors.Configured, "missing": site.Vercel.Missing, "error": site.Vercel.Error,
		"series": site.Series, "prev_series": site.PrevSeries,
	}

	clicks := dashboardKPI{Configured: len(m.gscMissing()) == 0, Series: []float64{}}
	if clicks.Configured {
		if gsc, err := m.gscOverviewCached(ctx, days); err == nil {
			clicks.Value, clicks.Prev, clicks.Series = gsc.Totals.Clicks, &gsc.Prev.Clicks, values(gsc.Series)
		} else {
			m.sourceFailure("gsc", err)
			clicks.Configured = false
		}
	}
	out["gsc_clicks"] = clicks

	downloads := dashboardKPI{Series: []float64{}}
	if app, err := m.appAnalytics(ctx, periodEnding(time.Now().AddDate(0, 0, -1), days)); err == nil {
		prev := 0.0
		for _, store := range app.Stores {
			if !store.Configured {
				continue
			}
			downloads.Configured = true
			downloads.Value += store.Total
			prev += store.Prev
			for i, v := range values(store.Series) {
				if i >= len(downloads.Series) {
					downloads.Series = append(downloads.Series, 0)
				}
				downloads.Series[i] += v
			}
		}
		if downloads.Configured {
			downloads.Prev = &prev
		}
	}
	out["downloads"] = downloads

	premium := dashboardKPI{Configured: true, Series: []float64{}}
	if err := db.Raw("SELECT count(*) FROM users WHERE COALESCE(premium, false) OR premium_gifted").Scan(&premium.Value).Error; err != nil {
		return m.internal(c, err)
	}
	var history []struct {
		Day   time.Time
		Value float64
	}
	db.Raw("SELECT day, value FROM bo_metric_daily WHERE metric = ? AND day >= ? ORDER BY day",
		metricPremiumActive, time.Now().AddDate(0, 0, -days)).Scan(&history)
	if len(history) > 1 {
		first := history[0].Value
		premium.Prev = &first
		for _, h := range history {
			premium.Series = append(premium.Series, h.Value)
		}
	}
	out["premium"] = premium

	articles := []dashboardArticle{}
	if err := db.Raw(`SELECT id, COALESCE(title, '') AS title, COALESCE(author, '') AS author, created_at, COALESCE(views, 0) AS views
		FROM articles WHERE status = 'published' ORDER BY created_at DESC LIMIT 5`).Scan(&articles).Error; err != nil {
		return m.internal(c, err)
	}
	var total int64
	db.Raw("SELECT count(*) FROM articles").Scan(&total)
	out["articles"], out["articles_total"] = articles, total

	out["watch"] = m.dashboardWatch(ctx, s)

	if s.User.Role.Can(PermHealthRead) {
		if snap, err := m.healthSnapshot(ctx, false); err == nil {
			services := make([]dashboardService, 0, len(snap.Services))
			for _, svc := range snap.Services {
				services = append(services, dashboardService{Key: svc.Key, Name: svc.Name, Status: svc.Status, Note: svc.Note})
			}
			out["services"] = services
		}
	}
	return c.JSON(http.StatusOK, out)
}

// dashboardWatch is the « À regarder » card: what the member can act on today,
// most pressing first.
func (m *Module) dashboardWatch(ctx context.Context, s *Session) []HealthAlert {
	alerts := []HealthAlert{}
	role := s.User.Role

	if role.Can(PermHealthRead) {
		if snap, err := m.healthSnapshot(ctx, false); err == nil {
			alerts = append(alerts, snap.Alerts...)
		}
	}

	if apple, google, err := m.storeStatuses(ctx); err == nil {
		for _, store := range []struct {
			name, effect string
			status       storeStatus
		}{
			{"Apple", "les achats iOS ne sont plus suivis", apple},
			{"Google Play", "les achats Android ne sont plus suivis", google},
		} {
			if store.status.Status != "silent" {
				continue
			}
			title := store.name + " · aucune notification reçue"
			if store.status.LastAt != nil {
				title = fmt.Sprintf("%s · aucune notification depuis %d j", store.name, int(time.Since(*store.status.LastAt).Hours()/24))
			}
			alerts = append(alerts, HealthAlert{Level: "important", Title: title, Detail: store.effect, Href: "/notifications"})
		}
	}

	var noGame int64
	if err := m.db.WithContext(ctx).Raw("SELECT count(*) FROM articles WHERE status = 'published' AND game_id IS NULL").Scan(&noGame).Error; err == nil && noGame > 0 {
		title := fmt.Sprintf("%d articles sans jeu", noGame)
		if noGame == 1 {
			title = "1 article sans jeu"
		}
		alerts = append(alerts, HealthAlert{Level: "info", Title: title, Detail: "ils n'apparaissent pas dans le filtre de /news", Href: "/articles?sans_jeu=1"})
	}

	if len(m.gscMissing()) == 0 {
		if fresh, err := m.newlyNotIndexed(ctx); err == nil && fresh > 0 {
			title := fmt.Sprintf("Search Console · %d pages non indexées", fresh)
			if fresh == 1 {
				title = "Search Console · 1 page non indexée"
			}
			alerts = append(alerts, HealthAlert{Level: "info", Title: title, Detail: "nouvelles depuis 7 jours", Href: "/analytics"})
		}
	}

	if role.Can(PermTeamManage) {
		var late int64
		m.db.WithContext(ctx).Raw(
			`SELECT count(*) FROM users u LEFT JOIN bo_totp t ON t.user_id = u.id
			 WHERE u.role <> 'user' AND t.enabled_at IS NULL`).Scan(&late)
		if late > 0 {
			title := fmt.Sprintf("%d membres sans double authentification", late)
			if late == 1 {
				title = "1 membre sans double authentification"
			}
			alerts = append(alerts, HealthAlert{Level: "info", Title: title, Detail: "exigée à leur prochaine connexion", Href: "/equipe"})
		}
	}
	return alerts
}
