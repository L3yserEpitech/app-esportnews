package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

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

			// Strict: a route this sensitive doesn't run on the signature alone
			// when Redis is down.
			ctx, cancel := context.WithTimeout(c.Request().Context(), 5*time.Second)
			defer cancel()
			user, err := authService.VerifyAdminToken(ctx, tokenString)
			switch {
			case errors.Is(err, services.ErrSessionStoreUnavailable):
				return echo.NewHTTPError(http.StatusServiceUnavailable, "Session store unavailable")
			case errors.Is(err, services.ErrUserStoreUnavailable):
				return echo.NewHTTPError(http.StatusServiceUnavailable, "User store unavailable").SetInternal(err)
			case errors.Is(err, services.ErrAdminRequired):
				return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
			case err != nil:
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
			}

			// Store user info in context for handlers to use
			c.Set("user_id", user.ID)
			c.Set("user_email", user.Email)
			c.Set("is_admin", user.Admin)

			return next(c)
		}
	}
}
