package handlers

import (
	"fmt"
	"net/http"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"

	"github.com/labstack/echo/v4"
)

type AnalyticsHandler struct {
	BaseHandler
	analyticsService *services.AnalyticsService
}

func NewAnalyticsHandler(
	analyticsService *services.AnalyticsService,
) *AnalyticsHandler {
	return &AnalyticsHandler{
		analyticsService: analyticsService,
	}
}

// RegisterRoutes enregistre les routes publiques (tracking)
func (h *AnalyticsHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/analytics/track", h.TrackPageView)
}

// RegisterAdminRoutes enregistre les routes admin (stats & export)
func (h *AnalyticsHandler) RegisterAdminRoutes(g RouterGroup) {
	g.GET("/analytics/visitors", h.GetVisitorStats)
	g.GET("/analytics/registrations", h.GetRegistrationStats)
	g.GET("/analytics/summary", h.GetAnalyticsSummary)
	g.GET("/analytics/export", h.ExportAnalytics)
}

// TrackPageView enregistre une page view (endpoint public)
// POST /api/analytics/track
func (h *AnalyticsHandler) TrackPageView(c echo.Context) error {
	ctx := c.Request().Context()

	var input models.TrackPageViewInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// Validation basique
	if input.VisitorID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "visitor_id is required")
	}
	if input.Path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	// Récupérer le user_id depuis le contexte si l'utilisateur est connecté
	if userID, ok := c.Get("user_id").(int64); ok {
		input.UserID = &userID
	}

	// Récupérer le User-Agent depuis les headers
	if input.UserAgent == "" {
		input.UserAgent = c.Request().UserAgent()
	}

	if err := h.analyticsService.RecordPageView(ctx, input); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to record page view")
	}

	return c.JSON(http.StatusCreated, map[string]string{"message": "Page view recorded"})
}

// GetVisitorStats retourne les statistiques de visiteurs (admin only)
// GET /api/analytics/visitors?timeline=24h|week|month|year
func (h *AnalyticsHandler) GetVisitorStats(c echo.Context) error {
	ctx := c.Request().Context()

	timeline := c.QueryParam("timeline")
	if timeline == "" {
		timeline = "24h" // Default
	}

	// Valider timeline
	validTimelines := map[string]bool{
		"24h":   true,
		"day":   true,
		"week":  true,
		"month": true,
		"year":  true,
	}
	if !validTimelines[timeline] {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid timeline parameter (must be: 24h, day, week, month, year)")
	}

	stats, err := h.analyticsService.GetVisitorStats(ctx, timeline)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get visitor stats")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Visitor stats retrieved",
		"data":    stats,
	})
}

// GetRegistrationStats retourne les statistiques d'inscriptions (admin only)
// GET /api/analytics/registrations?timeline=24h|day|week|month|year
func (h *AnalyticsHandler) GetRegistrationStats(c echo.Context) error {
	ctx := c.Request().Context()

	timeline := c.QueryParam("timeline")
	if timeline == "" {
		timeline = "24h" // Default
	}

	// Valider timeline (accepter 24h ET day pour compatibilité)
	validTimelines := map[string]bool{
		"24h":   true,
		"day":   true,
		"week":  true,
		"month": true,
		"year":  true,
	}
	if !validTimelines[timeline] {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid timeline parameter (must be: 24h, day, week, month, year)")
	}

	stats, err := h.analyticsService.GetRegistrationStats(ctx, timeline)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get registration stats")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Registration stats retrieved",
		"data":    stats,
	})
}

// ExportAnalytics génère un CSV avec les données analytics (admin only)
// GET /api/analytics/export?timeline=24h|week|month|year
func (h *AnalyticsHandler) ExportAnalytics(c echo.Context) error {
	ctx := c.Request().Context()

	timeline := c.QueryParam("timeline")
	if timeline == "" {
		timeline = "week" // Default pour export
	}

	csvData, err := h.analyticsService.ExportAnalyticsData(ctx, timeline)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to export analytics data")
	}

	// Set headers pour download CSV
	filename := fmt.Sprintf("analytics-%s-%s.csv", timeline, c.Request().Context().Value("request_time"))
	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	return c.String(http.StatusOK, csvData)
}

// GetAnalyticsSummary retourne un résumé combiné (admin only)
// GET /api/analytics/summary?timeline=24h|week|month|year
func (h *AnalyticsHandler) GetAnalyticsSummary(c echo.Context) error {
	ctx := c.Request().Context()

	timeline := c.QueryParam("timeline")
	if timeline == "" {
		timeline = "24h"
	}

	// Récupérer les deux types de stats en parallèle
	visitorStats, err := h.analyticsService.GetVisitorStats(ctx, timeline)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get visitor stats")
	}

	registrationStats, err := h.analyticsService.GetRegistrationStats(ctx, timeline)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get registration stats")
	}

	summary := map[string]interface{}{
		"timeline":      timeline,
		"visitors":      visitorStats,
		"registrations": registrationStats,
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Analytics summary retrieved",
		"data":    summary,
	})
}
