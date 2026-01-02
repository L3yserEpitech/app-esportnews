package handlers

import (
	"context"
	"fmt"
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
	// Legacy endpoint (kept for backward compatibility)
	g.GET("/live", h.GetRunningMatches)

	// New match endpoints
	g.GET("/matches/running", h.GetRunningMatches)
	g.GET("/matches/upcoming", h.GetUpcomingMatches)
	g.GET("/matches/past", h.GetPastMatches)

	// Other match endpoints
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

// GetRunningMatches retrieves matches currently running (live)
func (h *MatchHandler) GetRunningMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get optional game filter from query parameter
	gameAcronym := c.QueryParam("game")
	fmt.Printf("[GetRunningMatches Handler] Query param 'game': %s\n", gameAcronym)

	var matches interface{}
	var err error

	// If game acronym is provided, filter by it; otherwise get all running matches
	if gameAcronym != "" {
		matches, err = h.pandaService.GetRunningMatches(ctx, &gameAcronym)
	} else {
		matches, err = h.pandaService.GetRunningMatches(ctx, nil)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch running matches: "+err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}

// GetUpcomingMatches retrieves upcoming matches
func (h *MatchHandler) GetUpcomingMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get optional game filter from query parameter
	gameAcronym := c.QueryParam("game")
	fmt.Printf("[GetUpcomingMatches Handler] Query param 'game': %s\n", gameAcronym)

	var matches interface{}
	var err error

	// If game acronym is provided, filter by it; otherwise get all upcoming matches
	if gameAcronym != "" {
		matches, err = h.pandaService.GetUpcomingMatches(ctx, &gameAcronym)
	} else {
		matches, err = h.pandaService.GetUpcomingMatches(ctx, nil)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch upcoming matches: "+err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}

// GetPastMatches retrieves past/finished matches
func (h *MatchHandler) GetPastMatches(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get optional game filter from query parameter
	gameAcronym := c.QueryParam("game")
	fmt.Printf("[GetPastMatches Handler] Query param 'game': %s\n", gameAcronym)

	var matches interface{}
	var err error

	// If game acronym is provided, filter by it; otherwise get all past matches
	if gameAcronym != "" {
		matches, err = h.pandaService.GetPastMatches(ctx, &gameAcronym)
	} else {
		matches, err = h.pandaService.GetPastMatches(ctx, nil)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch past matches: "+err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}
