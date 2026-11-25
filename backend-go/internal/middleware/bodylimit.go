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
	// Same reasoning for the back-office uploads: the team session is checked
	// before the form is parsed.
	backofficeUploadPrefix = "/api/bo/upload/"
	// An article body is HTML with its media hosted elsewhere, but longer than
	// what a public form ever sends.
	backofficeArticlePrefix = "/api/bo/articles"
)

// BodyLimit caps request bodies, chunked ones included: a route that reads its
// body whole (the Stripe webhook) would otherwise read whatever it is sent. The
// avatar route is open to any free account and parses its form before checking
// the 10 MB of utils.MaxFileSize, so it gets that limit up front, form overhead
// included.
func BodyLimit() echo.MiddlewareFunc {
	public := echomw.BodyLimit("1M")
	avatar := echomw.BodyLimit("11M")
	article := echomw.BodyLimit("8M")
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		limitedPublic, limitedAvatar, limitedArticle := public(next), avatar(next), article(next)
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			switch {
			case path == avatarUploadPath:
				return limitedAvatar(c)
			case strings.HasPrefix(path, adminPathPrefix), strings.HasPrefix(path, backofficeUploadPrefix):
				return next(c)
			case strings.HasPrefix(path, backofficeArticlePrefix):
				return limitedArticle(c)
			default:
				return limitedPublic(c)
			}
		}
	}
}
