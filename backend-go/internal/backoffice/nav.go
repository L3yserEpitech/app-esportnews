package backoffice

import "github.com/labstack/echo/v4"

// navHealthAlerts is the amber counter next to « Santé du système ».
func (m *Module) navHealthAlerts(c echo.Context) *int {
	return nil
}

// navPushAlerts is the amber counter next to « Notifications push ».
func (m *Module) navPushAlerts(c echo.Context) *int {
	return nil
}
