package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

const (
	// Assez long pour relever ses mails, assez court pour qu'un lien qui traîne
	// dans une boîte compromise ne soit plus exploitable.
	passwordResetTTL = time.Hour
	// Une demande par minute et par adresse : empêche d'inonder la boîte d'un
	// tiers en spammant le formulaire.
	passwordResetThrottle = time.Minute

	accessTokenTTL = 7 * 24 * time.Hour
	// Fenêtre glissante : chaque refresh en émet un nouveau et repart de zéro,
	// donc une app ouverte au moins une fois par trimestre ne déconnecte jamais.
	refreshTokenTTL = 90 * 24 * time.Hour
	// A rotated-out refresh token still answers with the pair it was rotated
	// into for this long: a phone that lost the response (timeout, app killed
	// mid-refresh) retries with the token it still holds instead of being
	// logged out. Nothing new is minted on that path.
	refreshReplayGrace = time.Hour
	// Bounds the pool wait and the dial. A read on a stalled connection still
	// takes go-redis' own 3 s, on every authenticated request.
	sessionCheckTimeout = time.Second
)

var (
	ErrRefreshTokenInvalid = errors.New("refresh token invalid or expired")
	ErrRefreshTokenRevoked = errors.New("refresh token revoked")
	// Redis unreachable: the token can't be judged, so the caller must not
	// read the failure as "session over".
	ErrSessionStoreUnavailable = errors.New("session store unavailable")
	ErrSessionRevoked          = errors.New("session revoked")
	ErrUserNotFound            = errors.New("user not found")
	// The role couldn't be read: neither a green light nor a verdict.
	ErrUserStoreUnavailable = errors.New("user store unavailable")
	ErrAdminRequired        = errors.New("admin access required")
)

// ErrEmailAlreadyRegistered is returned when signup hits the users.email UNIQUE constraint.
var ErrEmailAlreadyRegistered = errors.New("email already registered")

// isUniqueViolation reports whether err is a Postgres unique-constraint violation (SQLSTATE 23505)
// on the named constraint. Pass an empty constraint name to match any unique violation.
func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return constraint == "" || pgErr.ConstraintName == constraint
}

const usersEmailUniqueConstraint = "users_email_key"

type AuthService struct {
	db        *pgxpool.Pool      // For backward compatibility
	gormDB    *database.Database // For GORM queries
	Cache     *cache.RedisCache  // Exported for handler access
	JWTSecret string             // Exported for handler access
	// LookupUser is GetUser, swapped by tests so the session paths run
	// without Postgres.
	LookupUser func(ctx context.Context, userID int64) (*models.User, error)
}

// issuedPair is what a consumed refresh token can be replayed into.
type issuedPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// NewAuthService creates a new AuthService with pgxpool
func NewAuthService(db *pgxpool.Pool, redisCache *cache.RedisCache, jwtSecret string) *AuthService {
	s := &AuthService{
		db:        db,
		Cache:     redisCache,
		JWTSecret: jwtSecret,
	}
	s.LookupUser = s.GetUser
	return s
}

// NewAuthServiceWithGORM creates a new AuthService with GORM
func NewAuthServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache, jwtSecret string) *AuthService {
	s := &AuthService{
		gormDB:    gormDB,
		Cache:     redisCache,
		JWTSecret: jwtSecret,
	}
	s.LookupUser = s.GetUser
	return s
}

// GetUserByEmail retrieves a user by email (type-safe with GORM)
func (s *AuthService) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).
			Where("email = ?", email).
			First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, ErrUserNotFound
			}
			return nil, fmt.Errorf("failed to query user: %w", err)
		}
		return &user, nil
	}

	// Fallback to pgxpool
	var user models.User
	var hashedPassword string
	err := s.db.QueryRow(ctx,
		`SELECT id, created_at, name, email, password, avatar, admin, age FROM public.users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &hashedPassword, &user.Avatar, &user.Admin, &user.Age)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	// For pgxpool, we need to handle password separately, so store it in the user struct
	user.Password = hashedPassword
	return &user, nil
}

// Signup creates a new user
func (s *AuthService) Signup(ctx context.Context, input *models.CreateUserInput) (*models.User, error) {
	// Normalize inputs (defense-in-depth — clients should already do this)
	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))

	// Validate password strength
	if len(input.Password) < 8 {
		return nil, fmt.Errorf("password must be at least 8 characters")
	}

	// Validate age if provided
	if input.Age != nil && (*input.Age < 13 || *input.Age > 120) {
		return nil, fmt.Errorf("age must be between 13 and 120 years")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Use GORM if available
	if s.gormDB != nil {
		user := &models.User{
			Name:     name,
			Email:    email,
			Password: hashedPassword,
			Admin:    false,
			Age:      input.Age, // Can be nil
		}

		if err := s.gormDB.WithContext(ctx).Create(user).Error; err != nil {
			if isUniqueViolation(err, usersEmailUniqueConstraint) {
				return nil, ErrEmailAlreadyRegistered
			}
			return nil, fmt.Errorf("failed to create user: %w", err)
		}

		return user, nil
	}

	// Fallback to pgxpool
	var user models.User
	err = s.db.QueryRow(ctx,
		`INSERT INTO public.users (name, email, password, admin, age)
		 VALUES ($1, $2, $3, false, $4)
		 RETURNING id, created_at, name, email, avatar, admin, age`,
		name, email, hashedPassword, input.Age, // Age can be nil
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin, &user.Age)

	if err != nil {
		if isUniqueViolation(err, usersEmailUniqueConstraint) {
			return nil, ErrEmailAlreadyRegistered
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

// issueSession mints an access + refresh token pair for a user and registers
// the refresh token for this device only.
func (s *AuthService) issueSession(user *models.User) (*models.AuthResponse, error) {
	accessToken, accessID, err := utils.GenerateJWT(user.ID, user.Email, user.Admin, s.JWTSecret, accessTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, refreshID, err := utils.GenerateJWT(user.ID, user.Email, user.Admin, s.JWTSecret, refreshTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	// The access token remembers its refresh token so a logout can unregister
	// this device alone.
	if err := s.Cache.Set(cacheCtx, cache.JWTKey(accessID), refreshID, accessTokenTTL); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}
	if err := s.Cache.Set(cacheCtx, cache.RefreshTokenKey(user.ID, refreshID), "1", refreshTokenTTL); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// LoginAfterSignup generates tokens for a newly created user (used after signup)
func (s *AuthService) LoginAfterSignup(ctx context.Context, user *models.User) (*models.AuthResponse, error) {
	return s.issueSession(user)
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, input *models.LoginInput) (*models.AuthResponse, error) {
	// Normalize email lookup (case-insensitive)
	email := strings.ToLower(strings.TrimSpace(input.Email))

	// Find user by email (use type-safe method)
	user, err := s.GetUserByEmail(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		return nil, fmt.Errorf("invalid email or password")
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}

	// Verify password
	if err := utils.VerifyPassword(user.Password, input.Password); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	return s.issueSession(user)
}

// VerifyToken is VerifyTokenStrict for ordinary routes: with Redis unreachable
// only the signature can be judged, and refusing would sign every client out
// over a store outage.
func (s *AuthService) VerifyToken(tokenString string) (*utils.JWTClaims, error) {
	claims, err := utils.VerifyJWT(tokenString, s.JWTSecret)
	if err != nil {
		return nil, err
	}
	if err := s.checkSession(claims); err != nil {
		if !errors.Is(err, ErrSessionStoreUnavailable) {
			return nil, err
		}
		logrus.Warnf("session check skipped, signature only (user %d): %v", claims.UserID, err)
	}
	return claims, nil
}

// VerifyTokenStrict accepts a live access token only, and answers
// ErrSessionStoreUnavailable when that can't be established.
func (s *AuthService) VerifyTokenStrict(tokenString string) (*utils.JWTClaims, error) {
	claims, err := utils.VerifyJWT(tokenString, s.JWTSecret)
	if err != nil {
		return nil, err
	}
	if err := s.checkSession(claims); err != nil {
		return nil, err
	}
	return claims, nil
}

// VerifyAdminToken takes the role from the database, never from the token: the
// claim is a snapshot up to 7 days old, which would keep a demoted admin in.
func (s *AuthService) VerifyAdminToken(ctx context.Context, tokenString string) (*models.User, error) {
	claims, err := s.VerifyTokenStrict(tokenString)
	if err != nil {
		return nil, err
	}
	user, err := s.LookupUser(ctx, claims.UserID)
	if errors.Is(err, ErrUserNotFound) {
		return nil, ErrSessionRevoked
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}
	if !user.Admin {
		return nil, ErrAdminRequired
	}
	return user, nil
}

// VerifySignature ignores the session. Only for acts that a token whose session
// just ended may still do on its own account: the app retires its push token
// alongside the logout, and either request can arrive first.
func (s *AuthService) VerifySignature(tokenString string) (*utils.JWTClaims, error) {
	return utils.VerifyJWT(tokenString, s.JWTSecret)
}

// checkSession: still registered (a logout removes the key, a refresh token never
// had one) and issued after the user's last RevokeAllSessions.
func (s *AuthService) checkSession(claims *utils.JWTClaims) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), sessionCheckTimeout)
	defer cancel()

	values, err := s.Cache.MGet(cacheCtx, cache.JWTKey(claims.ID), cache.SessionsRevokedBeforeKey(claims.UserID))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}
	if values[0] == "" || issuedBeforeRevocation(claims, values[1]) {
		return ErrSessionRevoked
	}
	return nil
}

func issuedBeforeRevocation(claims *utils.JWTClaims, revokedBefore string) bool {
	millis, err := strconv.ParseInt(revokedBefore, 10, 64)
	return err == nil && claims.IssuedAtMillis() < millis
}

// RefreshSession exchanges a refresh token for a brand new token pair. It takes
// the identity from the refresh token itself — requiring a valid access token
// here would make the endpoint useless, since renewing an expired session is
// precisely what it exists for. The token must still be registered for its
// device: a logout or a password reset unregisters it, a login on another
// device leaves it alone.
func (s *AuthService) RefreshSession(ctx context.Context, refreshToken string) (*models.AuthResponse, error) {
	claims, err := utils.VerifyJWT(refreshToken, s.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrRefreshTokenInvalid, err)
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	deviceKey := cache.RefreshTokenKey(claims.UserID, claims.ID)
	legacyKey := cache.LegacyRefreshTokenKey(claims.UserID)
	values, err := s.Cache.MGet(cacheCtx, deviceKey, cache.SessionsRevokedBeforeKey(claims.UserID), cache.RefreshReplayKey(claims.ID), legacyKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}
	if issuedBeforeRevocation(claims, values[1]) {
		return nil, fmt.Errorf("%w (user %d)", ErrRefreshTokenRevoked, claims.UserID)
	}

	var replay *issuedPair
	// Stored whole under the pre-2026-10-28 per-user key: such sessions migrate on
	// their next refresh instead of being logged out. Remove once every such token
	// has expired (2027-01-26).
	legacy := false
	if values[0] == "" {
		if replay, err = s.replayablePair(cacheCtx, values[2]); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
		}
		legacy = replay == nil && subtle.ConstantTimeCompare([]byte(values[3]), []byte(refreshToken)) == 1
		if replay == nil && !legacy {
			return nil, fmt.Errorf("%w (user %d)", ErrRefreshTokenRevoked, claims.UserID)
		}
	}

	// Re-read the user so the new token and the response carry current claims
	// (admin flag, premium status…) rather than a 3-month-old snapshot. Done
	// before anything is spent: an outage must leave the token usable, and must
	// not read as a revocation, the one answer that signs a client out.
	user, err := s.LookupUser(ctx, claims.UserID)
	if errors.Is(err, ErrUserNotFound) {
		return nil, fmt.Errorf("%w (user %d not found)", ErrRefreshTokenRevoked, claims.UserID)
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}

	if replay != nil {
		return &models.AuthResponse{AccessToken: replay.AccessToken, RefreshToken: replay.RefreshToken, User: user}, nil
	}
	resp, err := s.issueSession(user)
	if err != nil {
		return nil, err
	}
	if legacy {
		s.Cache.Del(cacheCtx, legacyKey)
	}
	pair, _ := json.Marshal(issuedPair{AccessToken: resp.AccessToken, RefreshToken: resp.RefreshToken})
	s.Cache.Set(cacheCtx, cache.RefreshReplayKey(claims.ID), pair, refreshReplayGrace)
	s.Cache.Del(cacheCtx, deviceKey)
	return resp, nil
}

// replayablePair is the pair a token consumed less than refreshReplayGrace ago was
// rotated into (raw is empty past that), as long as that pair is itself still
// registered — a logout or a password reset in between closes the window. An error
// is Redis failing, not an answer.
func (s *AuthService) replayablePair(cacheCtx context.Context, raw string) (*issuedPair, error) {
	var pair issuedPair
	if raw == "" || json.Unmarshal([]byte(raw), &pair) != nil {
		return nil, nil
	}
	next, err := utils.VerifyJWT(pair.RefreshToken, s.JWTSecret)
	if err != nil {
		return nil, nil
	}
	live, err := s.Cache.Exists(cacheCtx, cache.RefreshTokenKey(next.UserID, next.ID))
	if err != nil {
		return nil, err
	}
	if !live {
		return nil, nil
	}
	return &pair, nil
}

// sha256Hex is used to key reset tokens and throttle entries without ever
// storing the raw value.
func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// RequestPasswordReset mints a single-use reset token for the given address.
// It returns an empty token when the address has no account or has already
// asked in the last minute — the caller answers 200 either way, so the endpoint
// can't be used to probe which addresses are registered.
func (s *AuthService) RequestPasswordReset(ctx context.Context, email string) (token string, user *models.User, err error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", nil, nil
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Claimed first and atomically: requests landing together would otherwise each
	// mint a link. Taken for unknown addresses too, which answer the same anyway.
	claimed, err := s.Cache.SetNX(cacheCtx, cache.PasswordResetThrottleKey(sha256Hex(email)), "1", passwordResetThrottle)
	if err != nil {
		return "", nil, fmt.Errorf("failed to throttle reset request: %w", err)
	}
	if !claimed {
		return "", nil, nil
	}

	user, err = s.GetUserByEmail(ctx, email)
	if err != nil || user == nil {
		return "", nil, nil
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("failed to generate reset token: %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	tokenHash := sha256Hex(token)

	// A user who asks twice should not end up with two working tokens.
	s.retirePasswordResetLink(cacheCtx, user.ID)

	if err := s.Cache.Set(cacheCtx, cache.PasswordResetKey(tokenHash), fmt.Sprintf("%d", user.ID), passwordResetTTL); err != nil {
		return "", nil, fmt.Errorf("failed to store reset token: %w", err)
	}
	s.Cache.Set(cacheCtx, cache.PasswordResetUserKey(user.ID), tokenHash, passwordResetTTL)

	return token, user, nil
}

// ResetPassword consumes a reset token, writes the new password and opens a
// fresh session so the user lands logged in rather than back on a login form.
func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) (*models.AuthResponse, error) {
	if len(newPassword) < 8 {
		return nil, fmt.Errorf("le mot de passe doit faire au moins 8 caractères")
	}
	if token == "" {
		return nil, fmt.Errorf("invalid or expired reset link")
	}

	readCtx, cancelRead := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelRead()

	tokenKey := cache.PasswordResetKey(sha256Hex(token))
	values, err := s.Cache.MGet(readCtx, tokenKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}
	userID, err := strconv.ParseInt(values[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired reset link")
	}

	user, err := s.GetUser(ctx, userID)
	if errors.Is(err, ErrUserNotFound) {
		return nil, fmt.Errorf("invalid or expired reset link")
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}

	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// The token is spent here, atomically, after all that could fail for reasons
	// unrelated to it: of several requests carrying it, one alone gets past this.
	// Its own deadline: bcrypt may have used up the one above under load.
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}
	claimed, err := s.Cache.GetDel(cacheCtx, tokenKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSessionStoreUnavailable, err)
	}
	if claimed == "" {
		return nil, fmt.Errorf("invalid or expired reset link")
	}

	if err := s.updatePassword(ctx, userID, hashedPassword); err != nil {
		// The password didn't move: the link is still owed to its owner.
		s.Cache.Set(cacheCtx, tokenKey, claimed, passwordResetTTL)
		return nil, fmt.Errorf("%w: %v", ErrUserStoreUnavailable, err)
	}

	s.Cache.Del(cacheCtx, cache.PasswordResetUserKey(userID))
	s.revokeAllSessionsOrLog(ctx, userID)

	return s.issueSession(user)
}

// retirePasswordResetLink voids the link currently out for this user, if any.
func (s *AuthService) retirePasswordResetLink(cacheCtx context.Context, userID int64) {
	if pending, err := s.Cache.Get(cacheCtx, cache.PasswordResetUserKey(userID)); err == nil && pending != "" {
		s.Cache.Del(cacheCtx, cache.PasswordResetKey(pending), cache.PasswordResetUserKey(userID))
	}
}

// updatePassword writes a bcrypt hash for a user, through whichever DB handle
// this service was built with.
func (s *AuthService) updatePassword(ctx context.Context, userID int64, hashedPassword string) error {
	if s.gormDB != nil {
		if err := s.gormDB.WithContext(ctx).
			Model(&models.User{}).
			Where("id = ?", userID).
			Update("password", hashedPassword).Error; err != nil {
			return fmt.Errorf("failed to update password: %w", err)
		}
		return nil
	}

	if _, err := s.db.Exec(ctx, `UPDATE public.users SET password = $1 WHERE id = $2`, hashedPassword, userID); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	return nil
}

// Logout ends this device's session: its access token and the refresh token
// it was issued with. The user's other devices stay signed in.
func (s *AuthService) Logout(ctx context.Context, tokenID string, userID int64) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	keys := []string{cache.JWTKey(tokenID)}
	switch refreshID, _ := s.Cache.Get(cacheCtx, cache.JWTKey(tokenID)); refreshID {
	case "", "true": // session opened before per-device tokens
		keys = append(keys, cache.LegacyRefreshTokenKey(userID))
	default:
		keys = append(keys, cache.RefreshTokenKey(userID, refreshID))
	}
	return s.Cache.Del(cacheCtx, keys...)
}

// RevokeAllSessions signs a user out of every device. The timestamp is what does
// it: access tokens can't be listed by user, and the sweep below walks the whole
// keyspace within its deadline, so it may leave refresh keys behind. Those are
// refused anyway, the sweep is only cleanup. Kept for as long as any token lives.
func (s *AuthService) RevokeAllSessions(ctx context.Context, userID int64) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return errors.Join(
		s.Cache.Set(cacheCtx, cache.SessionsRevokedBeforeKey(userID), time.Now().UnixMilli(), refreshTokenTTL),
		s.Cache.Del(cacheCtx, cache.LegacyRefreshTokenKey(userID)),
		s.Cache.DelPattern(cacheCtx, cache.RefreshTokenPattern(userID)),
	)
}

func (s *AuthService) revokeAllSessionsOrLog(ctx context.Context, userID int64) {
	if err := s.RevokeAllSessions(ctx, userID); err != nil {
		logrus.Errorf("revoke sessions (user %d): %v", userID, err)
	}
}

// GetUser retrieves user by ID (type-safe with GORM)
func (s *AuthService) GetUser(ctx context.Context, userID int64) (*models.User, error) {
	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).
			Where("id = ?", userID).
			First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, ErrUserNotFound
			}
			return nil, fmt.Errorf("failed to query user: %w", err)
		}
		return &user, nil
	}

	// Fallback to pgxpool
	var user models.User
	err := s.db.QueryRow(ctx,
		`SELECT id, created_at, name, email, avatar, admin, age FROM public.users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin, &user.Age)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	return &user, nil
}

// UpdateProfile updates user profile (type-safe with GORM)
func (s *AuthService) UpdateProfile(ctx context.Context, userID int64, input *models.UpdateUserInput) (*models.User, error) {
	// Use GORM if available
	if s.gormDB != nil {
		user := &models.User{}

		// Build update fields dynamically
		updates := map[string]interface{}{}
		if input.Name != nil {
			updates["name"] = *input.Name
		}
		if input.Email != nil {
			updates["email"] = *input.Email
		}
		if input.Avatar != nil {
			updates["avatar"] = *input.Avatar
		}

		if err := s.gormDB.WithContext(ctx).
			Model(&models.User{}).
			Where("id = ?", userID).
			Updates(updates).
			First(user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("user not found")
			}
			if isUniqueViolation(err, usersEmailUniqueConstraint) {
				return nil, ErrEmailAlreadyRegistered
			}
			return nil, fmt.Errorf("failed to update user: %w", err)
		}

		// A link sent to the previous address must not outlive it. The clients
		// resend the address on every save, so this also fires when it's unchanged:
		// worst case, a pending link has to be requested again.
		if input.Email != nil {
			s.retirePasswordResetLinkNow(userID)
		}

		return user, nil
	}

	// Fallback to pgxpool
	var user models.User

	if input.Name != nil && input.Email != nil {
		err := s.db.QueryRow(ctx,
			`UPDATE public.users SET name = $1, email = $2 WHERE id = $3
			 RETURNING id, created_at, name, email, avatar, admin, age`,
			*input.Name, *input.Email, userID,
		).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin, &user.Age)

		if err != nil {
			if isUniqueViolation(err, usersEmailUniqueConstraint) {
				return nil, ErrEmailAlreadyRegistered
			}
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
		s.retirePasswordResetLinkNow(userID)
	} else if input.Name != nil {
		err := s.db.QueryRow(ctx,
			`UPDATE public.users SET name = $1 WHERE id = $2
			 RETURNING id, created_at, name, email, avatar, admin, age`,
			*input.Name, userID,
		).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin, &user.Age)

		if err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	return &user, nil
}

// ChangePassword ends every session, a thief's included, and hands the caller
// a new pair so this device carries on.
func (s *AuthService) ChangePassword(ctx context.Context, userID int64, input *models.ChangePasswordInput) (*models.AuthResponse, error) {
	// Validate new password strength (must match signup minimum)
	if len(input.NewPassword) < 8 {
		return nil, fmt.Errorf("new password must be at least 8 characters")
	}

	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, ErrUserNotFound
			}
			return nil, fmt.Errorf("failed to query user: %w", err)
		}

		// Verify current password
		if err := utils.VerifyPassword(user.Password, input.CurrentPassword); err != nil {
			return nil, fmt.Errorf("current password is incorrect")
		}

		// Hash new password
		hashedPassword, err := utils.HashPassword(input.NewPassword)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}

		// Update password
		if err := s.gormDB.WithContext(ctx).
			Model(&models.User{}).
			Where("id = ?", userID).
			Update("password", hashedPassword).Error; err != nil {
			return nil, fmt.Errorf("failed to update password: %w", err)
		}

		return s.closeSessionsAfterPasswordChange(ctx, &user)
	}

	// Fallback to pgxpool
	var currentHashedPassword string
	err := s.db.QueryRow(ctx,
		`SELECT password FROM public.users WHERE id = $1`,
		userID,
	).Scan(&currentHashedPassword)

	if err != nil {
		return nil, ErrUserNotFound
	}

	// Verify current password
	if err := utils.VerifyPassword(currentHashedPassword, input.CurrentPassword); err != nil {
		return nil, fmt.Errorf("current password is incorrect")
	}

	// Hash new password
	hashedPassword, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	_, err = s.db.Exec(ctx,
		`UPDATE public.users SET password = $1 WHERE id = $2`,
		hashedPassword, userID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update password: %w", err)
	}

	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.closeSessionsAfterPasswordChange(ctx, user)
}

func (s *AuthService) closeSessionsAfterPasswordChange(ctx context.Context, user *models.User) (*models.AuthResponse, error) {
	s.retirePasswordResetLinkNow(user.ID)
	s.revokeAllSessionsOrLog(ctx, user.ID)
	return s.issueSession(user)
}

func (s *AuthService) retirePasswordResetLinkNow(userID int64) {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.retirePasswordResetLink(cacheCtx, userID)
}

// DeleteAccount permanently deletes a user account after password verification
func (s *AuthService) DeleteAccount(ctx context.Context, userID int64, password string) error {
	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("user not found")
			}
			return fmt.Errorf("failed to query user: %w", err)
		}

		// Verify password
		if err := utils.VerifyPassword(user.Password, password); err != nil {
			return fmt.Errorf("incorrect password")
		}

		// Delete user (hard delete)
		if err := s.gormDB.WithContext(ctx).Unscoped().Delete(&models.User{}, userID).Error; err != nil {
			return fmt.Errorf("failed to delete user: %w", err)
		}

		s.revokeAllSessionsOrLog(ctx, userID)

		return nil
	}

	// Fallback to pgxpool
	var currentHashedPassword string
	err := s.db.QueryRow(ctx,
		`SELECT password FROM public.users WHERE id = $1`,
		userID,
	).Scan(&currentHashedPassword)

	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Verify password
	if err := utils.VerifyPassword(currentHashedPassword, password); err != nil {
		return fmt.Errorf("incorrect password")
	}

	// Delete user
	_, err = s.db.Exec(ctx,
		`DELETE FROM public.users WHERE id = $1`,
		userID,
	)

	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	s.revokeAllSessionsOrLog(ctx, userID)

	return nil
}
