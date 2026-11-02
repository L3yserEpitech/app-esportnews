package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTClaims struct {
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
	Admin  bool   `json:"admin"`
	// iat is in whole seconds: too coarse to tell a token minted just before a
	// revocation from the session a password reset opens right after it.
	IssuedAtMs int64 `json:"iat_ms,omitempty"`
	jwt.RegisteredClaims
}

// IssuedAtMillis falls back on iat for tokens minted before iat_ms existed.
func (c *JWTClaims) IssuedAtMillis() int64 {
	if c.IssuedAtMs > 0 {
		return c.IssuedAtMs
	}
	if c.IssuedAt != nil {
		return c.IssuedAt.UnixMilli()
	}
	return 0
}

func GenerateJWT(userID int64, email string, admin bool, secret string, expiration time.Duration) (string, string, error) {
	tokenID := uuid.New().String()
	now := time.Now()

	claims := &JWTClaims{
		UserID:     userID,
		Email:      email,
		Admin:      admin,
		IssuedAtMs: now.UnixMilli(),
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(now.Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	return tokenString, tokenID, nil
}

func VerifyJWT(tokenString string, secret string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	return claims, nil
}
