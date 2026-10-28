package middleware

import (
	"net"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// blockedCrawlers mirrors frontend/app/lib/crawlers.ts (robots.txt + edge
// middleware). These crawlers either render JavaScript, so every page they
// visit replays all of its API calls against the Liquipedia queue, or ignore
// robots.txt. facebookexternalhit stays out: it serves link previews.
var blockedCrawlers = []string{"baiduspider", "meta-externalagent", "bytespider", "petalbot", "amazonbot", "gptbot", "ccbot"}

// blockedNetworks: Baidu's renderer calls the API with a browser-like user
// agent (observed 2026-10-28, 120 calls/min from 116.179.37.x after the UA
// block), so its published crawler range is refused by address.
var blockedNetworks = mustParseCIDRs("116.179.32.0/20")

func mustParseCIDRs(cidrs ...string) []*net.IPNet {
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, n, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		nets = append(nets, n)
	}
	return nets
}

// BlockedCrawlersMiddleware answers 403 to the crawlers above before any handler runs.
func BlockedCrawlersMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if isBlockedCrawler(c.Request().UserAgent(), c.RealIP()) {
				return c.NoContent(http.StatusForbidden)
			}
			return next(c)
		}
	}
}

func isBlockedCrawler(userAgent, ip string) bool {
	ua := strings.ToLower(userAgent)
	for _, bot := range blockedCrawlers {
		if strings.Contains(ua, bot) {
			return true
		}
	}
	addr := net.ParseIP(ip)
	for _, n := range blockedNetworks {
		if addr != nil && n.Contains(addr) {
			return true
		}
	}
	return false
}
