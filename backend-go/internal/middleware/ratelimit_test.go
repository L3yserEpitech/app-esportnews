package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
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

func TestRateLimitRefusesPastTheLimit(t *testing.T) {
	h := RateLimitMiddleware()(func(c echo.Context) error { return c.NoContent(http.StatusOK) })

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

func TestMinuteCounterStartsOverEachMinute(t *testing.T) {
	c := &minuteCounter{}
	at := time.Unix(1_800_000_000, 0)

	for i := 1; i <= 3; i++ {
		if got := c.hit("a", at); got != i {
			t.Fatalf("hit %d = %d", i, got)
		}
	}
	if got := c.hit("b", at); got != 1 {
		t.Fatalf("another IP = %d, want 1", got)
	}
	if got := c.hit("a", at.Add(time.Minute)); got != 1 {
		t.Fatalf("next minute = %d, want 1", got)
	}
}

func TestMinuteCounterStopsGrowingPastItsCap(t *testing.T) {
	c := &minuteCounter{}
	at := time.Unix(1_800_000_000, 0)

	for i := 0; i < rateLimitMaxIPs; i++ {
		c.hit(fmt.Sprintf("ip-%d", i), at)
	}
	if got := c.hit("one-too-many", at); got != 0 {
		t.Fatalf("IP past the cap counted as %d, want 0 (uncounted)", got)
	}
	if len(c.counts) != rateLimitMaxIPs {
		t.Fatalf("map holds %d IPs, want %d", len(c.counts), rateLimitMaxIPs)
	}
	if got := c.hit("ip-0", at); got != 2 {
		t.Fatalf("known IP past the cap = %d, want 2", got)
	}
}
