package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
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
