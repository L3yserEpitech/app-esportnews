package backoffice

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// Register mounts the back-office under /api/bo. Everything but the login
// steps needs a team session. `api` is the public /api group: the site reads
// the ad spots from it.
func (m *Module) Register(api *echo.Group) {
	pub := api.Group("/bo")
	priv := api.Group("/bo", m.requireSession)

	m.registerAuthRoutes(pub, priv)
	m.registerTeamRoutes(priv)
	m.registerAuditRoutes(priv)
	m.registerArticleRoutes(priv)
	m.registerUserRoutes(priv)
	m.registerPushRoutes(priv)
	m.registerHealthRoutes(priv)
	m.registerAnalyticsRoutes(priv)
	m.registerMediaRoutes(priv)
	m.registerAdRoutes(api, priv)
	m.registerDashboardRoutes(priv)
	priv.GET("/nav", m.handleNav)
}

// handleNav feeds the counters of the sidebar. A counter the member's role
// can't see stays null.
func (m *Module) handleNav(c echo.Context) error {
	ctx := c.Request().Context()
	var articles int64
	if err := m.db.WithContext(ctx).Raw("SELECT count(*) FROM articles").Scan(&articles).Error; err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"articles":      articles,
		"health_alerts": m.navHealthAlerts(c),
		"push_alerts":   m.navPushAlerts(c),
	})
}

// Start runs the background jobs until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.startArticleJobs(ctx)
	m.startPushJobs(ctx)
	m.startHealthJobs(ctx)
	m.startAnalyticsJobs(ctx)
	m.startAdJobs(ctx)
	go func() {
		daily := time.NewTicker(24 * time.Hour)
		defer daily.Stop()
		m.purgeOldAudit()
		for {
			select {
			case <-ctx.Done():
				return
			case <-daily.C:
				m.purgeOldAudit()
			}
		}
	}()
}
