package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testCache returns a real *cache.RedisCache backed by an in-process miniredis;
// the handler/service constructors need the concrete type, not an interface.
func testCache(t *testing.T) *cache.RedisCache {
	t.Helper()
	mr := miniredis.RunT(t)
	return cache.NewRedisClient("redis://" + mr.Addr())
}

// newTestAuthServer serves the real auth routes the way main.go wires them: same
// constructor, same validator, and Echo's error handler turning a handler's error
// into its HTTP status.
func newTestAuthServer(t *testing.T, db *pgxpool.Pool) (*echo.Echo, *services.AuthService) {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	authService := services.NewAuthService(db, testCache(t), "test-secret")
	e := echo.New()
	e.Validator = utils.NewEchoValidator()
	NewAuthHandler(authService, nil, nil, "", logger).RegisterRoutes(e.Group("/api"))
	return e, authService
}

func authRequest(e *echo.Echo, method, path string, payload interface{}, token string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// TestSignupHandler_Success tests successful user signup
func TestSignupHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, _ := newTestAuthServer(t, db)

	rec := authRequest(e, http.MethodPost, "/api/auth/signup", models.CreateUserInput{
		Name:     "Test User",
		Email:    "signup@example.com",
		Password: "SecurePass123",
	}, "")
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var response models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)
	require.NotNil(t, response.User)
	assert.Equal(t, "Test User", response.User.Name)
	assert.Equal(t, "signup@example.com", response.User.Email)
}

// TestSignupHandler_WeakPassword tests weak password validation
func TestSignupHandler_WeakPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, _ := newTestAuthServer(t, db)

	rec := authRequest(e, http.MethodPost, "/api/auth/signup", models.CreateUserInput{
		Name:     "Test User",
		Email:    "weak@example.com",
		Password: "weak",
	}, "")

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestLoginHandler_Success tests successful login
func TestLoginHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)

	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "login@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{
		Email:    "login@example.com",
		Password: "SecurePass123",
	}, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var authResponse models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &authResponse))
	assert.NotEmpty(t, authResponse.AccessToken)
	assert.NotEmpty(t, authResponse.RefreshToken)
}

// TestLoginHandler_InvalidCredentials tests login with wrong password
func TestLoginHandler_InvalidCredentials(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)

	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "wrongpass@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{
		Email:    "wrongpass@example.com",
		Password: "WrongPassword123",
	}, "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestGetMeHandler_WithToken tests getting the profile of the token's owner
func TestGetMeHandler_WithToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)

	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "getme@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)
	session, err := authService.Login(context.Background(), &models.LoginInput{
		Email:    "getme@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	rec := authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Body.String(), "getme@example.com")

	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, "").Code)
}

// setupTestDB connects to the dedicated integration database, skipping when it
// is unreachable (CI, or a box running only the dev database). pgxpool connects
// lazily, so ping explicitly.
func setupTestDB(t *testing.T) *pgxpool.Pool {
	dbURL := "postgres://postgres:postgres@localhost:5432/esportnews_test"
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Test database not available: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Skipf("Could not create test pool: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("Test database not reachable: %v", err)
	}

	createTestTables(t, pool)
	return pool
}

// createTestTables ensures a clean users table for each test run.
func createTestTables(t *testing.T, db *pgxpool.Pool) {
	schema := `
	CREATE TABLE IF NOT EXISTS public.users (
		id BIGSERIAL PRIMARY KEY,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		avatar TEXT NULL,
		admin BOOLEAN NOT NULL DEFAULT FALSE,
		age INTEGER NULL
	);
	`
	if _, err := db.Exec(context.Background(), schema); err != nil {
		t.Logf("Could not create test tables: %v", err)
	}
	if _, err := db.Exec(context.Background(), "DELETE FROM public.users;"); err != nil {
		t.Logf("Could not clean test tables: %v", err)
	}
}

func loginForTokens(t *testing.T, e *echo.Echo, email, password string) models.AuthResponse {
	t.Helper()
	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{Email: email, Password: password}, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var session models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &session))
	return session
}

// Over the real routes: what a thief holding each kind of token can still do.
func TestBearerRoutesRefuseEndedSessions(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name: "Test User", Email: "bearer@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "bearer@example.com", "SecurePass123")

	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code)
	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.RefreshToken).Code,
		"a refresh token is not a Bearer token")

	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodPost, "/api/auth/logout", nil, session.AccessToken).Code)
	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code,
		"an access token dies with its logout")
}

func TestResetPasswordEndsEveryPreviousSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	stolen := loginForTokens(t, e, "reset@example.com", "SecurePass123")

	time.Sleep(2 * time.Millisecond)
	resetToken, _, err := authService.RequestPasswordReset(ctx, "reset@example.com")
	require.NoError(t, err)
	fresh, err := authService.ResetPassword(ctx, resetToken, "AnotherPass456")
	require.NoError(t, err)

	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, stolen.AccessToken).Code)
	_, err = authService.RefreshSession(ctx, stolen.RefreshToken)
	assert.Error(t, err)
	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, fresh.AccessToken).Code)
}

// A mistyped password must not cost the session.
func TestDeleteAccountWrongPasswordKeepsTheSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name: "Test User", Email: "delete@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "delete@example.com", "SecurePass123")

	rec := authRequest(e, http.MethodDelete, "/api/auth/account", models.DeleteAccountInput{Password: "wrong-password"}, session.AccessToken)
	require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code)

	rec = authRequest(e, http.MethodDelete, "/api/auth/account", models.DeleteAccountInput{Password: "SecurePass123"}, session.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code)
}

// Production builds the service on GORM, the other tests go through pgx.
func TestDeleteAccountOnGORMEndsTheSession(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}))
	const email = "delete-gorm@example.com"
	require.NoError(t, db.Exec(`DELETE FROM users WHERE email = ?`, email).Error)
	t.Cleanup(func() { db.Exec(`DELETE FROM users WHERE email = ?`, email) })

	svc := services.NewAuthServiceWithGORM(&database.Database{DB: db}, testCache(t), "test-secret")
	ctx := context.Background()
	user, err := svc.Signup(ctx, &models.CreateUserInput{Name: "Test User", Email: email, Password: "SecurePass123"})
	require.NoError(t, err)
	session, err := svc.LoginAfterSignup(ctx, user)
	require.NoError(t, err)

	require.NoError(t, svc.DeleteAccount(ctx, user.ID, "SecurePass123"))

	_, err = svc.VerifyToken(session.AccessToken)
	assert.ErrorIs(t, err, services.ErrSessionRevoked)
	_, err = svc.RefreshSession(ctx, session.RefreshToken)
	assert.ErrorIs(t, err, services.ErrRefreshTokenRevoked)
}

// With Redis down the password may be right, but no session can be recorded:
// a 503 the client retries, not a "wrong password".
func TestLoginAnswers503WhenSessionStoreIsDown(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	mr := miniredis.RunT(t)
	svc := services.NewAuthService(db, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	e := echo.New()
	e.Validator = utils.NewEchoValidator()
	NewAuthHandler(svc, nil, nil, "", logger).RegisterRoutes(e.Group("/api"))
	_, err := svc.Signup(context.Background(), &models.CreateUserInput{Name: "Test User", Email: "outage@example.com", Password: "SecurePass123"})
	require.NoError(t, err)

	mr.Close()
	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{Email: "outage@example.com", Password: "SecurePass123"}, "")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
}

func changePasswordRequest(current, next string) models.ChangePasswordInput {
	return models.ChangePasswordInput{CurrentPassword: current, NewPassword: next}
}

// The stolen session is the point: it must not survive the change, while the
// device that made it carries on with the pair it gets back.
func TestChangePasswordEndsEverySessionAndHandsBackANewOne(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "change@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	phone := loginForTokens(t, e, "change@example.com", "SecurePass123")
	stolen := loginForTokens(t, e, "change@example.com", "SecurePass123")

	time.Sleep(2 * time.Millisecond)
	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("SecurePass123", "AnotherPass456"), phone.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var fresh models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &fresh))
	require.NotEmpty(t, fresh.AccessToken)
	require.NotEmpty(t, fresh.RefreshToken)
	assert.Contains(t, rec.Body.String(), `"message"`, "the published app reads no more than this")

	for _, old := range []models.AuthResponse{phone, stolen} {
		assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, old.AccessToken).Code)
		_, err = authService.RefreshSession(ctx, old.RefreshToken)
		assert.Error(t, err)
	}

	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, fresh.AccessToken).Code)
	_, err = authService.RefreshSession(ctx, fresh.RefreshToken)
	assert.NoError(t, err)

	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodPost, "/api/auth/login",
		models.LoginInput{Email: "change@example.com", Password: "SecurePass123"}, "").Code)
	loginForTokens(t, e, "change@example.com", "AnotherPass456")
}

// A token whose refresh was consumed just before the change must not replay
// its way back in.
func TestChangePasswordClosesTheRefreshReplayWindow(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "replay@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "replay@example.com", "SecurePass123")
	rotated, err := authService.RefreshSession(ctx, session.RefreshToken)
	require.NoError(t, err)

	time.Sleep(2 * time.Millisecond)
	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("SecurePass123", "AnotherPass456"), rotated.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	_, err = authService.RefreshSession(ctx, session.RefreshToken)
	assert.Error(t, err)
	_, err = authService.RefreshSession(ctx, rotated.RefreshToken)
	assert.Error(t, err)
}

func TestChangePasswordWrongCurrentKeepsTheSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name: "Test User", Email: "wrongcurrent@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "wrongcurrent@example.com", "SecurePass123")

	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("nope-nope-nope", "AnotherPass456"), session.AccessToken)
	assert.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code)
	loginForTokens(t, e, "wrongcurrent@example.com", "SecurePass123")
}

// With Redis down the sessions couldn't be ended: the password must not move.
func TestChangePasswordRefusedWhenSessionStoreIsDown(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	mr := miniredis.RunT(t)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	authService := services.NewAuthService(db, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	e := echo.New()
	e.Validator = utils.NewEchoValidator()
	NewAuthHandler(authService, nil, nil, "", logger).RegisterRoutes(e.Group("/api"))
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "storedown@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "storedown@example.com", "SecurePass123")
	mr.Close()

	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("SecurePass123", "AnotherPass456"), session.AccessToken)
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())

	var hash string
	require.NoError(t, db.QueryRow(ctx, `SELECT password FROM public.users WHERE email = $1`, "storedown@example.com").Scan(&hash))
	assert.NoError(t, utils.VerifyPassword(hash, "SecurePass123"))
}

// Production builds the service on GORM, the other tests go through pgx.
func TestChangePasswordOnGORMEndsEverySession(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}))
	const email = "change-gorm@example.com"
	require.NoError(t, db.Exec(`DELETE FROM users WHERE email = ?`, email).Error)
	t.Cleanup(func() { db.Exec(`DELETE FROM users WHERE email = ?`, email) })

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	authService := services.NewAuthServiceWithGORM(&database.Database{DB: db}, testCache(t), "test-secret")
	e := echo.New()
	e.Validator = utils.NewEchoValidator()
	NewAuthHandler(authService, nil, nil, "", logger).RegisterRoutes(e.Group("/api"))

	ctx := context.Background()
	_, err = authService.Signup(ctx, &models.CreateUserInput{Name: "Test User", Email: email, Password: "SecurePass123"})
	require.NoError(t, err)
	session := loginForTokens(t, e, email, "SecurePass123")

	time.Sleep(2 * time.Millisecond)
	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("SecurePass123", "AnotherPass456"), session.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var fresh models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &fresh))

	assert.Equal(t, http.StatusUnauthorized, authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken).Code)
	assert.Equal(t, http.StatusOK, authRequest(e, http.MethodGet, "/api/auth/me", nil, fresh.AccessToken).Code)
}

func resetRequest(token, password string) map[string]string {
	return map[string]string{"token": token, "password": password}
}

// A leaked link must not open several sessions: "single use" has to hold when
// the requests land together, not only one after the other.
func TestResetPasswordLinkWorksOnceUnderConcurrency(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset-race@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	token, _, err := authService.RequestPasswordReset(ctx, "reset-race@example.com")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	const attempts = 6
	codes := make([]int, attempts)
	var start, done sync.WaitGroup
	start.Add(1)
	for i := 0; i < attempts; i++ {
		done.Add(1)
		go func(i int) {
			defer done.Done()
			start.Wait()
			codes[i] = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "AnotherPass456"), "").Code
		}(i)
	}
	start.Done()
	done.Wait()

	wins := 0
	for _, code := range codes {
		if code == http.StatusOK {
			wins++
		} else {
			assert.Equal(t, http.StatusBadRequest, code)
		}
	}
	assert.Equal(t, 1, wins, "codes: %v", codes)
}

// The victim changed the password or the address because something was wrong:
// a link sent before that must not outlive it.
func TestPendingResetLinkDiesWithPasswordChange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset-change@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "reset-change@example.com", "SecurePass123")
	token, _, err := authService.RequestPasswordReset(ctx, "reset-change@example.com")
	require.NoError(t, err)

	rec := authRequest(e, http.MethodPost, "/api/auth/change-password", changePasswordRequest("SecurePass123", "AnotherPass456"), session.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "ThirdPass789012"), "")
	assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
}

func TestPendingResetLinkDiesWithEmailChange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset-email@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "reset-email@example.com", "SecurePass123")
	token, _, err := authService.RequestPasswordReset(ctx, "reset-email@example.com")
	require.NoError(t, err)

	rec := authRequest(e, http.MethodPost, "/api/auth/me", map[string]string{"name": "Test User", "email": "reset-email2@example.com"}, session.AccessToken)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "ThirdPass789012"), "")
	assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
}

func TestResetPasswordLinkStillWorksWhenUntouched(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset-ok@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	token, _, err := authService.RequestPasswordReset(ctx, "reset-ok@example.com")
	require.NoError(t, err)

	rec := authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "short"), "")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "AnotherPass456"), "")
	require.Equal(t, http.StatusOK, rec.Code, "a rejected password doesn't spend the link: %s", rec.Body.String())
	loginForTokens(t, e, "reset-ok@example.com", "AnotherPass456")

	rec = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "ThirdPass789012"), "")
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// Postgres down is not "wrong password" nor "no such user": a 401 or a 404 here
// tells the client something false about the account.
func TestAuthRoutesAnswer503WhenDatabaseIsDown(t *testing.T) {
	db := setupTestDB(t)
	e, authService := newTestAuthServer(t, db)
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name: "Test User", Email: "dbdown@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	session := loginForTokens(t, e, "dbdown@example.com", "SecurePass123")

	db.Close()

	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{Email: "dbdown@example.com", Password: "SecurePass123"}, "")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
	rec = authRequest(e, http.MethodPost, "/api/auth/refresh", map[string]string{"refresh_token": session.RefreshToken}, "")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
	rec = authRequest(e, http.MethodGet, "/api/auth/me", nil, session.AccessToken)
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
}

func TestLoginUnknownAccountStaysUnauthorized(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, _ := newTestAuthServer(t, db)
	rec := authRequest(e, http.MethodPost, "/api/auth/login", models.LoginInput{Email: "nobody@example.com", Password: "SecurePass123"}, "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
}

// Requests landing together must not each get past the throttle with a link of
// their own: one would survive a reset made with another.
func TestForgotPasswordMintsOneLinkUnderConcurrency(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	_, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "forgot-race@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)

	const attempts = 8
	tokens := make([]string, attempts)
	var start, done sync.WaitGroup
	start.Add(1)
	for i := 0; i < attempts; i++ {
		done.Add(1)
		go func(i int) {
			defer done.Done()
			start.Wait()
			tokens[i], _, _ = authService.RequestPasswordReset(ctx, "forgot-race@example.com")
		}(i)
	}
	start.Done()
	done.Wait()

	minted := 0
	for _, token := range tokens {
		if token != "" {
			minted++
		}
	}
	assert.Equal(t, 1, minted)
}

// An outage isn't the link's fault: the user is told to retry, and the same link works.
func TestResetPasswordOutageKeepsTheLink(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	e, authService := newTestAuthServer(t, db)
	ctx := context.Background()
	_, err := authService.Signup(ctx, &models.CreateUserInput{
		Name: "Test User", Email: "reset-outage@example.com", Password: "SecurePass123",
	})
	require.NoError(t, err)
	token, _, err := authService.RequestPasswordReset(ctx, "reset-outage@example.com")
	require.NoError(t, err)

	_, err = db.Exec(ctx, `
		CREATE OR REPLACE FUNCTION refuse_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'down'; END $$ LANGUAGE plpgsql;
		CREATE TRIGGER refuse_update BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION refuse_update();`)
	require.NoError(t, err)
	drop := func() { db.Exec(ctx, `DROP TRIGGER IF EXISTS refuse_update ON public.users`) }
	defer drop()

	rec := authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "AnotherPass456"), "")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, rec.Body.String())
	loginForTokens(t, e, "reset-outage@example.com", "SecurePass123")

	drop()
	rec = authRequest(e, http.MethodPost, "/api/auth/reset-password", resetRequest(token, "AnotherPass456"), "")
	assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}
