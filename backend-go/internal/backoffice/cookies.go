package backoffice

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// The session lives in a cookie the page's scripts can't read. The browser
// reaches the API through the back-office's own origin (the Next app proxies
// /api/bo), so the cookie is first-party and SameSite=Strict.
const (
	sessionCookie = "bo_session"
	deviceCookie  = "bo_device"
	cookiePath    = "/api/bo"

	uploadTicketTTL = 10 * time.Minute
	uploadScheme    = "Upload "
	uploadPrefix    = "/api/bo/upload/"
)

func uploadTicketKey(hash string) string { return "bo:upload:" + hash }

func (m *Module) secureCookies() bool {
	return strings.HasPrefix(m.cfg.BackofficeURL, "https://")
}

func (m *Module) setCookie(c echo.Context, name, value string, ttl time.Duration) {
	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     cookiePath,
		HttpOnly: true,
		Secure:   m.secureCookies(),
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(ttl.Seconds()),
	}
	if value == "" {
		cookie.MaxAge = -1
	}
	c.SetCookie(cookie)
}

func cookieValue(c echo.Context, name string) string {
	cookie, err := c.Cookie(name)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// sameOrigin tells whether a request that changes something was sent by the
// back-office itself. SameSite=Strict stops other sites, not a sibling
// subdomain: a script injected on www.esportnews.fr is same-site with
// admin.esportnews.fr, and its requests would carry the cookie.
func (m *Module) sameOrigin(c echo.Context) bool {
	switch c.Request().Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	origin := c.Request().Header.Get(echo.HeaderOrigin)
	if origin == "" {
		return false
	}
	want, err := url.Parse(m.cfg.BackofficeURL)
	got, gerr := url.Parse(origin)
	return err == nil && gerr == nil && want.Scheme == got.Scheme && want.Host == got.Host
}

type uploadTicket struct {
	UserID int64  `json:"uid"`
	Device string `json:"device"`
	City   string `json:"city"`
}

// handleUploadTicket hands the page a short-lived pass for the upload routes.
// Files go straight to the backend: the proxy in front of the back-office caps
// request bodies far below a cover video.
func (m *Module) handleUploadTicket(c echo.Context) error {
	s := sessionOf(c)
	ticket, err := randomToken(32)
	if err != nil {
		return m.internal(c, err)
	}
	raw, _ := json.Marshal(uploadTicket{UserID: s.User.ID, Device: s.Device, City: s.City})
	if err := m.cache.Set(c.Request().Context(), uploadTicketKey(hashToken(ticket)), string(raw), uploadTicketTTL); err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"ticket": ticket, "expires_in": int(uploadTicketTTL.Seconds())})
}

// uploadSession turns an upload ticket into the session of the member who
// asked for it. It opens nothing but the upload routes.
func (m *Module) uploadSession(ctx context.Context, c echo.Context) (*Session, bool) {
	auth := c.Request().Header.Get(echo.HeaderAuthorization)
	if !strings.HasPrefix(auth, uploadScheme) || !strings.HasPrefix(c.Request().URL.Path, uploadPrefix) {
		return nil, false
	}
	raw, err := m.cache.GetClient().Get(ctx, uploadTicketKey(hashToken(strings.TrimSpace(auth[len(uploadScheme):])))).Result()
	if err != nil {
		return nil, false
	}
	var t uploadTicket
	if json.Unmarshal([]byte(raw), &t) != nil {
		return nil, false
	}
	user, err := m.userByID(ctx, t.UserID)
	if err != nil || !user.Role.IsTeam() {
		return nil, false
	}
	return &Session{UserID: user.ID, Device: t.Device, City: t.City, User: user}, true
}
