package backoffice

import (
	"context"

	"github.com/labstack/echo/v4"
)

func (m *Module) registerPushRoutes(g *echo.Group) {}

func (m *Module) startPushJobs(ctx context.Context) {}

// navPushAlerts is the amber counter next to « Notifications push ».
func (m *Module) navPushAlerts(c echo.Context) *int { return nil }
