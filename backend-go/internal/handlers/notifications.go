package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
)

type NotificationHandler struct {
	BaseHandler
}

func (h *NotificationHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/notifications/preferences", h.GetPreferences)
	g.PATCH("/notifications/preferences", h.UpdatePreferences)
	g.POST("/notifications/:type/toggle", h.ToggleNotification)
}

func (h *NotificationHandler) GetPreferences(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tokenString := extractToken(c)
	if tokenString == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// TODO: Parse JWT to get userID properly
	var userID int64 = 1 // Temporary placeholder

	var prefs models.NotificationPreferences
	err := h.DB.QueryRow(ctx,
		`SELECT user_id, notifi_push, notif_news, notif_articles, notif_matchs FROM public.users WHERE id = $1`,
		userID,
	).Scan(&prefs.UserID, &prefs.NotifiPush, &prefs.NotifNews, &prefs.NotifArticles, &prefs.NotifMatches)

	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, prefs)
}

func (h *NotificationHandler) UpdatePreferences(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tokenString := extractToken(c)
	if tokenString == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// TODO: Parse JWT to get userID properly
	var userID int64 = 1 // Temporary placeholder

	var input models.NotificationPreferences
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	_, err := h.DB.Exec(ctx,
		`UPDATE public.users SET notifi_push = $1, notif_news = $2, notif_articles = $3, notif_matchs = $4 WHERE id = $5`,
		input.NotifiPush, input.NotifNews, input.NotifArticles, input.NotifMatches, userID,
	)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update preferences")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Preferences updated"})
}

func (h *NotificationHandler) ToggleNotification(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tokenString := extractToken(c)
	if tokenString == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// TODO: Parse JWT to get userID properly
	var userID int64 = 1 // Temporary placeholder

	notifType := c.Param("type")
	columnMap := map[string]string{
		"push":     "notifi_push",
		"news":     "notif_news",
		"articles": "notif_articles",
		"matches":  "notif_matchs",
	}

	column, ok := columnMap[notifType]
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid notification type")
	}

	query := `UPDATE public.users SET ` + column + ` = NOT ` + column + ` WHERE id = $1`
	_, err := h.DB.Exec(ctx, query, userID)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to toggle notification")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Notification toggled"})
}
