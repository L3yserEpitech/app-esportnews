package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type TournamentHandler struct {
	BaseHandler
}

func (h *TournamentHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/tournaments", h.ListTournaments)
	g.GET("/tournaments/filtered", h.FilterTournaments)
	g.GET("/tournaments/:id", h.GetTournament)
}

func (h *TournamentHandler) ListTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	limit := 50
	offset := 0

	if l := c.QueryParam("limit"); l != "" {
		if lim, err := strconv.Atoi(l); err == nil {
			limit = lim
		}
	}
	if o := c.QueryParam("offset"); o != "" {
		if off, err := strconv.Atoi(o); err == nil {
			offset = off
		}
	}

	filter := &models.TournamentFilter{
		Limit:  limit,
		Offset: offset,
	}

	service := services.NewTournamentService(h.DB, h.Cache)
	tournaments, err := service.GetTournaments(ctx, filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

func (h *TournamentHandler) FilterTournaments(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	gameAcronym := c.QueryParam("game")
	status := c.QueryParam("status")
	tier := c.QueryParam("tier")

	filter := &models.TournamentFilter{
		GameAcronym: gameAcronym,
		Limit:       50,
		Offset:      0,
	}

	if status != "" {
		filter.Status = &status
	}
	if tier != "" {
		filter.Tier = &tier
	}

	service := services.NewTournamentService(h.DB, h.Cache)
	tournaments, err := service.GetTournaments(ctx, filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tournaments)
}

func (h *TournamentHandler) GetTournament(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tournament ID")
	}

	service := services.NewTournamentService(h.DB, h.Cache)
	tournament, err := service.GetTournament(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, tournament)
}
