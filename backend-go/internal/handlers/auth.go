package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

type AuthHandler struct {
	BaseHandler
	authService    *services.AuthService
	storageService *services.StorageService
	JWTSecret      string
}

func (h *AuthHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/auth/signup", h.Signup)
	g.POST("/auth/login", h.Login)
	g.GET("/auth/me", h.GetMe)
	g.POST("/auth/me", h.UpdateProfile)
	g.POST("/auth/avatar", h.UploadAvatar)              // Web: reçoit URL
	g.POST("/auth/avatar/upload", h.UploadAvatarFile)   // Mobile: reçoit fichier
	g.DELETE("/auth/avatar", h.DeleteAvatar)
	g.POST("/auth/change-password", h.ChangePassword)   // Change password
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

	// Generate tokens after successful signup (same as login)
	response, err := h.authService.LoginAfterSignup(ctx, user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate tokens")
	}

	return c.JSON(http.StatusCreated, response)
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
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input struct {
		AvatarURL string `json:"avatarUrl"`
	}

	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	if input.AvatarURL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Avatar URL is required")
	}

	// Update user avatar via service
	updateInput := &models.UpdateUserInput{
		Avatar: &input.AvatarURL,
	}

	user, err := h.authService.UpdateProfile(ctx, userID, updateInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UploadAvatarFile(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// Check if storage service is available
	if h.storageService == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Storage service not available")
	}

	// Get file from form data
	file, err := c.FormFile("avatar")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Avatar file is required")
	}

	// ⚠️ SÉCURITÉ: Valider le fichier (extension, taille, magic bytes)
	if err := utils.ValidateUploadedFile(file); err != nil {
		c.Logger().Warnf("Avatar validation failed for user %d: %v", userID, err)
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open uploaded file")
	}
	defer src.Close()

	// Upload to R2
	avatarURL, err := h.storageService.Upload(ctx, services.UploadOptions{
		Path:        fmt.Sprintf("avatars/users/%d", userID),
		Filename:    fmt.Sprintf("avatar-%d-%d.jpg", userID, time.Now().Unix()),
		ContentType: file.Header.Get("Content-Type"),
		Body:        src,
		Size:        file.Size,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to upload avatar: %v", err))
	}

	// Update user avatar in database
	updateInput := &models.UpdateUserInput{
		Avatar: &avatarURL,
	}

	user, err := h.authService.UpdateProfile(ctx, userID, updateInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"avatar_url": avatarURL,
		"user":       user,
	})
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

func (h *AuthHandler) ChangePassword(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input models.ChangePasswordInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	// Validate input
	if input.CurrentPassword == "" || input.NewPassword == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Current password and new password are required")
	}

	if len(input.NewPassword) < 6 {
		return echo.NewHTTPError(http.StatusBadRequest, "New password must be at least 6 characters")
	}

	// Change password via service
	if err := h.authService.ChangePassword(ctx, userID, &input); err != nil {
		if err.Error() == "current password is incorrect" {
			return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Password changed successfully"})
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
