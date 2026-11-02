package services

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

// legacyAccessToken is an access token as minted before iat_ms existed, with
// the "true" value its key carried before per-device sessions.
func legacyAccessToken(t *testing.T, rc *cache.RedisCache, issuedAt time.Time) string {
	t.Helper()
	id := uuid.NewString()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": 7, "email": "user@example.com", "admin": false,
		"jti": id, "iat": issuedAt.Unix(), "exp": issuedAt.Add(accessTokenTTL).Unix(),
	}).SignedString([]byte("test-secret"))
	require.NoError(t, err)
	require.NoError(t, rc.Set(context.Background(), cache.JWTKey(id), "true", accessTokenTTL))
	return token
}

func TestVerifyTokenAcceptsLiveAccessToken(t *testing.T) {
	svc, _, _ := newSessionService(t)
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	claims, err := svc.VerifyToken(session.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, int64(7), claims.UserID)
}

func TestVerifyTokenAcceptsAccessTokenMintedBeforeThisFix(t *testing.T) {
	svc, rc, _ := newSessionService(t)
	token := legacyAccessToken(t, rc, time.Now().Add(-24*time.Hour))

	_, err := svc.VerifyToken(token)
	assert.NoError(t, err)
}

func TestVerifyTokenRefusesRefreshTokenAsBearer(t *testing.T) {
	svc, _, _ := newSessionService(t)
	ctx := context.Background()
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	_, err = svc.VerifyToken(session.RefreshToken)
	assert.ErrorIs(t, err, ErrSessionRevoked)

	rotated, err := svc.RefreshSession(ctx, session.RefreshToken)
	require.NoError(t, err)
	_, err = svc.VerifyToken(rotated.RefreshToken)
	assert.ErrorIs(t, err, ErrSessionRevoked)
	_, err = svc.VerifyToken(rotated.AccessToken)
	assert.NoError(t, err)
}

func TestVerifyTokenRefusesSignedTokenWithoutSession(t *testing.T) {
	svc, _, _ := newSessionService(t)
	token, _, err := utils.GenerateJWT(7, "user@example.com", true, "test-secret", time.Hour)
	require.NoError(t, err)

	_, err = svc.VerifyToken(token)
	assert.ErrorIs(t, err, ErrSessionRevoked)
}

func TestLogoutEndsThisAccessTokenOnly(t *testing.T) {
	svc, _, _ := newSessionService(t)
	ctx := context.Background()
	user := &models.User{ID: 7, Email: "user@example.com"}
	phone, err := svc.issueSession(user)
	require.NoError(t, err)
	tablet, err := svc.issueSession(user)
	require.NoError(t, err)

	claims, err := svc.VerifyToken(phone.AccessToken)
	require.NoError(t, err)
	require.NoError(t, svc.Logout(ctx, claims.ID, claims.UserID))

	_, err = svc.VerifyToken(phone.AccessToken)
	assert.ErrorIs(t, err, ErrSessionRevoked)
	_, err = svc.VerifyToken(tablet.AccessToken)
	assert.NoError(t, err)
}

func TestRevokeAllSessionsEndsEveryAccessToken(t *testing.T) {
	svc, rc, _ := newSessionService(t)
	ctx := context.Background()
	user := &models.User{ID: 7, Email: "user@example.com"}
	phone, err := svc.issueSession(user)
	require.NoError(t, err)
	tablet, err := svc.issueSession(user)
	require.NoError(t, err)
	legacy := legacyAccessToken(t, rc, time.Now())
	other, err := svc.issueSession(&models.User{ID: 8, Email: "other@example.com"})
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)
	require.NoError(t, svc.RevokeAllSessions(ctx, user.ID))

	for _, token := range []string{phone.AccessToken, tablet.AccessToken, legacy} {
		_, err = svc.VerifyToken(token)
		assert.ErrorIs(t, err, ErrSessionRevoked)
	}
	_, err = svc.VerifyToken(other.AccessToken)
	assert.NoError(t, err, "another user's session must survive")
}

// A password reset revokes then opens a session within the same instant: that
// session must work every time, however fine the clock.
func TestSessionOpenedRightAfterRevocationIsLive(t *testing.T) {
	svc, _, _ := newSessionService(t)
	ctx := context.Background()
	user := &models.User{ID: 7, Email: "user@example.com"}

	for i := 0; i < 200; i++ {
		require.NoError(t, svc.RevokeAllSessions(ctx, user.ID))
		session, err := svc.issueSession(user)
		require.NoError(t, err)
		_, err = svc.VerifyToken(session.AccessToken)
		require.NoError(t, err, "iteration %d", i)
		_, err = svc.RefreshSession(ctx, session.RefreshToken)
		require.NoError(t, err, "iteration %d", i)
	}
}

// The key sweep in RevokeAllSessions walks the whole keyspace and can time out:
// a refresh token it left behind must not bring the session back.
func TestRefreshSessionRefusesTokenThatOutlivedRevocation(t *testing.T) {
	svc, rc, _ := newSessionService(t)
	ctx := context.Background()
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)
	claims, err := utils.VerifyJWT(session.RefreshToken, "test-secret")
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)
	require.NoError(t, svc.RevokeAllSessions(ctx, 7))
	require.NoError(t, rc.Set(ctx, cache.RefreshTokenKey(7, claims.ID), "1", refreshTokenTTL))

	_, err = svc.RefreshSession(ctx, session.RefreshToken)
	assert.ErrorIs(t, err, ErrRefreshTokenRevoked)
}

func TestRevocationOutlivesEveryTokenItCovers(t *testing.T) {
	svc, _, mr := newSessionService(t)
	require.NoError(t, svc.RevokeAllSessions(context.Background(), 7))
	assert.GreaterOrEqual(t, mr.TTL(cache.SessionsRevokedBeforeKey(7)), refreshTokenTTL)
}

// Redis down: the signature is all that can be checked. Refusing would sign out
// every client during an Upstash hiccup; a forged token still fails.
func TestVerifyTokenFailsOpenWhenSessionStoreIsDown(t *testing.T) {
	svc, _, mr := newSessionService(t)
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)
	forged, _, err := utils.GenerateJWT(7, "user@example.com", true, "other-secret", time.Hour)
	require.NoError(t, err)

	mr.Close()

	_, err = svc.VerifyToken(session.AccessToken)
	assert.NoError(t, err)
	_, err = svc.VerifyToken(forged)
	assert.Error(t, err)
}

// Falling back on iat must not read an old-format token minted after a
// revocation as older than it.
func TestRevocationSparesOldFormatTokenIssuedAfterIt(t *testing.T) {
	svc, rc, _ := newSessionService(t)
	require.NoError(t, svc.RevokeAllSessions(context.Background(), 7))
	token := legacyAccessToken(t, rc, time.Now().Add(2*time.Second))

	_, err := svc.VerifyToken(token)
	assert.NoError(t, err)
}

// A pair Redis never recorded would die as soon as Redis comes back: better an
// error the client retries than a session that signs out on its own.
func TestIssueSessionReportsStoreOutage(t *testing.T) {
	svc, _, mr := newSessionService(t)
	mr.Close()
	_, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	assert.ErrorIs(t, err, ErrSessionStoreUnavailable)
}

func TestRefreshKeepsTheTokenWhenTheNewPairCannotBeRecorded(t *testing.T) {
	svc, _, mr := newSessionService(t)
	ctx := context.Background()
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	stub := svc.lookupUser
	svc.lookupUser = func(ctx context.Context, userID int64) (*models.User, error) {
		mr.SetError("LOADING")
		return stub(ctx, userID)
	}
	_, err = svc.RefreshSession(ctx, session.RefreshToken)
	assert.ErrorIs(t, err, ErrSessionStoreUnavailable)

	mr.SetError("")
	svc.lookupUser = stub
	_, err = svc.RefreshSession(ctx, session.RefreshToken)
	assert.NoError(t, err, "the token that could not be rotated still works")
}

func TestVerifyTokenStrictRefusesWhenSessionStoreIsDown(t *testing.T) {
	svc, _, mr := newSessionService(t)
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)

	_, err = svc.VerifyTokenStrict(session.AccessToken)
	require.NoError(t, err)

	mr.Close()
	_, err = svc.VerifyTokenStrict(session.AccessToken)
	assert.ErrorIs(t, err, ErrSessionStoreUnavailable)
}

func TestVerifySignatureAcceptsEndedSessionOnly(t *testing.T) {
	svc, _, _ := newSessionService(t)
	ctx := context.Background()
	session, err := svc.issueSession(&models.User{ID: 7, Email: "user@example.com"})
	require.NoError(t, err)
	claims, err := svc.VerifyToken(session.AccessToken)
	require.NoError(t, err)
	require.NoError(t, svc.Logout(ctx, claims.ID, claims.UserID))

	ended, err := svc.VerifySignature(session.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, int64(7), ended.UserID)

	forged, _, err := utils.GenerateJWT(7, "user@example.com", false, "other-secret", time.Hour)
	require.NoError(t, err)
	_, err = svc.VerifySignature(forged)
	assert.Error(t, err)
}
