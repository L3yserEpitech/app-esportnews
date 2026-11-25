package backoffice

import (
	"context"

	"github.com/labstack/echo/v4"
)

func (m *Module) registerHealthRoutes(g *echo.Group) {}

func (m *Module) startHealthJobs(ctx context.Context) {}

// navHealthAlerts is the amber counter next to « Santé du système ».
func (m *Module) navHealthAlerts(c echo.Context) *int { return nil }
