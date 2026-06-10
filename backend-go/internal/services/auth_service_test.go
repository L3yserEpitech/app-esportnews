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
	"github.com/jackc/pgx/v5/pgxpool"
)

func strPtr(s string) *string { return &s }

// newAuthTestCache returns a real *cache.RedisCache backed by an in-process
// miniredis — NewAuthService needs the concrete type, not an interface.
func newAuthTestCache(t *testing.T) *cache.RedisCache {
	t.Helper()
	mr := miniredis.RunT(t)
	return cache.NewRedisClient("redis://" + mr.Addr())
}

// TestSignup_ValidUser tests successful user registration
func TestSignup_ValidUser(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	input := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "test@example.com",
		Password: "SecurePass123",
	}

	user, err := authService.Signup(context.Background(), input)

	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, "Test User", user.Name)
	assert.Equal(t, "test@example.com", user.Email)
	assert.False(t, user.Admin)
}

// TestSignup_WeakPassword tests password validation
func TestSignup_WeakPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	input := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "weak@example.com",
		Password: "weak", // Less than 8 characters
	}

	user, err := authService.Signup(context.Background(), input)

	assert.Error(t, err)
	assert.Nil(t, user)
	assert.Contains(t, err.Error(), "password must be at least 8 characters")
}

// TestSignup_DuplicateEmail tests duplicate email handling
func TestSignup_DuplicateEmail(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	input := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "duplicate@example.com",
		Password: "SecurePass123",
	}

	// First signup should succeed
	user1, err := authService.Signup(context.Background(), input)
	assert.NoError(t, err)
	assert.NotNil(t, user1)

	// Second signup with same email should fail with the typed sentinel error
	user2, err := authService.Signup(context.Background(), input)
	assert.Error(t, err)
	assert.Nil(t, user2)
	assert.ErrorIs(t, err, ErrEmailAlreadyRegistered)
}

// TestLogin_ValidCredentials tests successful login
func TestLogin_ValidCredentials(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "login@example.com",
		Password: "SecurePass123",
	}
	_, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	loginInput := &models.LoginInput{
		Email:    "login@example.com",
		Password: "SecurePass123",
	}

	response, err := authService.Login(context.Background(), loginInput)

	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)
}

// TestLogin_InvalidPassword tests login with wrong password
func TestLogin_InvalidPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "wrongpass@example.com",
		Password: "SecurePass123",
	}
	_, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	loginInput := &models.LoginInput{
		Email:    "wrongpass@example.com",
		Password: "WrongPassword123",
	}

	response, err := authService.Login(context.Background(), loginInput)

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Contains(t, err.Error(), "invalid email or password")
}

// TestLogin_NonexistentUser tests login with non-existent email
func TestLogin_NonexistentUser(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	loginInput := &models.LoginInput{
		Email:    "nonexistent@example.com",
		Password: "SomePassword123",
	}

	response, err := authService.Login(context.Background(), loginInput)

	assert.Error(t, err)
	assert.Nil(t, response)
	assert.Contains(t, err.Error(), "invalid email or password")
}

// TestGetUser tests user retrieval by ID
func TestGetUser(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "getuser@example.com",
		Password: "SecurePass123",
	}
	createdUser, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	retrievedUser, err := authService.GetUser(context.Background(), createdUser.ID)

	assert.NoError(t, err)
	assert.NotNil(t, retrievedUser)
	assert.Equal(t, createdUser.ID, retrievedUser.ID)
	assert.Equal(t, "Test User", retrievedUser.Name)
}

// TestUpdateProfile tests user profile updates
func TestUpdateProfile(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "update@example.com",
		Password: "SecurePass123",
	}
	createdUser, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	updateInput := &models.UpdateUserInput{
		Name:   strPtr("Updated Name"),
		Email:  strPtr("updated@example.com"),
		Avatar: strPtr("https://example.com/avatar.jpg"),
	}

	updatedUser, err := authService.UpdateProfile(context.Background(), createdUser.ID, updateInput)

	assert.NoError(t, err)
	assert.NotNil(t, updatedUser)
	assert.Equal(t, "Updated Name", updatedUser.Name)
}

// TestRefreshAccessToken tests token refresh functionality
func TestRefreshAccessToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "refresh@example.com",
		Password: "SecurePass123",
	}
	createdUser, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	loginInput := &models.LoginInput{
		Email:    "refresh@example.com",
		Password: "SecurePass123",
	}
	authResponse, err := authService.Login(context.Background(), loginInput)
	require.NoError(t, err)

	newAccessToken, err := authService.RefreshAccessToken(context.Background(), createdUser.ID, authResponse.RefreshToken)

	assert.NoError(t, err)
	assert.NotEmpty(t, newAccessToken)
}

// Helper function to setup test database
func setupTestDB(t *testing.T) *pgxpool.Pool {
	dbURL := "postgres://postgres:postgres@localhost:5432/esportnews_test"
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Test database not available: %v", err)
	}

	// pgxpool connects lazily, so ping explicitly: these are integration tests
	// that must skip (not fail) when the dedicated esportnews_test DB is absent,
	// e.g. in CI or on a box running only the dev database.
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
