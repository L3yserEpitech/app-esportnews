package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type AuthHandler struct {
	BaseHandler
	authService *services.AuthService
	JWTSecret   string
}

func (h *AuthHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/auth/signup", h.Signup)
	g.POST("/auth/login", h.Login)
	g.GET("/auth/me", h.GetMe)
	g.POST("/auth/me", h.UpdateProfile)
	g.POST("/auth/avatar", h.UploadAvatar)
	g.DELETE("/auth/avatar", h.DeleteAvatar)
	g.POST("/auth/logout", h.Logout)
	g.POST("/auth/refresh", h.RefreshToken)
}

func (h *AuthHandler) Signup(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var input models.CreateUserInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	user, err := h.authService.Signup(ctx, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) Login(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var input models.LoginInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	response, err := h.authService.Login(ctx, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	return c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) GetMe(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	user, err := h.authService.GetUser(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input models.UpdateUserInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	user, err := h.authService.UpdateProfile(ctx, userID, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UploadAvatar(c echo.Context) error {
	return echo.NewHTTPError(http.StatusNotImplemented, "Avatar upload not yet implemented")
}

func (h *AuthHandler) DeleteAvatar(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = h.authService.GetUser(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Avatar deleted"})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tokenString := extractToken(c)
	if tokenString == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing token")
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	if err := h.authService.Logout(ctx, claims.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to logout")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) RefreshToken(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	newAccessToken, err := h.authService.RefreshAccessToken(ctx, userID, req.RefreshToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"access_token": newAccessToken})
}

// Helper functions
func (h *AuthHandler) extractUserID(c echo.Context) (int64, error) {
	tokenString := extractToken(c)
	if tokenString == "" {
		return 0, fmt.Errorf("missing token")
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return 0, err
	}

	return claims.UserID, nil
}

func extractToken(c echo.Context) string {
	auth := c.Request().Header.Get("Authorization")
	if len(auth) > 7 && auth[:7] == "Bearer " {
		return auth[7:]
	}
	return ""
}
