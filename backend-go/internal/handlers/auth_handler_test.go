package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testCache returns a real *cache.RedisCache backed by an in-process miniredis;
// the handler/service constructors need the concrete type, not an interface.
func testCache(t *testing.T) *cache.RedisCache {
	t.Helper()
	mr := miniredis.RunT(t)
	return cache.NewRedisClient("redis://" + mr.Addr())
}

// newTestAuthHandler builds an AuthHandler over the pgx pool (backward-compatible
// constructor — no StorageService needed for these auth-flow tests).
func newTestAuthHandler(t *testing.T, db *pgxpool.Pool) *AuthHandler {
	return NewAuthHandlerWithPool(db, testCache(t), "test-secret")
}

// TestSignupHandler_Success tests successful user signup
func TestSignupHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	payload := models.CreateUserInput{
		Name:     "Test User",
		Email:    "signup@example.com",
		Password: "SecurePass123",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := echo.New().NewContext(req, rec)
	err := newTestAuthHandler(t, db).Signup(c)

	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var user models.User
	err = json.Unmarshal(rec.Body.Bytes(), &user)
	require.NoError(t, err)
	assert.Equal(t, "Test User", user.Name)
	assert.Equal(t, "signup@example.com", user.Email)
}

// TestSignupHandler_WeakPassword tests weak password validation
func TestSignupHandler_WeakPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	payload := models.CreateUserInput{
		Name:     "Test User",
		Email:    "weak@example.com",
		Password: "weak",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := echo.New().NewContext(req, rec)
	_ = newTestAuthHandler(t, db).Signup(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestLoginHandler_Success tests successful login
func TestLoginHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := services.NewAuthService(db, testCache(t), "test-secret")
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "login@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	payload := models.LoginInput{
		Email:    "login@example.com",
		Password: "SecurePass123",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := echo.New().NewContext(req, rec)
	_ = newTestAuthHandler(t, db).Login(c)

	assert.Equal(t, http.StatusOK, rec.Code)

	var authResponse models.AuthResponse
	err = json.Unmarshal(rec.Body.Bytes(), &authResponse)
	require.NoError(t, err)
	assert.NotEmpty(t, authResponse.AccessToken)
	assert.NotEmpty(t, authResponse.RefreshToken)
}

// TestLoginHandler_InvalidCredentials tests login with wrong password
func TestLoginHandler_InvalidCredentials(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := services.NewAuthService(db, testCache(t), "test-secret")
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "wrongpass@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	payload := models.LoginInput{
		Email:    "wrongpass@example.com",
		Password: "WrongPassword123",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := echo.New().NewContext(req, rec)
	_ = newTestAuthHandler(t, db).Login(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestGetMeHandler_WithToken tests getting user profile with a user in context
func TestGetMeHandler_WithToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := services.NewAuthService(db, testCache(t), "test-secret")
	user, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "getme@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user_id", user.ID) // normally set by middleware

	err = newTestAuthHandler(t, db).GetMe(c)
	assert.NoError(t, err)
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
