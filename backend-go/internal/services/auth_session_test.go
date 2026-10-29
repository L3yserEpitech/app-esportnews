package services

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

// newSessionService builds an AuthService on an in-process miniredis with the
// user lookup stubbed, so the refresh/logout paths run without Postgres.
func newSessionService(t *testing.T) (*AuthService, *cache.RedisCache, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	svc := NewAuthService(nil, rc, "test-secret")
	svc.lookupUser = func(_ context.Context, userID int64) (*models.User, error) {
		return &models.User{ID: userID, Email: "user@example.com"}, nil
	}
	return svc, rc, mr
}

func TestRefreshSessionIsPerDevice(t *testing.T) {
	svc, _, _ := newSessionService(t)
	user := &models.User{ID: 7, Email: "user@example.com"}
	ctx := context.Background()

	phone, err := svc.issueSession(user)
	require.NoError(t, err)
	tablet, err := svc.issueSession(user)
	require.NoError(t, err)

	_, err = svc.RefreshSession(ctx, phone.RefreshToken)
	require.NoError(t, err)

	// Rotating the phone's session must leave the tablet's untouched.
	_, err = svc.RefreshSession(ctx, tablet.RefreshToken)
	assert.NoError(t, err)
}

func TestRefreshSessionReplaysLostResponseWithinGrace(t *testing.T) {
	svc, _, mr := newSessionService(t)
	ctx := context.Background()
	first, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	rotated, err := svc.RefreshSession(ctx, first.RefreshToken)
	require.NoError(t, err)

	// The client never persisted `rotated` (timeout, app killed): presenting
	// the consumed token again hands back the very same pair, nothing new.
	again, err := svc.RefreshSession(ctx, first.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, rotated.AccessToken, again.AccessToken)
	assert.Equal(t, rotated.RefreshToken, again.RefreshToken)

	// The replayed pair is live and rotates normally.
	_, err = svc.RefreshSession(ctx, rotated.RefreshToken)
	require.NoError(t, err)

	mr.FastForward(refreshReplayGrace + time.Second)
	_, err = svc.RefreshSession(ctx, first.RefreshToken)
	assert.ErrorIs(t, err, ErrRefreshTokenRevoked)
}

func TestRefreshSessionRevokedNamesUser(t *testing.T) {
	svc, _, _ := newSessionService(t)
	token, _, err := utils.GenerateJWT(42, "user@example.com", false, "test-secret", time.Hour)
	require.NoError(t, err)

	_, err = svc.RefreshSession(context.Background(), token)
	require.ErrorIs(t, err, ErrRefreshTokenRevoked)
	assert.Contains(t, err.Error(), "user 42")
}

func TestRefreshSessionExpiredTokenIsInvalid(t *testing.T) {
	svc, _, _ := newSessionService(t)
	expired, _, err := utils.GenerateJWT(42, "user@example.com", false, "test-secret", -time.Minute)
	require.NoError(t, err)

	_, err = svc.RefreshSession(context.Background(), expired)
	assert.ErrorIs(t, err, ErrRefreshTokenInvalid)
}

func TestLogoutRevokesOnlyThatDevice(t *testing.T) {
	svc, _, _ := newSessionService(t)
	user := &models.User{ID: 7, Email: "user@example.com"}
	ctx := context.Background()

	phone, err := svc.issueSession(user)
	require.NoError(t, err)
	tablet, err := svc.issueSession(user)
	require.NoError(t, err)

	claims, err := svc.VerifyToken(phone.AccessToken)
	require.NoError(t, err)
	require.NoError(t, svc.Logout(ctx, claims.ID, claims.UserID))

	_, err = svc.RefreshSession(ctx, phone.RefreshToken)
	assert.ErrorIs(t, err, ErrRefreshTokenRevoked)
	_, err = svc.RefreshSession(ctx, tablet.RefreshToken)
	assert.NoError(t, err)
}

func TestRevokeAllSessionsBlocksEveryDeviceAndReplay(t *testing.T) {
	svc, _, _ := newSessionService(t)
	user := &models.User{ID: 7, Email: "user@example.com"}
	ctx := context.Background()

	phone, err := svc.issueSession(user)
	require.NoError(t, err)
	tablet, err := svc.issueSession(user)
	require.NoError(t, err)
	// Consume the phone token so a replay entry exists for it.
	_, err = svc.RefreshSession(ctx, phone.RefreshToken)
	require.NoError(t, err)

	require.NoError(t, svc.RevokeAllSessions(ctx, user.ID))

	_, err = svc.RefreshSession(ctx, tablet.RefreshToken)
	assert.ErrorIs(t, err, ErrRefreshTokenRevoked)
	// A password reset must not leave a one-hour window where the consumed
	// token still hands out the pair it was rotated into.
	_, err = svc.RefreshSession(ctx, phone.RefreshToken)
	assert.ErrorIs(t, err, ErrRefreshTokenRevoked)
}

func TestRefreshSessionAcceptsLegacyStoredToken(t *testing.T) {
	svc, rc, _ := newSessionService(t)
	ctx := context.Background()
	// Sessions opened before per-device keys: the token itself sits under
	// the per-user key. They must survive the deploy, not log everyone out.
	legacy, _, err := utils.GenerateJWT(7, "user@example.com", false, "test-secret", refreshTokenTTL)
	require.NoError(t, err)
	require.NoError(t, rc.Set(ctx, cache.LegacyRefreshTokenKey(7), legacy, refreshTokenTTL))

	resp, err := svc.RefreshSession(ctx, legacy)
	require.NoError(t, err)

	gone, err := rc.Exists(ctx, cache.LegacyRefreshTokenKey(7))
	require.NoError(t, err)
	assert.False(t, gone, "legacy key must be retired once migrated")

	// The new pair lives in the per-device scheme.
	_, err = svc.RefreshSession(ctx, resp.RefreshToken)
	assert.NoError(t, err)
}

func TestRefreshSessionReportsStoreOutage(t *testing.T) {
	svc, _, mr := newSessionService(t)
	ctx := context.Background()
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	// Redis gone: nobody can tell whether the token is registered, so the
	// answer must not read as "session over" (the phone would sign out).
	mr.Close()
	_, err = svc.RefreshSession(ctx, session.RefreshToken)
	assert.ErrorIs(t, err, ErrSessionStoreUnavailable)
	assert.NotErrorIs(t, err, ErrRefreshTokenRevoked)
}
