package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
)

func rateLimitedCall(t *testing.T, h echo.HandlerFunc, path string) int {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = "203.0.113.7:1234"
	rec := httptest.NewRecorder()
	if err := h(e.NewContext(req, rec)); err != nil {
		if he, ok := err.(*echo.HTTPError); ok {
			return he.Code
		}
		t.Fatal(err)
	}
	return rec.Code
}

func TestRateLimitCostsOneCommandPerRequest(t *testing.T) {
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	h := RateLimitMiddleware(rc)(func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	rateLimitedCall(t, h, "/api/games")
	before := mr.CommandCount()
	for i := 0; i < 20; i++ {
		if code := rateLimitedCall(t, h, "/api/games"); code != http.StatusOK {
			t.Fatalf("request %d: %d", i, code)
		}
	}
	if sent := mr.CommandCount() - before; sent != 20 {
		t.Fatalf("20 requests sent %d Redis commands, want 20", sent)
	}

	keys := mr.Keys()
	if len(keys) != 1 || !strings.HasPrefix(keys[0], "ratelimit:203.0.113.7:") {
		t.Fatalf("keys = %v", keys)
	}
	if ttl := mr.TTL(keys[0]); ttl <= 0 {
		t.Fatalf("the counter has no expiry (ttl %v)", ttl)
	}
}

func TestRateLimitRefusesPastTheLimit(t *testing.T) {
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	h := RateLimitMiddleware(rc)(func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	for i := 0; i < RateLimitPerMinute; i++ {
		if code := rateLimitedCall(t, h, "/api/games"); code != http.StatusOK {
			t.Fatalf("request %d refused: %d", i+1, code)
		}
	}
	if code := rateLimitedCall(t, h, "/api/games"); code != http.StatusTooManyRequests {
		t.Fatalf("request past the limit: %d, want 429", code)
	}
	if code := rateLimitedCall(t, h, "/health"); code != http.StatusOK {
		t.Fatalf("/health is exempt, got %d", code)
	}
}
