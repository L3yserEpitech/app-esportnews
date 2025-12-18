package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type TournamentHandler struct {
	BaseHandler
	pandaService *services.PandaScoreService
}

func (h *TournamentHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/tournaments/filtered", h.FilterTournaments)
	g.GET("/tournaments/upcoming", h.ListAllUpcomingTournaments)
	g.GET("/tournaments/finished", h.ListAllFinishedTournaments)
	g.GET("/tournaments/all", h.ListAllTournaments)
	g.GET("/tournaments", h.ListTournaments)
	g.GET("/tournaments/:id", h.GetTournament)
	g.POST("/tournaments/by-date", h.ListTournamentsByDate)
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

// ListTournaments retrieves tournaments (optionally filtered by game) with pagination and sorting support
func (h *TournamentHandler) ListTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	limitParam := c.QueryParam("limit")
	offsetParam := c.QueryParam("offset")
	sortParam := c.QueryParam("sort") // e.g., "tier", "-tier", "begin_at", "-begin_at"

	// Default pagination values
	limit := 20
	offset := 0

	// Parse limit if provided
	if limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	// Parse offset if provided
	if offsetParam != "" {
		if parsed, err := strconv.Atoi(offsetParam); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// If game is provided, fetch for specific game
	if game != "" {
		tournaments, err := h.pandaService.GetTournamentsForGame(ctx, game, "running")
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
		}
		h.sortTournaments(tournaments, sortParam)
		return c.JSON(http.StatusOK, tournaments)
	}

	// If no game, fetch all tournaments with pagination
	tournaments, err := h.pandaService.GetTournamentsAllGames(ctx, "running")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	// Apply sorting before pagination
	h.sortTournaments(tournaments, sortParam)

	// Apply pagination to results
	if offset >= len(tournaments) {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	end := offset + limit
	if end > len(tournaments) {
		end = len(tournaments)
	}

	return c.JSON(http.StatusOK, tournaments[offset:end])
}

// ListAllTournaments retrieves all running tournaments
func (h *TournamentHandler) ListAllTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	sortParam := c.QueryParam("sort") // e.g., "tier", "-tier", "begin_at", "-begin_at"

	tournaments, err := h.pandaService.GetTournamentsAllGames(ctx, "running")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	// Apply sorting if specified
	h.sortTournaments(tournaments, sortParam)

	return c.JSON(http.StatusOK, tournaments)
}

// ListAllUpcomingTournaments retrieves all upcoming tournaments (optionally filtered by game)
func (h *TournamentHandler) ListAllUpcomingTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	limitParam := c.QueryParam("limit")
	offsetParam := c.QueryParam("offset")
	sortParam := c.QueryParam("sort")

	// Default pagination values
	limit := 20
	offset := 0

	// Parse limit if provided
	if limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	// Parse offset if provided
	if offsetParam != "" {
		if parsed, err := strconv.Atoi(offsetParam); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	var tournaments []models.Tournament
	var err error

	// If game is provided, fetch for specific game
	if game != "" {
		tournaments, err = h.pandaService.GetTournamentsForGame(ctx, game, "upcoming")
	} else {
		tournaments, err = h.pandaService.GetTournamentsAllGames(ctx, "upcoming")
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	// Apply sorting
	h.sortTournaments(tournaments, sortParam)

	// Apply pagination to results
	if offset >= len(tournaments) {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	end := offset + limit
	if end > len(tournaments) {
		end = len(tournaments)
	}

	return c.JSON(http.StatusOK, tournaments[offset:end])
}

// ListAllFinishedTournaments retrieves all finished tournaments (optionally filtered by game)
func (h *TournamentHandler) ListAllFinishedTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	game := c.QueryParam("game")
	limitParam := c.QueryParam("limit")
	offsetParam := c.QueryParam("offset")
	sortParam := c.QueryParam("sort")

	fmt.Printf("[ListAllFinishedTournaments] Query params - game: '%s', limit: '%s', offset: '%s', sort: '%s'\n", game, limitParam, offsetParam, sortParam)

	// Default pagination values
	limit := 20
	offset := 0

	// Parse limit if provided
	if limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	// Parse offset if provided
	if offsetParam != "" {
		if parsed, err := strconv.Atoi(offsetParam); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	var tournaments []models.Tournament
	var err error

	// If game is provided, fetch for specific game
	if game != "" {
		tournaments, err = h.pandaService.GetTournamentsForGame(ctx, game, "finished")
	} else {
		tournaments, err = h.pandaService.GetTournamentsAllGames(ctx, "finished")
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	// Apply sorting
	h.sortTournaments(tournaments, sortParam)

	// Apply pagination to results
	if offset >= len(tournaments) {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	end := offset + limit
	if end > len(tournaments) {
		end = len(tournaments)
	}

	return c.JSON(http.StatusOK, tournaments[offset:end])
}

// ListTournamentsByDate retrieves tournaments within a date range
func (h *TournamentHandler) ListTournamentsByDate(c echo.Context) error {
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

	tournaments, err := h.pandaService.GetTournamentsByDate(ctx, date, nil)
	if game != "" {
		tournaments, err = h.pandaService.GetTournamentsByDate(ctx, date, &game)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournaments: "+err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

// sortTournaments sorts tournaments based on the sort parameter
// Supported sort fields: "tier", "-tier", "begin_at", "-begin_at"
// Prefix with "-" for descending order
func (h *TournamentHandler) sortTournaments(tournaments []models.Tournament, sortParam string) {
	if sortParam == "" {
		return // No sorting if param is empty
	}

	descending := false
	field := sortParam

	// Check for descending order
	if len(sortParam) > 0 && sortParam[0] == '-' {
		descending = true
		field = sortParam[1:]
	}

	sort.Slice(tournaments, func(i, j int) bool {
		var less bool

		switch field {
		case "tier":
			// Tier order: S > A > B > C > D
			tierOrder := map[string]int{"s": 0, "a": 1, "b": 2, "c": 3, "d": 4}
			tierI := tierOrder["d"]
			tierJ := tierOrder["d"]

			if tournaments[i].Tier != nil {
				if val, ok := tierOrder[*tournaments[i].Tier]; ok {
					tierI = val
				}
			}
			if tournaments[j].Tier != nil {
				if val, ok := tierOrder[*tournaments[j].Tier]; ok {
					tierJ = val
				}
			}

			less = tierI < tierJ

		case "begin_at":
			// Sort by tournament start date
			var timeI, timeJ time.Time

			if tournaments[i].BeginAt != nil {
				timeI = *tournaments[i].BeginAt
			}
			if tournaments[j].BeginAt != nil {
				timeJ = *tournaments[j].BeginAt
			}

			less = timeI.Before(timeJ)

		default:
			return false // Unknown sort field, no sorting
		}

		if descending {
			return !less
		}
		return less
	})
}
