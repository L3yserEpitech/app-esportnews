package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

type AdHandler struct {
	BaseHandler
	service        *services.AdService
	storageService *services.StorageService
}

func NewAdHandlerWithService(service *services.AdService) *AdHandler {
	return &AdHandler{service: service}
}

func NewAdHandlerWithStorage(service *services.AdService, storageService *services.StorageService) *AdHandler {
	return &AdHandler{
		service:        service,
		storageService: storageService,
	}
}

func (h *AdHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/ads", h.ListAds)
}

// RegisterAdminRoutes registers admin-protected routes
func (h *AdHandler) RegisterAdminRoutes(g RouterGroup) {
	g.POST("/admin/ads", h.CreateAd)
	g.GET("/admin/ads", h.ListAllAds)
	g.GET("/admin/ads/:id", h.GetAdByID)
	g.PUT("/admin/ads/:id", h.UpdateAd)
	g.DELETE("/admin/ads/:id", h.DeleteAd)
	g.POST("/admin/ads/upload", h.UploadAdImage)
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

// ListAllAds returns all ads (admin endpoint)
func (h *AdHandler) ListAllAds(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ads, err := h.service.GetAllAds(ctx)
	if err != nil {
		c.Logger().Errorf("Failed to fetch ads: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch ads")
	}

	return c.JSON(http.StatusOK, ads)
}

// GetAdByID returns a single ad by ID
func (h *AdHandler) GetAdByID(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid ad ID")
	}

	ad, err := h.service.GetAdByID(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Ad not found")
	}

	return c.JSON(http.StatusOK, ad)
}

// CreateAd creates a new ad
func (h *AdHandler) CreateAd(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var input struct {
		Title        string `json:"title"`
		Position     int16  `json:"position"`
		Type         string `json:"type"`
		URL          string `json:"url"`
		RedirectLink string `json:"redirect_link"`
	}

	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// Validation
	if input.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Title is required")
	}
	if input.Position < 1 || input.Position > 3 {
		return echo.NewHTTPError(http.StatusBadRequest, "Position must be between 1 and 3")
	}
	if input.Type != "image" && input.Type != "video" {
		return echo.NewHTTPError(http.StatusBadRequest, "Type must be 'image' or 'video'")
	}
	if input.URL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "URL is required")
	}
	if input.RedirectLink == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Redirect link is required")
	}

	ad := &models.Ad{
		Title:        &input.Title,
		Position:     &input.Position,
		Type:         &input.Type,
		URL:          &input.URL,
		RedirectLink: &input.RedirectLink,
	}

	if err := h.service.CreateAd(ctx, ad); err != nil {
		c.Logger().Errorf("Failed to create ad: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create ad")
	}

	return c.JSON(http.StatusCreated, ad)
}

// UpdateAd updates an existing ad
func (h *AdHandler) UpdateAd(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid ad ID")
	}

	var input struct {
		Title        *string `json:"title"`
		Position     *int16  `json:"position"`
		Type         *string `json:"type"`
		URL          *string `json:"url"`
		RedirectLink *string `json:"redirect_link"`
	}

	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// Build updates map
	updates := make(map[string]interface{})
	if input.Title != nil {
		updates["title"] = *input.Title
	}
	if input.Position != nil {
		if *input.Position < 1 || *input.Position > 3 {
			return echo.NewHTTPError(http.StatusBadRequest, "Position must be between 1 and 3")
		}
		updates["position"] = *input.Position
	}
	if input.Type != nil {
		if *input.Type != "image" && *input.Type != "video" {
			return echo.NewHTTPError(http.StatusBadRequest, "Type must be 'image' or 'video'")
		}
		updates["type"] = *input.Type
	}
	if input.URL != nil {
		updates["url"] = *input.URL
	}
	if input.RedirectLink != nil {
		updates["redirect_link"] = *input.RedirectLink
	}

	if len(updates) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "No fields to update")
	}

	ad, err := h.service.UpdateAd(ctx, id, updates)
	if err != nil {
		c.Logger().Errorf("Failed to update ad: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update ad")
	}

	return c.JSON(http.StatusOK, ad)
}

// DeleteAd deletes an ad
func (h *AdHandler) DeleteAd(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid ad ID")
	}

	if err := h.service.DeleteAd(ctx, id); err != nil {
		c.Logger().Errorf("Failed to delete ad: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete ad")
	}

	return c.NoContent(http.StatusNoContent)
}

// UploadAdImage handles ad image uploads
func (h *AdHandler) UploadAdImage(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if h.storageService == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Storage service not configured")
	}

	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "No file uploaded")
	}

	// ⚠️ SÉCURITÉ: Valider le fichier (extension, taille, magic bytes)
	if err := utils.ValidateUploadedFile(file); err != nil {
		c.Logger().Warnf("File validation failed: %v", err)
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file")
	}
	defer src.Close()

	// Generate unique filename (sanitize pour éviter path traversal)
	filename := services.GenerateFilename(utils.SanitizeFilename(file.Filename))

	// Upload to R2
	publicURL, err := h.storageService.Upload(ctx, services.UploadOptions{
		Path:        "ads/images",
		Filename:    filename,
		ContentType: file.Header.Get("Content-Type"),
		Body:        src,
		Size:        file.Size,
	})
	if err != nil {
		c.Logger().Errorf("Failed to upload ad image: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload image")
	}

	return c.JSON(http.StatusOK, map[string]string{"url": publicURL})
}
