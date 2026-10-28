package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// blockedCrawlers mirrors frontend/app/lib/crawlers.ts (robots.txt + edge
// middleware). These crawlers either render JavaScript, so every page they
// visit replays all of its API calls against the Liquipedia queue, or ignore
// robots.txt. facebookexternalhit stays out: it serves link previews.
var blockedCrawlers = []string{"baiduspider", "meta-externalagent", "bytespider", "petalbot", "amazonbot", "gptbot", "ccbot"}

// BlockedCrawlersMiddleware answers 403 to the crawlers above before any handler runs.
func BlockedCrawlersMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ua := strings.ToLower(c.Request().UserAgent())
			for _, bot := range blockedCrawlers {
				if strings.Contains(ua, bot) {
					return c.NoContent(http.StatusForbidden)
				}
			}
			return next(c)
		}
	}
}
