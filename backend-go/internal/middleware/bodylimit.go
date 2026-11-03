package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

const publicBodyLimitBytes = 1 << 20

// Admin routes and the avatar upload carry files and articles, and authenticate
// before reading a byte. Everything else is reachable by anyone.
var bodyLimitExemptPrefixes = []string{"/api/admin/", "/api/auth/avatar/upload"}

// BodyLimit caps request bodies, chunked ones included: a route that reads its
// body whole (the Stripe webhook) would otherwise read whatever it is sent.
func BodyLimit() echo.MiddlewareFunc {
	return echomw.BodyLimitWithConfig(echomw.BodyLimitConfig{
		Limit: "1M",
		Skipper: func(c echo.Context) bool {
			path := c.Request().URL.Path
			for _, prefix := range bodyLimitExemptPrefixes {
				if strings.HasPrefix(path, prefix) {
					return true
				}
			}
			return false
		},
	})
}
