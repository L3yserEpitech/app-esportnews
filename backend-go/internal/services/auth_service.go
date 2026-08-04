package services

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

const (
	accessTokenTTL = 7 * 24 * time.Hour
	// Fenêtre glissante : chaque refresh en émet un nouveau et repart de zéro,
	// donc une app ouverte au moins une fois par trimestre ne déconnecte jamais.
	refreshTokenTTL = 90 * 24 * time.Hour
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
}

// NewAuthService creates a new AuthService with pgxpool
func NewAuthService(db *pgxpool.Pool, redisCache *cache.RedisCache, jwtSecret string) *AuthService {
	return &AuthService{
		db:        db,
		Cache:     redisCache,
		JWTSecret: jwtSecret,
	}
}

// NewAuthServiceWithGORM creates a new AuthService with GORM
func NewAuthServiceWithGORM(gormDB *database.Database, redisCache *cache.RedisCache, jwtSecret string) *AuthService {
	return &AuthService{
		gormDB:    gormDB,
		Cache:     redisCache,
		JWTSecret: jwtSecret,
	}
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
				return nil, fmt.Errorf("user not found")
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

	if err != nil {
		return nil, fmt.Errorf("user not found")
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

// issueSession mints an access + refresh token pair for a user and records both
// in Redis. The stored refresh token is the only one accepted afterwards, so
// rotating it here invalidates the previous one.
func (s *AuthService) issueSession(user *models.User) (*models.AuthResponse, error) {
	accessToken, tokenID, err := utils.GenerateJWT(user.ID, user.Email, user.Admin, s.JWTSecret, accessTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, _, err := utils.GenerateJWT(user.ID, user.Email, user.Admin, s.JWTSecret, refreshTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", accessTokenTTL)
	s.Cache.Set(cacheCtx, cache.RefreshTokenKey(user.ID), refreshToken, refreshTokenTTL)

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
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Verify password
	if err := utils.VerifyPassword(user.Password, input.Password); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	return s.issueSession(user)
}

// VerifyToken validates JWT and returns claims
func (s *AuthService) VerifyToken(tokenString string) (*utils.JWTClaims, error) {
	return utils.VerifyJWT(tokenString, s.JWTSecret)
}

// RefreshSession exchanges a refresh token for a brand new token pair. It takes
// the identity from the refresh token itself — requiring a valid access token
// here would make the endpoint useless, since renewing an expired session is
// precisely what it exists for. The presented token must still be the one held
// in Redis, so logging out or refreshing again revokes it.
func (s *AuthService) RefreshSession(ctx context.Context, refreshToken string) (*models.AuthResponse, error) {
	claims, err := s.VerifyToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	stored, err := s.Cache.Get(cacheCtx, cache.RefreshTokenKey(claims.UserID))
	if err != nil || stored == "" {
		return nil, fmt.Errorf("refresh token revoked")
	}
	if subtle.ConstantTimeCompare([]byte(stored), []byte(refreshToken)) != 1 {
		return nil, fmt.Errorf("refresh token superseded")
	}

	// Re-read the user so the new token and the response carry current claims
	// (admin flag, premium status…) rather than a 3-month-old snapshot.
	user, err := s.GetUser(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return s.issueSession(user)
}

// Logout drops the access token and the stored refresh token, so the session
// can't be revived through /auth/refresh.
func (s *AuthService) Logout(ctx context.Context, tokenID string, userID int64) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	s.Cache.Del(cacheCtx, cache.RefreshTokenKey(userID))
	return s.Cache.Del(cacheCtx, cache.JWTKey(tokenID))
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
				return nil, fmt.Errorf("user not found")
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

	if err != nil {
		return nil, fmt.Errorf("user not found")
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

// ChangePassword updates user password after verifying current password
func (s *AuthService) ChangePassword(ctx context.Context, userID int64, input *models.ChangePasswordInput) error {
	// Validate new password strength (must match signup minimum)
	if len(input.NewPassword) < 8 {
		return fmt.Errorf("new password must be at least 8 characters")
	}

	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("user not found")
			}
			return fmt.Errorf("failed to query user: %w", err)
		}

		// Verify current password
		if err := utils.VerifyPassword(user.Password, input.CurrentPassword); err != nil {
			return fmt.Errorf("current password is incorrect")
		}

		// Hash new password
		hashedPassword, err := utils.HashPassword(input.NewPassword)
		if err != nil {
			return fmt.Errorf("failed to hash password: %w", err)
		}

		// Update password
		if err := s.gormDB.WithContext(ctx).
			Model(&models.User{}).
			Where("id = ?", userID).
			Update("password", hashedPassword).Error; err != nil {
			return fmt.Errorf("failed to update password: %w", err)
		}

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

	// Verify current password
	if err := utils.VerifyPassword(currentHashedPassword, input.CurrentPassword); err != nil {
		return fmt.Errorf("current password is incorrect")
	}

	// Hash new password
	hashedPassword, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	_, err = s.db.Exec(ctx,
		`UPDATE public.users SET password = $1 WHERE id = $2`,
		hashedPassword, userID,
	)

	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
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

		// Clear cached tokens
		cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.Del(cacheCtx, cache.RefreshTokenKey(userID))

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

	// Clear cached tokens
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Del(cacheCtx, cache.RefreshTokenKey(userID))

	return nil
}
