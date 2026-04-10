package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
)

const (
	RateLimitPerMinute = 100  // 100 requêtes par minute par IP
)

func RateLimitMiddleware(redisCache *cache.RedisCache) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			key := cache.RateLimitKey(ip)
			count, err := redisCache.Incr(ctx, key)
			if err != nil {
				// If Redis fails, allow request
				return next(c)
			}

			// Always ensure the key has a TTL (guards against keys stuck without expiry)
			if count == 1 {
				redisCache.Expire(ctx, key, 1*time.Minute)
			} else {
				ttl, ttlErr := redisCache.TTL(ctx, key)
				if ttlErr == nil && ttl < 0 {
					redisCache.Expire(ctx, key, 1*time.Minute)
				}
			}

			if count > RateLimitPerMinute {
				return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
			}

			return next(c)
		}
	}
}
