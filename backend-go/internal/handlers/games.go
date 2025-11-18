package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type GameHandler struct {
	BaseHandler
	gameService *services.GameService
}

func (h *GameHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/games", h.ListGames)
	g.GET("/games/:id", h.GetGameByID)
	g.GET("/games/acronym/:acronym", h.GetGameByAcronym)
}

func (h *GameHandler) ListGames(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try to get from cache
	cached, err := h.gameService.Cache.Get(ctx, cache.CacheGames)
	if err == nil {
		var games []*models.Game
		if err := json.Unmarshal([]byte(cached), &games); err == nil {
			return c.JSON(http.StatusOK, games)
		}
	}

	// Get games from service (handles GORM or pgxpool)
	games, err := h.gameService.GetAllGames(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch games")
	}

	// Cache for 24h (manual refresh)
	if data, err := json.Marshal(games); err == nil {
		h.gameService.Cache.Set(ctx, cache.CacheGames, string(data), 24*time.Hour)
	}

	return c.JSON(http.StatusOK, games)
}

func (h *GameHandler) GetGameByID(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id := c.Param("id")

	// Try cache
	cacheKey := cache.GameKey(0) // Should parse ID properly
	cached, err := h.gameService.Cache.Get(ctx, cacheKey)
	if err == nil {
		var game models.Game
		if err := json.Unmarshal([]byte(cached), &game); err == nil {
			return c.JSON(http.StatusOK, game)
		}
	}

	// Get game from service
	game, err := h.gameService.GetGameByID(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Game not found")
	}

	return c.JSON(http.StatusOK, game)
}

func (h *GameHandler) GetGameByAcronym(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	acronym := c.Param("acronym")

	// Get game from service
	game, err := h.gameService.GetGameByAcronym(ctx, acronym)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Game not found")
	}

	return c.JSON(http.StatusOK, game)
}
