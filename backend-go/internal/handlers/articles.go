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

	service := services.NewArticleService(h.DB, h.Cache)
	articles, err := service.GetArticles(ctx, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, articles)
}

func (h *ArticleHandler) GetArticle(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	slug := c.Param("slug")

	service := services.NewArticleService(h.DB, h.Cache)
	article, err := service.GetArticleBySlug(ctx, slug)
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

	service := services.NewArticleService(h.DB, h.Cache)
	articles, err := service.GetSimilarArticles(ctx, slug, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, articles)
}
