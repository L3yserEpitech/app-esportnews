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

type GameHandler struct {
	BaseHandler
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
	cached, err := h.Cache.Get(ctx, cache.CacheGames)
	if err == nil {
		var games []*models.Game
		if err := json.Unmarshal([]byte(cached), &games); err == nil {
			return c.JSON(http.StatusOK, games)
		}
	}

	// Query database
	rows, err := h.DB.Query(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games ORDER BY name")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch games")
	}
	defer rows.Close()

	var games []*models.Game
	for rows.Next() {
		var game models.Game
		if err := rows.Scan(&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to scan game")
		}
		games = append(games, &game)
	}

	// Cache for 24h (manual refresh)
	if data, err := json.Marshal(games); err == nil {
		h.Cache.Set(ctx, cache.CacheGames, string(data), 24*time.Hour)
	}

	return c.JSON(http.StatusOK, games)
}

func (h *GameHandler) GetGameByID(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id := c.Param("id")

	// Try cache
	cacheKey := cache.GameKey(0) // Should parse ID properly
	cached, err := h.Cache.Get(ctx, cacheKey)
	if err == nil {
		var game models.Game
		if err := json.Unmarshal([]byte(cached), &game); err == nil {
			return c.JSON(http.StatusOK, game)
		}
	}

	// Query database
	var game models.Game
	err = h.DB.QueryRow(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games WHERE id = $1", id).Scan(
		&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Game not found")
	}

	return c.JSON(http.StatusOK, game)
}

func (h *GameHandler) GetGameByAcronym(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	acronym := c.Param("acronym")

	var game models.Game
	err := h.DB.QueryRow(ctx, "SELECT id, name, selected_image, unselected_image, acronym, full_name FROM public.games WHERE acronym = $1", acronym).Scan(
		&game.ID, &game.Name, &game.SelectedImage, &game.UnselectedImage, &game.Acronym, &game.FullName,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Game not found")
	}

	return c.JSON(http.StatusOK, game)
}
