package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSignupSource(t *testing.T) {
	cases := []struct {
		name      string
		origin    string
		userAgent string
		want      string
	}{
		{"site in a desktop browser", "https://www.esportnews.fr", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", "web"},
		{"site in Safari on an iPhone", "https://www.esportnews.fr", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "web"},
		{"site in Chrome on Android", "https://www.esportnews.fr", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36", "web"},
		{"Android app", "", "okhttp/4.12.0", "android"},
		{"iOS app", "", "EsportNews/42 CFNetwork/1568.200.51 Darwin/24.1.0", "ios"},
		{"script without an origin", "", "curl/8.7.1", ""},
		{"no user agent", "", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			req.Header.Set("User-Agent", tc.userAgent)
			assert.Equal(t, tc.want, signupSource(req))
		})
	}
}
