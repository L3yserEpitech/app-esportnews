package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

// robots.txt only asks; crawlers that render JavaScript (Baidu, Meta) keep
// calling the API for hours or days before re-reading it, and Bytespider or
// PetalBot ignore it outright. The API answers them 403 directly.
func TestBlockedCrawlersGet403BeforeAnyHandler(t *testing.T) {
	e := echo.New()
	handlerHit := false
	h := BlockedCrawlersMiddleware()(func(c echo.Context) error {
		handlerHit = true
		return c.NoContent(http.StatusOK)
	})

	cases := map[string]int{
		"Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)":                                                           http.StatusForbidden,
		"meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)":                                                            http.StatusForbidden,
		"Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)": http.StatusForbidden,
		"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)":                                                                            http.StatusOK, // link previews stay
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)":                                                                             http.StatusOK,
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36":                                                        http.StatusOK,
		"": http.StatusOK,
	}
	for ua, want := range cases {
		handlerHit = false
		req := httptest.NewRequest(http.MethodGet, "/api/matches/abc", nil)
		req.Header.Set("User-Agent", ua)
		rec := httptest.NewRecorder()
		require.NoError(t, h(e.NewContext(req, rec)), ua)
		require.Equal(t, want, rec.Code, ua)
		require.Equal(t, want == http.StatusOK, handlerHit, ua)
	}
}

// Baidu's renderer fetches the API with a browser-like user agent (observed
// 2026-10-28: 403 on the HTML, yet 120 API calls/min from 116.179.37.x kept
// coming), so its published crawler range is refused by address as well.
func TestBlockedCrawlerNetworksGet403ByIP(t *testing.T) {
	e := echo.New()
	h := BlockedCrawlersMiddleware()(func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	cases := map[string]int{
		"116.179.37.217": http.StatusForbidden, // Baiduspider range 116.179.32.0/20
		"116.179.47.1":   http.StatusForbidden,
		"116.179.48.1":   http.StatusOK, // just outside the /20
		"8.8.8.8":        http.StatusOK,
	}
	for ip, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/api/games", nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36")
		req.Header.Set("X-Forwarded-For", ip)
		rec := httptest.NewRecorder()
		require.NoError(t, h(e.NewContext(req, rec)), ip)
		require.Equal(t, want, rec.Code, ip)
	}
}
