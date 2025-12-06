package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
)

type AdHandler struct {
	BaseHandler
	service *services.AdService
}

func NewAdHandlerWithService(service *services.AdService) *AdHandler {
	return &AdHandler{service: service}
}

func (h *AdHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/ads", h.ListAds)
}

func (h *AdHandler) ListAds(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try cache
	cached, err := h.service.Cache.Get(ctx, cache.CacheAds)
	if err == nil {
		var ads interface{}
		if err := json.Unmarshal([]byte(cached), &ads); err == nil {
			return c.JSON(http.StatusOK, ads)
		}
	}

	// Fetch from database using service
	ads, err := h.service.GetAllAds(ctx)
	if err != nil {
		c.Logger().Errorf("Failed to fetch ads: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch ads")
	}

	// Cache for 1 hour
	if data, err := json.Marshal(ads); err == nil {
		h.service.Cache.Set(ctx, cache.CacheAds, string(data), 1*time.Hour)
	}

	return c.JSON(http.StatusOK, ads)
}
