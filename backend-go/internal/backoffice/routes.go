package backoffice

import (
	"context"
	"time"

	"github.com/labstack/echo/v4"
)

// Register mounts the back-office under /api/bo. Everything but the login
// steps needs a team session.
func (m *Module) Register(api *echo.Group) {
	pub := api.Group("/bo")
	priv := api.Group("/bo", m.requireSession)

	m.registerAuthRoutes(pub, priv)
	m.registerTeamRoutes(priv)
	m.registerAuditRoutes(priv)
}

// Start runs the background jobs until ctx ends.
func (m *Module) Start(ctx context.Context) {
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
