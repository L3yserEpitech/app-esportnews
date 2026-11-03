package middleware

import (
	"context"
	"errors"
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
	svc.LookupUser = func(_ context.Context, userID int64) (*models.User, error) {
		return &models.User{ID: userID, Email: "admin@example.com", Admin: true}, nil
	}
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

// The token says what the role was when it was minted, up to 7 days ago: only
// the database says what it is now.
func TestRequireAdminReadsTheRoleFromTheDatabase(t *testing.T) {
	mr := miniredis.RunT(t)
	svc := services.NewAuthService(nil, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	ctx := context.Background()

	var current *models.User
	var lookupErr error
	svc.LookupUser = func(context.Context, int64) (*models.User, error) { return current, lookupErr }

	var seen echo.Context
	guarded := RequireAdmin(svc)(func(c echo.Context) error {
		seen = c
		return c.NoContent(http.StatusOK)
	})
	call := func(token string) int {
		seen = nil
		req := httptest.NewRequest(http.MethodGet, "/api/admin/ads", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		if err := guarded(echo.New().NewContext(req, rec)); err != nil {
			return err.(*echo.HTTPError).Code
		}
		return rec.Code
	}

	mintedAdmin, err := svc.LoginAfterSignup(ctx, &models.User{ID: 1, Email: "old@example.com", Admin: true})
	require.NoError(t, err)
	mintedUser, err := svc.LoginAfterSignup(ctx, &models.User{ID: 2, Email: "user@example.com", Admin: false})
	require.NoError(t, err)

	current = &models.User{ID: 1, Email: "new@example.com", Admin: true}
	assert.Equal(t, http.StatusOK, call(mintedAdmin.AccessToken))
	assert.Equal(t, int64(1), seen.Get("user_id"))
	assert.Equal(t, "new@example.com", seen.Get("user_email"))
	assert.Equal(t, true, seen.Get("is_admin"))

	current = &models.User{ID: 1, Email: "new@example.com", Admin: false}
	assert.Equal(t, http.StatusForbidden, call(mintedAdmin.AccessToken), "demoted: refused at once, whatever the token says")

	current = &models.User{ID: 2, Email: "user@example.com", Admin: true}
	assert.Equal(t, http.StatusOK, call(mintedUser.AccessToken), "promoted: no need to log in again")

	current, lookupErr = nil, services.ErrUserNotFound
	assert.Equal(t, http.StatusUnauthorized, call(mintedAdmin.AccessToken), "deleted account")

	lookupErr = errors.New("connection refused")
	assert.Equal(t, http.StatusServiceUnavailable, call(mintedAdmin.AccessToken), "role unknown: not a green light, and not a verdict either")
}
