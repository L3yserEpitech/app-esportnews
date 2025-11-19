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
	g.POST("/matches/by-date", h.GetMatchesByDate)
	g.GET("/matches/:id", h.GetMatch)
}

// GetMatchesByDate retrieves matches within a date range
func (h *MatchHandler) GetMatchesByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Parse form body
	if err := c.Request().ParseForm(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid form data")
	}

	date := c.Request().FormValue("date")
	if date == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Date is required (format: YYYY-MM-DD)")
	}

	game := c.Request().FormValue("game")

	var matches interface{}
	var err error

	// If game is provided, fetch for specific game; otherwise fetch for all games
	if game != "" {
		matches, err = h.pandaService.GetMatchesByDate(ctx, date, &game)
	} else {
		matches, err = h.pandaService.GetMatchesByDate(ctx, date, nil)
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
