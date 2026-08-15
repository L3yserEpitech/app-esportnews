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

// TestRefreshSession covers the rotation that keeps a mobile session alive:
// refreshing must mint a new pair and retire the token that was presented.
func TestRefreshSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	authService := NewAuthService(db, newAuthTestCache(t), "test-secret")

	signupInput := &models.CreateUserInput{
		Name:     "Test User",
		Email:    "refresh@example.com",
		Password: "SecurePass123",
	}
	_, err := authService.Signup(context.Background(), signupInput)
	require.NoError(t, err)

	loginInput := &models.LoginInput{
		Email:    "refresh@example.com",
		Password: "SecurePass123",
	}
	authResponse, err := authService.Login(context.Background(), loginInput)
	require.NoError(t, err)

	refreshed, err := authService.RefreshSession(context.Background(), authResponse.RefreshToken)
	require.NoError(t, err)
	assert.NotEmpty(t, refreshed.AccessToken)
	assert.NotEmpty(t, refreshed.RefreshToken)
	assert.NotEqual(t, authResponse.RefreshToken, refreshed.RefreshToken)

	// The old refresh token is no longer the stored one → refused.
	_, err = authService.RefreshSession(context.Background(), authResponse.RefreshToken)
	assert.Error(t, err)

	// Logging out drops the stored refresh token → no more revival.
	claims, err := authService.VerifyToken(refreshed.AccessToken)
	require.NoError(t, err)
	require.NoError(t, authService.Logout(context.Background(), claims.ID, claims.UserID))
	_, err = authService.RefreshSession(context.Background(), refreshed.RefreshToken)
	assert.Error(t, err)
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

// TestRefreshSessionRejectsUnknownTokens covers the branches that guard the
// endpoint before it ever touches the database, so they run without one.
func TestRefreshSessionRejectsUnknownTokens(t *testing.T) {
	redisCache := newAuthTestCache(t)
	authService := NewAuthService(nil, redisCache, "test-secret")

	token, _, err := utils.GenerateJWT(7, "user@example.com", false, "test-secret", time.Hour)
	require.NoError(t, err)

	// Nothing stored for this user → the session was logged out or expired.
	_, err = authService.RefreshSession(context.Background(), token)
	assert.Error(t, err)

	// A different token is stored → the presented one has been rotated out.
	require.NoError(t, redisCache.Set(context.Background(), cache.RefreshTokenKey(7), "another-token", time.Hour))
	_, err = authService.RefreshSession(context.Background(), token)
	assert.Error(t, err)

	// Signed with the wrong secret → rejected before any lookup.
	forged, _, err := utils.GenerateJWT(7, "user@example.com", false, "other-secret", time.Hour)
	require.NoError(t, err)
	_, err = authService.RefreshSession(context.Background(), forged)
	assert.Error(t, err)
}

// TestPasswordResetGuards covers the branches that answer before touching the
// database, so they run without one.
func TestPasswordResetGuards(t *testing.T) {
	redisCache := newAuthTestCache(t)
	svc := NewAuthService(nil, redisCache, "test-secret")
	ctx := context.Background()

	// Empty address: nothing minted, no lookup.
	token, user, err := svc.RequestPasswordReset(ctx, "   ")
	require.NoError(t, err)
	assert.Empty(t, token)
	assert.Nil(t, user)

	// Throttled address: a second request within the minute is a silent no-op,
	// so the form can't be used to flood someone's inbox.
	email := "user@example.com"
	require.NoError(t, redisCache.Set(ctx, cache.PasswordResetThrottleKey(sha256Hex(email)), "1", time.Minute))
	token, user, err = svc.RequestPasswordReset(ctx, email)
	require.NoError(t, err)
	assert.Empty(t, token)
	assert.Nil(t, user)

	// Casing and spacing must hit the same throttle entry as the stored one.
	token, _, err = svc.RequestPasswordReset(ctx, "  User@Example.com  ")
	require.NoError(t, err)
	assert.Empty(t, token)

	// A token that was never issued is refused, and a short password is caught
	// before the token is even looked up.
	_, err = svc.ResetPassword(ctx, "not-a-real-token", "SecurePass123")
	assert.Error(t, err)
	_, err = svc.ResetPassword(ctx, "not-a-real-token", "short")
	assert.ErrorContains(t, err, "8 caractères")
}

func TestPasswordResetKeysAreHashed(t *testing.T) {
	redisCache := newAuthTestCache(t)
	ctx := context.Background()

	// The Redis key is the hash of the token, never the token: a dump of the
	// cache must not hand out working links.
	raw := "sample-token"
	require.NoError(t, redisCache.Set(ctx, cache.PasswordResetKey(sha256Hex(raw)), "42", time.Minute))

	stored, err := redisCache.Get(ctx, cache.PasswordResetKey(sha256Hex(raw)))
	require.NoError(t, err)
	assert.Equal(t, "42", stored)

	direct, _ := redisCache.Get(ctx, "auth:reset:"+raw)
	assert.Empty(t, direct)
}
