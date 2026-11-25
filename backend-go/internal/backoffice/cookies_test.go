package backoffice

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestSameOriginGuardsWritesAgainstASiblingSubdomain(t *testing.T) {
	m := &Module{cfg: Config{BackofficeURL: "https://admin.esportnews.fr"}}
	cases := []struct {
		method, origin string
		want           bool
	}{
		{http.MethodGet, "", true},
		{http.MethodGet, "https://www.esportnews.fr", true}, // reads are protected by CORS, not here
		{http.MethodPost, "https://admin.esportnews.fr", true},
		{http.MethodPost, "https://www.esportnews.fr", false}, // same site, another origin
		{http.MethodPost, "http://admin.esportnews.fr", false},
		{http.MethodPost, "https://admin.esportnews.fr.evil.example", false},
		{http.MethodDelete, "", false},
		{http.MethodPut, "null", false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, "/api/bo/team", nil)
		if tc.origin != "" {
			req.Header.Set(echo.HeaderOrigin, tc.origin)
		}
		c := echo.New().NewContext(req, httptest.NewRecorder())
		if got := m.sameOrigin(c); got != tc.want {
			t.Errorf("%s from %q: sameOrigin = %v, want %v", tc.method, tc.origin, got, tc.want)
		}
	}
}

func TestSessionCookieAttributes(t *testing.T) {
	for backoffice, secure := range map[string]bool{"https://admin.esportnews.fr": true, "http://localhost:3100": false} {
		m := &Module{cfg: Config{BackofficeURL: backoffice}}
		rec := httptest.NewRecorder()
		c := echo.New().NewContext(httptest.NewRequest(http.MethodPost, "/api/bo/auth/login", nil), rec)
		m.setCookie(c, sessionCookie, "abc", sessionTTL)
		cookies := rec.Result().Cookies()
		if len(cookies) != 1 {
			t.Fatalf("%s: %d cookies", backoffice, len(cookies))
		}
		got := cookies[0]
		if !got.HttpOnly || got.SameSite != http.SameSiteStrictMode || got.Path != "/api/bo" || got.Secure != secure || got.MaxAge != int(sessionTTL.Seconds()) {
			t.Errorf("%s: cookie %+v", backoffice, got)
		}
	}
}
