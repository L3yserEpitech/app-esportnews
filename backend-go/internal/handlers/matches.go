package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

type MatchHandler struct {
	BaseHandler
	pandaService *services.PandaScoreService
}

func (h *MatchHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/matches/by-date", h.GetMatchesByDate)
	g.GET("/matches/:id", h.GetMatch)
}

// GetMatchesByDate retrieves matches within a date range
func (h *MatchHandler) GetMatchesByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	date := c.QueryParam("date")
	if date == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Date is required (format: YYYY-MM-DD)")
	}

	game := c.QueryParam("game")

	matches, err := h.pandaService.GetMatchesByDate(ctx, date, nil)
	if game != "" {
		matches, err = h.pandaService.GetMatchesByDate(ctx, date, &game)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch matches: "+err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}

// GetMatch retrieves a single match by ID
func (h *MatchHandler) GetMatch(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id := c.Param("id")

	match, err := h.pandaService.GetMatch(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch match: "+err.Error())
	}

	return c.JSON(http.StatusOK, match)
}
