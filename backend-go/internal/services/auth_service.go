package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

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
			Name:     input.Name,
			Email:    input.Email,
			Password: hashedPassword,
			Admin:    false,
			Age:      input.Age, // Can be nil
		}

		if err := s.gormDB.WithContext(ctx).Create(user).Error; err != nil {
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
		input.Name, input.Email, hashedPassword, input.Age, // Age can be nil
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin, &user.Age)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

// LoginAfterSignup generates tokens for a newly created user (used after signup)
func (s *AuthService) LoginAfterSignup(ctx context.Context, user *models.User) (*models.AuthResponse, error) {
	// Generate JWT access token (7 days)
	accessToken, tokenID, err := utils.GenerateJWT(user.ID, user.Email, s.JWTSecret, 7*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Store token in Redis for blacklist (7 days)
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", 7*24*time.Hour)

	// Generate refresh token (14 days)
	refreshToken, _, err := utils.GenerateJWT(user.ID, user.Email, s.JWTSecret, 14*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in Redis (14 days)
	s.Cache.Set(cacheCtx, cache.RefreshTokenKey(user.ID), refreshToken, 14*24*time.Hour)

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, input *models.LoginInput) (*models.AuthResponse, error) {
	// Find user by email (use type-safe method)
	user, err := s.GetUserByEmail(ctx, input.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Verify password
	if err := utils.VerifyPassword(user.Password, input.Password); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Generate JWT access token (7 days)
	accessToken, tokenID, err := utils.GenerateJWT(user.ID, user.Email, s.JWTSecret, 7*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Store token in Redis for blacklist (7 days)
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", 7*24*time.Hour)

	// Generate refresh token (14 days)
	refreshToken, _, err := utils.GenerateJWT(user.ID, user.Email, s.JWTSecret, 14*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in Redis (14 days)
	s.Cache.Set(cacheCtx, cache.RefreshTokenKey(user.ID), refreshToken, 14*24*time.Hour)

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// VerifyToken validates JWT and returns claims
func (s *AuthService) VerifyToken(tokenString string) (*utils.JWTClaims, error) {
	return utils.VerifyJWT(tokenString, s.JWTSecret)
}

// RefreshAccessToken generates a new access token from refresh token
func (s *AuthService) RefreshAccessToken(ctx context.Context, userID int64, refreshToken string) (string, error) {
	// Verify refresh token
	claims, err := s.VerifyToken(refreshToken)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token")
	}

	if claims.UserID != userID {
		return "", fmt.Errorf("token user mismatch")
	}

	// Generate new access token
	newAccessToken, tokenID, err := utils.GenerateJWT(userID, claims.Email, s.JWTSecret, 7*24*time.Hour)
	if err != nil {
		return "", fmt.Errorf("failed to generate new token: %w", err)
	}

	// Store in Redis
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", 7*24*time.Hour)

	return newAccessToken, nil
}

// Logout blacklists the JWT token
func (s *AuthService) Logout(ctx context.Context, tokenID string) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

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
