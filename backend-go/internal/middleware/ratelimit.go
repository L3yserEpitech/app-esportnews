package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
)

const (
	RateLimitPerMinute = 500 // 500 requêtes par minute par IP
)

// skipRateLimitPaths are paths excluded from rate limiting (high-volume, already cached).
var skipRateLimitPaths = []string{
	"/api/proxy/image",
	"/health",
}

func RateLimitMiddleware(redisCache *cache.RedisCache) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Skip rate limiting for high-volume paths (e.g. image proxy with browser cache)
			path := c.Request().URL.Path
			for _, skip := range skipRateLimitPaths {
				if strings.HasPrefix(path, skip) {
					return next(c)
				}
			}

			ip := c.RealIP()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			// One key per IP and per minute: a single INCR per request. The key is
			// never reused, so its expiry only needs setting once, on creation.
			key := cache.RateLimitKey(ip, time.Now())
			count, err := redisCache.Incr(ctx, key)
			if err != nil {
				// If Redis fails, allow request
				return next(c)
			}
			if count == 1 {
				redisCache.Expire(ctx, key, 2*time.Minute)
			}

			if count > RateLimitPerMinute {
				return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
			}

			return next(c)
		}
	}
}
