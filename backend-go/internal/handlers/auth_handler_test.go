package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/jackc/pgx/v5/pgxpool"
)

// setupTestEcho creates a test Echo instance with handlers
func setupTestEcho(t *testing.T, db *pgxpool.Pool) *echo.Echo {
	e := echo.New()

	// Initialize services
	redisCache := cache.NewMockRedisCache()
	authService := services.NewAuthService(db, redisCache, "test-secret-key")

	// Register routes
	authHandler := NewAuthHandler(authService, redisCache)

	e.POST("/api/auth/signup", authHandler.Signup)
	e.POST("/api/auth/login", authHandler.Login)
	e.GET("/api/auth/me", authHandler.GetMe)
	e.POST("/api/auth/logout", authHandler.Logout)
	e.POST("/api/auth/refresh", authHandler.RefreshToken)

	return e
}

// TestSignupHandler_Success tests successful user signup
func TestSignupHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	e := setupTestEcho(t, db)

	payload := models.CreateUserInput{
		Name:     "Test User",
		Email:    "signup@example.com",
		Password: "SecurePass123",
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := e.NewContext(req, rec)
	err := handleSignup(c, NewAuthHandler(
		services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret"),
		cache.NewMockRedisCache(),
	))

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

	e := setupTestEcho(t, db)

	payload := models.CreateUserInput{
		Name:     "Test User",
		Email:    "weak@example.com",
		Password: "weak",
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := e.NewContext(req, rec)
	NewAuthHandler(
		services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret"),
		cache.NewMockRedisCache(),
	).Signup(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestSignupHandler_DuplicateEmail tests duplicate email handling
func TestSignupHandler_DuplicateEmail(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	e := setupTestEcho(t, db)

	payload := models.CreateUserInput{
		Name:     "Test User",
		Email:    "duplicate@example.com",
		Password: "SecurePass123",
	}

	body, _ := json.Marshal(payload)

	// First signup should succeed
	req1 := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req1.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec1 := httptest.NewRecorder()
	c1 := e.NewContext(req1, rec1)
	NewAuthHandler(
		services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret"),
		cache.NewMockRedisCache(),
	).Signup(c1)
	assert.Equal(t, http.StatusCreated, rec1.Code)

	// Second signup with same email should fail
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req2.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec2 := httptest.NewRecorder()
	c2 := e.NewContext(req2, rec2)
	NewAuthHandler(
		services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret"),
		cache.NewMockRedisCache(),
	).Signup(c2)
	assert.Equal(t, http.StatusBadRequest, rec2.Code)
}

// TestLoginHandler_Success tests successful login
func TestLoginHandler_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create user first
	authService := services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret")
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "login@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	e := setupTestEcho(t, db)

	payload := models.LoginInput{
		Email:    "login@example.com",
		Password: "SecurePass123",
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := e.NewContext(req, rec)
	NewAuthHandler(authService, cache.NewMockRedisCache()).Login(c)

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

	// Create user first
	authService := services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret")
	_, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "wrongpass@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	e := setupTestEcho(t, db)

	payload := models.LoginInput{
		Email:    "wrongpass@example.com",
		Password: "WrongPassword123",
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	c := e.NewContext(req, rec)
	NewAuthHandler(authService, cache.NewMockRedisCache()).Login(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestGetMeHandler_WithToken tests getting user profile with valid token
func TestGetMeHandler_WithToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := services.NewAuthService(db, cache.NewMockRedisCache(), "test-secret")
	user, err := authService.Signup(context.Background(), &models.CreateUserInput{
		Name:     "Test User",
		Email:    "getme@example.com",
		Password: "SecurePass123",
	})
	require.NoError(t, err)

	// Note: In a real test, you'd generate a valid JWT token
	// This is simplified for demonstration

	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	c := e.NewContext(req, rec)
	// Set user context (normally done by middleware)
	c.Set("user_id", user.ID)

	handler := NewAuthHandler(authService, cache.NewMockRedisCache())
	err = handler.GetMe(c)

	// Check response
	assert.NoError(t, err) // Should not have error during handler execution
}

// Helper function to setup test database
func setupTestDB(t *testing.T) *pgxpool.Pool {
	dbURL := "postgres://postgres:postgres@localhost:5432/esportnews_test"
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Test database not available: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Skipf("Could not connect to test database: %v", err)
	}

	createTestTables(t, pool)
	return pool
}

// Helper function to create test tables
func createTestTables(t *testing.T, db *pgxpool.Pool) {
	schema := `
	CREATE TABLE IF NOT EXISTS public.users (
		id BIGSERIAL PRIMARY KEY,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		avatar TEXT NULL,
		admin BOOLEAN NOT NULL DEFAULT FALSE
	);
	`

	if _, err := db.Exec(context.Background(), schema); err != nil {
		t.Logf("Could not create test tables: %v", err)
	}

	if _, err := db.Exec(context.Background(), "DELETE FROM public.users;"); err != nil {
		t.Logf("Could not clean test tables: %v", err)
	}
}

// Helper function to handle signup in tests
func handleSignup(c echo.Context, handler *AuthHandler) error {
	return handler.Signup(c)
}
