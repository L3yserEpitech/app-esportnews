package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	RateLimitPerMinute = 500 // 500 requêtes par minute par IP

	// rateLimitMaxIPs bounds the memory one minute of traffic can take: the IP
	// comes from X-Forwarded-For, which a client can forge at will. Past it, new
	// IPs go through uncounted until the next minute.
	rateLimitMaxIPs = 100_000
)

// skipRateLimitPaths are paths excluded from rate limiting (high-volume, already cached).
var skipRateLimitPaths = []string{
	"/api/proxy/image",
	"/health",
}

// minuteCounter counts requests per IP for the current minute, in this process.
// It lived in Redis (an INCR per request, a quarter of the commands billed) for
// no benefit while a single backend instance serves the API: with several, the
// limit applies per instance.
type minuteCounter struct {
	mu     sync.Mutex
	minute int64
	counts map[string]int
}

func (m *minuteCounter) hit(ip string, now time.Time) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	if minute := now.Unix() / 60; minute != m.minute || m.counts == nil {
		m.minute = minute
		m.counts = make(map[string]int)
	}
	count, seen := m.counts[ip]
	if !seen && len(m.counts) >= rateLimitMaxIPs {
		return 0
	}
	m.counts[ip] = count + 1
	return count + 1
}

func RateLimitMiddleware() echo.MiddlewareFunc {
	counter := &minuteCounter{}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Skip rate limiting for high-volume paths (e.g. image proxy with browser cache)
			path := c.Request().URL.Path
			for _, skip := range skipRateLimitPaths {
				if strings.HasPrefix(path, skip) {
					return next(c)
				}
			}

			if counter.hit(c.RealIP(), time.Now()) > RateLimitPerMinute {
				return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
			}
			return next(c)
		}
	}
}
