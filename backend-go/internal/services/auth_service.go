package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

type AuthService struct {
	db        *pgxpool.Pool
	cache     *cache.RedisCache
	jwtSecret string
}

func NewAuthService(db *pgxpool.Pool, redisCache *cache.RedisCache, jwtSecret string) *AuthService {
	return &AuthService{
		db:        db,
		cache:     redisCache,
		jwtSecret: jwtSecret,
	}
}

// Signup creates a new user
func (s *AuthService) Signup(ctx context.Context, input *models.CreateUserInput) (*models.User, error) {
	// Validate password strength
	if len(input.Password) < 8 {
		return nil, fmt.Errorf("password must be at least 8 characters")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Insert user
	var user models.User
	err = s.db.QueryRow(ctx,
		`INSERT INTO public.users (name, email, password, admin)
		 VALUES ($1, $2, $3, false)
		 RETURNING id, created_at, name, email, avatar, admin`,
		input.Name, input.Email, hashedPassword,
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, input *models.LoginInput) (*models.AuthResponse, error) {
	// Find user by email
	var user models.User
	var hashedPassword string

	err := s.db.QueryRow(ctx,
		`SELECT id, name, email, password, avatar, admin FROM public.users WHERE email = $1`,
		input.Email,
	).Scan(&user.ID, &user.Name, &user.Email, &hashedPassword, &user.Avatar, &user.Admin)

	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Verify password
	if err := utils.VerifyPassword(hashedPassword, input.Password); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Generate JWT access token (7 days)
	accessToken, tokenID, err := utils.GenerateJWT(user.ID, user.Email, s.jwtSecret, 7*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Store token in Redis for blacklist (7 days)
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", 7*24*time.Hour)

	// Generate refresh token (14 days)
	refreshToken, _, err := utils.GenerateJWT(user.ID, user.Email, s.jwtSecret, 14*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in Redis (14 days)
	s.cache.Set(cacheCtx, cache.RefreshTokenKey(user.ID), refreshToken, 14*24*time.Hour)

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user,
	}, nil
}

// VerifyToken validates JWT and returns claims
func (s *AuthService) VerifyToken(tokenString string) (*utils.JWTClaims, error) {
	return utils.VerifyJWT(tokenString, s.jwtSecret)
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
	newAccessToken, tokenID, err := utils.GenerateJWT(userID, claims.Email, s.jwtSecret, 7*24*time.Hour)
	if err != nil {
		return "", fmt.Errorf("failed to generate new token: %w", err)
	}

	// Store in Redis
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.cache.Set(cacheCtx, cache.JWTKey(tokenID), "true", 7*24*time.Hour)

	return newAccessToken, nil
}

// Logout blacklists the JWT token
func (s *AuthService) Logout(ctx context.Context, tokenID string) error {
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return s.cache.Del(cacheCtx, cache.JWTKey(tokenID))
}

// GetUser retrieves user by ID
func (s *AuthService) GetUser(ctx context.Context, userID int64) (*models.User, error) {
	var user models.User

	err := s.db.QueryRow(ctx,
		`SELECT id, created_at, name, email, avatar, admin FROM public.users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin)

	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return &user, nil
}

// UpdateProfile updates user profile
func (s *AuthService) UpdateProfile(ctx context.Context, userID int64, input *models.UpdateUserInput) (*models.User, error) {
	var user models.User

	if input.Name != nil && input.Email != nil {
		err := s.db.QueryRow(ctx,
			`UPDATE public.users SET name = $1, email = $2 WHERE id = $3
			 RETURNING id, created_at, name, email, avatar, admin`,
			*input.Name, *input.Email, userID,
		).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin)

		if err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	} else if input.Name != nil {
		err := s.db.QueryRow(ctx,
			`UPDATE public.users SET name = $1 WHERE id = $2
			 RETURNING id, created_at, name, email, avatar, admin`,
			*input.Name, userID,
		).Scan(&user.ID, &user.CreatedAt, &user.Name, &user.Email, &user.Avatar, &user.Admin)

		if err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	return &user, nil
}
