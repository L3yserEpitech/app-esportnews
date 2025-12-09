package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

// RequireAdmin is a middleware that checks if the user is an admin
func RequireAdmin(authService *services.AuthService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Extract token from Authorization header
			auth := c.Request().Header.Get("Authorization")
			if auth == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing authorization header")
			}

			// Check Bearer token format
			if len(auth) < 8 || !strings.HasPrefix(auth, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid authorization format")
			}

			tokenString := auth[7:] // Remove "Bearer " prefix

			// Verify token and get claims
			claims, err := authService.VerifyToken(tokenString)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
			}

			// Check if user is admin
			if !claims.Admin {
				return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
			}

			// Store user info in context for handlers to use
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("is_admin", claims.Admin)

			return next(c)
		}
	}
}
