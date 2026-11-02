package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

func TestRequireAdminRefusesEndedSessions(t *testing.T) {
	mr := miniredis.RunT(t)
	svc := services.NewAuthService(nil, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	session, err := svc.LoginAfterSignup(context.Background(), &models.User{ID: 1, Email: "admin@example.com", Admin: true})
	require.NoError(t, err)

	guarded := RequireAdmin(svc)(func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	call := func(token string) int {
		req := httptest.NewRequest(http.MethodGet, "/api/admin/ads", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		if err := guarded(echo.New().NewContext(req, rec)); err != nil {
			return err.(*echo.HTTPError).Code
		}
		return rec.Code
	}

	assert.Equal(t, http.StatusOK, call(session.AccessToken))
	assert.Equal(t, http.StatusUnauthorized, call(session.RefreshToken), "a refresh token opens no admin route")

	claims, err := svc.VerifyToken(session.AccessToken)
	require.NoError(t, err)
	require.NoError(t, svc.Logout(context.Background(), claims.ID, claims.UserID))
	assert.Equal(t, http.StatusUnauthorized, call(session.AccessToken))

	// Redis down: the rest of the site runs on the signature alone, admin does not.
	live, err := svc.LoginAfterSignup(context.Background(), &models.User{ID: 1, Email: "admin@example.com", Admin: true})
	require.NoError(t, err)
	mr.Close()
	assert.Equal(t, http.StatusServiceUnavailable, call(live.AccessToken))
	assert.Equal(t, http.StatusServiceUnavailable, call(live.RefreshToken))
}
