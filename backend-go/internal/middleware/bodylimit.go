package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

const (
	publicBodyLimitBytes = 1 << 20
	avatarUploadPath     = "/api/auth/avatar/upload"
	// Admin routes carry files and articles, and authenticate before reading a byte.
	// RequireAdmin stops anyone else there.
	adminPathPrefix = "/api/admin/"
)

// BodyLimit caps request bodies, chunked ones included: a route that reads its
// body whole (the Stripe webhook) would otherwise read whatever it is sent. The
// avatar route is open to any free account and parses its form before checking
// the 10 MB of utils.MaxFileSize, so it gets that limit up front, form overhead
// included.
func BodyLimit() echo.MiddlewareFunc {
	public := echomw.BodyLimit("1M")
	avatar := echomw.BodyLimit("11M")
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		limitedPublic, limitedAvatar := public(next), avatar(next)
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			switch {
			case path == avatarUploadPath:
				return limitedAvatar(c)
			case strings.HasPrefix(path, adminPathPrefix):
				return next(c)
			default:
				return limitedPublic(c)
			}
		}
	}
}
