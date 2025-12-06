package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

type ArticleHandler struct {
	BaseHandler
	service *services.ArticleService
}

func NewArticleHandlerWithService(service *services.ArticleService) *ArticleHandler {
	return &ArticleHandler{service: service}
}

func (h *ArticleHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/articles", h.ListArticles)
	g.GET("/articles/:slug", h.GetArticle)
	g.GET("/articles/:slug/similar", h.GetSimilarArticles)
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
