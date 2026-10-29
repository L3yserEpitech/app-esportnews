package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

// A refused refresh answers the client with a flat 401, while the error the
// handler returns carries the real reason and the user so the access log can
// tell an expired token from a revoked one.
func TestRefreshTokenHandlerKeepsReasonOutOfTheResponse(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := services.NewAuthService(nil, testCache(t), "test-secret")
	h := NewAuthHandler(svc, nil, nil, "", logger)

	token, _, err := utils.GenerateJWT(42, "user@example.com", false, "test-secret", time.Hour)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"`+token+`"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)

	err = h.RefreshToken(c)
	var he *echo.HTTPError
	require.ErrorAs(t, err, &he)
	assert.Equal(t, http.StatusUnauthorized, he.Code)
	assert.Equal(t, "Invalid refresh token", he.Message)
	assert.Contains(t, err.Error(), "user 42")
	assert.Contains(t, err.Error(), "revoked")
}

// With the session store down the backend cannot judge the token, so the
// client must get a 503 it will retry later, never a 401 that signs it out.
func TestRefreshTokenHandlerAnswers503WhenSessionStoreIsDown(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	svc := services.NewAuthService(nil, rc, "test-secret")
	h := NewAuthHandler(svc, nil, nil, "", logger)

	token, _, err := utils.GenerateJWT(42, "user@example.com", false, "test-secret", time.Hour)
	require.NoError(t, err)
	mr.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"`+token+`"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)

	err = h.RefreshToken(c)
	var he *echo.HTTPError
	require.ErrorAs(t, err, &he)
	assert.Equal(t, http.StatusServiceUnavailable, he.Code)
}
