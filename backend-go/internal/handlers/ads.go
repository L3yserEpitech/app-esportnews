package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

type AdHandler struct {
	BaseHandler
}

func (h *AdHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/ads", h.ListAds)
}

func (h *AdHandler) ListAds(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try cache
	cached, err := h.Cache.Get(ctx, cache.CacheAds)
	if err == nil {
		var ads []*models.Ad
		if err := json.Unmarshal([]byte(cached), &ads); err == nil {
			return c.JSON(http.StatusOK, ads)
		}
	}

	// Query database
	rows, err := h.DB.Query(ctx, "SELECT id, created_at, title, position, type, url, redirect_link FROM public.ads ORDER BY position ASC")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch ads")
	}
	defer rows.Close()

	var ads []*models.Ad
	for rows.Next() {
		var ad models.Ad
		var title, adType, url, redirectLink string
		var position int16

		if err := rows.Scan(&ad.ID, &ad.CreatedAt, &title, &position, &adType, &url, &redirectLink); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to scan ad")
		}

		// Convert to pointers
		ad.Title = &title
		ad.Position = &position
		ad.Type = &adType
		ad.URL = &url
		ad.RedirectLink = &redirectLink

		ads = append(ads, &ad)
	}

	// Cache for 1 hour
	if data, err := json.Marshal(ads); err == nil {
		h.Cache.Set(ctx, cache.CacheAds, string(data), 1*time.Hour)
	}

	return c.JSON(http.StatusOK, ads)
}
