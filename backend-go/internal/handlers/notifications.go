package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type NotificationHandler struct {
	BaseHandler
	authService *services.AuthService
	gormDB      interface{} // Can be *gorm.DB or *database.Database
}

func (h *NotificationHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/notifications/preferences", h.GetPreferences)
	g.PATCH("/notifications/preferences", h.UpdatePreferences)
	g.POST("/notifications/:type/toggle", h.ToggleNotification)
}

func (h *NotificationHandler) GetPreferences(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch preferences")
	}

	prefs := models.NotificationPreferences{
		UserID:        user.ID,
		NotifiPush:    derefBool(user.NotifiPush),
		NotifNews:     derefBool(user.NotifNews),
		NotifArticles: derefBool(user.NotifArticles),
		NotifMatches:  derefBool(user.NotifMatches),
	}

	return c.JSON(http.StatusOK, prefs)
}

func (h *NotificationHandler) UpdatePreferences(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input models.NotificationPreferences
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	// Update user notification preferences
	if err := h.getDB().WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"notifi_push":    input.NotifiPush,
			"notif_news":     input.NotifNews,
			"notif_articles": input.NotifArticles,
			"notif_matchs":   input.NotifMatches,
		}).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update preferences")
	}

	// Fetch and return updated preferences
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch updated preferences")
	}

	prefs := models.NotificationPreferences{
		UserID:        user.ID,
		NotifiPush:    derefBool(user.NotifiPush),
		NotifNews:     derefBool(user.NotifNews),
		NotifArticles: derefBool(user.NotifArticles),
		NotifMatches:  derefBool(user.NotifMatches),
	}

	return c.JSON(http.StatusOK, prefs)
}

func (h *NotificationHandler) ToggleNotification(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	notifType := c.Param("type")
	columnMap := map[string]string{
		"push":     "notifi_push",
		"news":     "notif_news",
		"articles": "notif_articles",
		"matchs":   "notif_matchs",
	}

	column, ok := columnMap[notifType]
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid notification type")
	}

	// Read enabled value from body
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// Update notification preference using GORM
	if err := h.getDB().WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update(column, req.Enabled).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to toggle notification")
	}

	// Fetch and return updated preferences
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch updated preferences")
	}

	prefs := models.NotificationPreferences{
		UserID:        user.ID,
		NotifiPush:    derefBool(user.NotifiPush),
		NotifNews:     derefBool(user.NotifNews),
		NotifArticles: derefBool(user.NotifArticles),
		NotifMatches:  derefBool(user.NotifMatches),
	}

	return c.JSON(http.StatusOK, prefs)
}

// Helper function to extract user ID from JWT token
func (h *NotificationHandler) extractUserID(c echo.Context) (int64, error) {
	if h.authService == nil {
		return 0, fmt.Errorf("auth service not available")
	}

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

// Helper function to get gorm DB from interface
func (h *NotificationHandler) getDB() *gorm.DB {
	switch v := h.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB // Access the embedded *gorm.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}

// Helper function to dereference a bool pointer, returning false if nil
func derefBool(ptr *bool) bool {
	if ptr == nil {
		return false
	}
	return *ptr
}
