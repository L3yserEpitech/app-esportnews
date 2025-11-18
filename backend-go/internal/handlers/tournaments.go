package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

type TournamentHandler struct {
	BaseHandler
	pandaService *services.PandaScoreService
}

func (h *TournamentHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/tournaments/:id", h.GetTournament)
	g.GET("/tournaments/filtered", h.FilterTournaments)
	g.GET("/tournaments", h.ListTournaments)
	g.GET("/tournaments/all", h.ListAllTournaments)
	g.GET("/tournaments/upcoming", h.ListUpcomingTournaments)
	g.GET("/tournaments/upcoming/all", h.ListAllUpcomingTournaments)
	g.GET("/tournaments/finished", h.ListFinishedTournaments)
	g.GET("/tournaments/finished/all", h.ListAllFinishedTournaments)
	g.GET("/tournaments/by-date", h.ListTournamentsByDate)
}

// GetTournament retrieves a single tournament by ID
func (h *TournamentHandler) GetTournament(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id := c.Param("id")

	tournament, err := h.pandaService.GetTournament(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournament: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournament)
}

// FilterTournaments retrieves tournaments with multiple filters
func (h *TournamentHandler) FilterTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	status := c.QueryParam("status")
	if status == "" {
		status = "running"
	}

	tierParam := c.QueryParam("filter[tier]")
	var tiers []string
	if tierParam != "" {
		tiers = []string{tierParam}
	}

	tournaments, err := h.pandaService.GetFilteredTournaments(ctx, &game, status, tiers)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListTournaments retrieves tournaments for a specific game
func (h *TournamentHandler) ListTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	if game == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Game acronym is required")
	}

	tournaments, err := h.pandaService.GetTournamentsForGame(ctx, game, "running")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListAllTournaments retrieves all running tournaments
func (h *TournamentHandler) ListAllTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tournaments, err := h.pandaService.GetTournamentsAllGames(ctx, "running")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListUpcomingTournaments retrieves upcoming tournaments for a specific game
func (h *TournamentHandler) ListUpcomingTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	if game == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Game acronym is required")
	}

	tournaments, err := h.pandaService.GetTournamentsForGame(ctx, game, "upcoming")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListAllUpcomingTournaments retrieves all upcoming tournaments
func (h *TournamentHandler) ListAllUpcomingTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tournaments, err := h.pandaService.GetTournamentsAllGames(ctx, "upcoming")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListFinishedTournaments retrieves finished tournaments for a specific game
func (h *TournamentHandler) ListFinishedTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	if game == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Game acronym is required")
	}

	tournaments, err := h.pandaService.GetTournamentsForGame(ctx, game, "finished")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListAllFinishedTournaments retrieves all finished tournaments
func (h *TournamentHandler) ListAllFinishedTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tournaments, err := h.pandaService.GetTournamentsAllGames(ctx, "finished")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// ListTournamentsByDate retrieves tournaments within a date range
func (h *TournamentHandler) ListTournamentsByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	date := c.QueryParam("date")
	if date == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Date is required (format: YYYY-MM-DD)")
	}

	game := c.QueryParam("game")

	tournaments, err := h.pandaService.GetTournamentsByDate(ctx, date, nil)
	if game != "" {
		tournaments, err = h.pandaService.GetTournamentsByDate(ctx, date, &game)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}
