package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
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
	emailService   *services.EmailService
	frontendURL    string
	JWTSecret      string
}

func (h *AuthHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/auth/signup", h.Signup)
	g.POST("/auth/login", h.Login)
	g.GET("/auth/me", h.GetMe)
	g.POST("/auth/me", h.UpdateProfile)
	g.POST("/auth/avatar", h.UploadAvatar)            // Web: reçoit URL
	g.POST("/auth/avatar/upload", h.UploadAvatarFile) // Mobile: reçoit fichier
	g.DELETE("/auth/avatar", h.DeleteAvatar)
	g.POST("/auth/change-password", h.ChangePassword) // Change password
	g.POST("/auth/logout", h.Logout)
	g.POST("/auth/refresh", h.RefreshToken)
	g.POST("/auth/forgot-password", h.ForgotPassword)
	g.POST("/auth/reset-password", h.ResetPassword)
	g.DELETE("/auth/account", h.DeleteAccount)
}

func (h *AuthHandler) Signup(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var input models.CreateUserInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}
	if err := c.Validate(&input); err != nil {
		return err
	}

	user, err := h.authService.Signup(ctx, &input)
	if err != nil {
		if errors.Is(err, services.ErrEmailAlreadyRegistered) {
			return echo.NewHTTPError(http.StatusConflict, err.Error())
		}
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
	if err := c.Validate(&input); err != nil {
		return err
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
		if errors.Is(err, services.ErrEmailAlreadyRegistered) {
			return echo.NewHTTPError(http.StatusConflict, err.Error())
		}
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
	if err := c.Validate(&input); err != nil {
		return err
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

	if err := h.authService.Logout(ctx, claims.ID, claims.UserID); err != nil {
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

	if err := c.Bind(&req); err != nil || req.RefreshToken == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "refresh_token is required")
	}

	// Deliberately no Authorization check: this route exists to renew a session
	// whose access token has already expired.
	resp, err := h.authService.RefreshSession(ctx, req.RefreshToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid refresh token")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) DeleteAccount(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tokenString := extractToken(c)
	if tokenString == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing token")
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input models.DeleteAccountInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	if input.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Password is required")
	}

	// Blacklist the access token before deleting the user (prevents race window)
	if err := h.authService.Logout(ctx, claims.ID, claims.UserID); err != nil {
		c.Logger().Warnf("Failed to blacklist JWT for user %d during account deletion: %v", claims.UserID, err)
	}

	if err := h.authService.DeleteAccount(ctx, claims.UserID, input.Password); err != nil {
		if err.Error() == "incorrect password" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect password")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Account deleted successfully"})
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

// ForgotPassword mails a reset link. It always answers 200, whatever the
// address: telling the caller whether an account exists would turn this route
// into an account directory.
func (h *AuthHandler) ForgotPassword(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var input struct {
		Email string `json:"email"`
	}
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	ok := map[string]string{"message": "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé."}

	token, user, err := h.authService.RequestPasswordReset(ctx, input.Email)
	if err != nil {
		c.Logger().Errorf("Password reset request failed: %v", err)
		return c.JSON(http.StatusOK, ok)
	}
	if token == "" || user == nil {
		return c.JSON(http.StatusOK, ok)
	}

	if h.emailService == nil {
		c.Logger().Error("Password reset requested but no email service is configured")
		return c.JSON(http.StatusOK, ok)
	}

	resetURL := fmt.Sprintf("%s/auth/reset-password?token=%s",
		strings.TrimRight(h.frontendURL, "/"), url.QueryEscape(token))
	if err := h.emailService.SendPasswordReset(ctx, user.Email, resetURL); err != nil {
		c.Logger().Errorf("Failed to send password reset email: %v", err)
	}

	return c.JSON(http.StatusOK, ok)
}

// ResetPassword consumes the token and returns a full session, so the user is
// logged in straight away instead of being sent back to the login form.
func (h *AuthHandler) ResetPassword(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	response, err := h.authService.ResetPassword(ctx, input.Token, input.Password)
	if err != nil {
		if strings.Contains(err.Error(), "at least 8 characters") {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Ce lien de réinitialisation est invalide ou a expiré.")
	}

	return c.JSON(http.StatusOK, response)
}
