package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type ArticleHandler struct {
	BaseHandler
	service        *services.ArticleService
	authService    *services.AuthService
	storageService *services.StorageService
}

func NewArticleHandlerWithService(service *services.ArticleService, authService *services.AuthService, storageService *services.StorageService) *ArticleHandler {
	return &ArticleHandler{
		service:        service,
		authService:    authService,
		storageService: storageService,
	}
}

func (h *ArticleHandler) RegisterRoutes(g RouterGroup) {
	// Public routes
	g.GET("/articles", h.ListArticles)
	g.GET("/articles/:slug", h.GetArticle)
	g.GET("/articles/:slug/similar", h.GetSimilarArticles)
	g.POST("/articles/:slug/view", h.IncrementViews)
}

// RegisterAdminRoutes registers admin-protected routes
func (h *ArticleHandler) RegisterAdminRoutes(g RouterGroup) {
	// Admin routes (protected by RequireAdmin middleware in main.go)
	g.POST("/admin/articles", h.CreateArticle)
	g.GET("/admin/articles", h.ListAllArticles)
	g.GET("/admin/articles/:id", h.GetArticleByID)
	g.PUT("/admin/articles/:id", h.UpdateArticle)
	g.DELETE("/admin/articles/:id", h.DeleteArticle)
	g.POST("/admin/articles/upload-cover", h.UploadCoverMedia)
	g.POST("/admin/articles/upload-content", h.UploadContentImage)
}

func (h *ArticleHandler) ListArticles(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	limit := 20
	offset := 0

	if l := c.QueryParam("limit"); l != "" {
		if lim, err := strconv.Atoi(l); err == nil && lim > 0 && lim <= 100 {
			limit = lim
		}
	}
	if o := c.QueryParam("offset"); o != "" {
		if off, err := strconv.Atoi(o); err == nil && off >= 0 {
			offset = off
		}
	}

	articles, err := h.service.GetArticles(ctx, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, articles)
}

func (h *ArticleHandler) GetArticle(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	slug := c.Param("slug")

	article, err := h.service.GetArticleBySlug(ctx, slug)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, article)
}

func (h *ArticleHandler) GetSimilarArticles(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	slug := c.Param("slug")
	limit := 5

	if l := c.QueryParam("limit"); l != "" {
		if lim, err := strconv.Atoi(l); err == nil && lim > 0 {
			limit = lim
		}
	}

	articles, err := h.service.GetSimilarArticles(ctx, slug, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, articles)
}

// --- ADMIN HANDLERS ---

// CreateArticle handles article creation (admin only)
func (h *ArticleHandler) CreateArticle(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var input models.CreateArticleInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid input")
	}

	// Set default author if not provided
	if input.Author == "" {
		input.Author = "Admin"
	}

	article, err := h.service.CreateArticle(ctx, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, article)
}

// UpdateArticle handles article updates (admin only)
func (h *ArticleHandler) UpdateArticle(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid article ID")
	}

	var input models.UpdateArticleInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid input")
	}

	article, err := h.service.UpdateArticle(ctx, id, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, article)
}

// DeleteArticle handles article deletion (admin only)
func (h *ArticleHandler) DeleteArticle(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid article ID")
	}

	if err := h.service.DeleteArticle(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Article deleted successfully",
	})
}

// GetArticleByID retrieves an article by ID (admin only)
func (h *ArticleHandler) GetArticleByID(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid article ID")
	}

	article, err := h.service.GetArticleByID(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, article)
}

// ListAllArticles retrieves all articles (admin only)
func (h *ArticleHandler) ListAllArticles(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	articles, err := h.service.GetAllArticles(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, articles)
}

// UploadCoverMedia handles cover image/video upload (admin only)
func (h *ArticleHandler) UploadCoverMedia(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "No file provided")
	}

	slug := c.FormValue("slug")
	mediaType := c.FormValue("type") // "image" or "video"

	// Open file
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file")
	}
	defer src.Close()

	// Determine path based on media type
	var path string
	if mediaType == "video" {
		path = "articles/covers/videos"
	} else {
		path = "articles/covers/images"
	}

	// Generate filename
	filename := services.GenerateSlugFilename(slug, file.Filename)

	// Upload to R2
	publicURL, err := h.storageService.Upload(ctx, services.UploadOptions{
		Path:        path,
		Filename:    filename,
		ContentType: file.Header.Get("Content-Type"),
		Body:        src,
		Size:        file.Size,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Upload failed: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"url":     publicURL,
	})
}

// UploadContentImage handles content image upload (admin only)
func (h *ArticleHandler) UploadContentImage(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "No file provided")
	}

	slug := c.FormValue("slug")

	// Open file
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file")
	}
	defer src.Close()

	// Generate filename
	filename := services.GenerateSlugFilename(slug, file.Filename)

	// Upload to R2
	publicURL, err := h.storageService.Upload(ctx, services.UploadOptions{
		Path:        "articles/content/images",
		Filename:    filename,
		ContentType: file.Header.Get("Content-Type"),
		Body:        src,
		Size:        file.Size,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Upload failed: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"url":     publicURL,
	})
}

// IncrementViews increments article views (public endpoint)
func (h *ArticleHandler) IncrementViews(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	slug := c.Param("slug")

	if err := h.service.IncrementViews(ctx, slug); err != nil {
		// Don't return error to client - just log it
		return c.JSON(http.StatusOK, map[string]bool{"success": true})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
