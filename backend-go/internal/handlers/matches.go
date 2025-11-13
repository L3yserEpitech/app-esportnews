package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

type MatchHandler struct {
	BaseHandler
}

func (h *MatchHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/matches", h.ListMatches)           // List all matches with optional filters
	g.GET("/matches/by-date", h.GetMatchesByDate)
	g.GET("/matches/:id", h.GetMatch)
}

func (h *MatchHandler) ListMatches(c echo.Context) error {
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

	service := services.NewMatchService(h.DB, h.Cache)
	matches, err := service.GetMatches(ctx, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}

func (h *MatchHandler) GetMatchesByDate(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	date := c.QueryParam("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	gameAcronym := c.QueryParam("game")

	service := services.NewMatchService(h.DB, h.Cache)
	matches, err := service.GetMatchesByDate(ctx, date, gameAcronym)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}

func (h *MatchHandler) GetMatch(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid match ID")
	}

	service := services.NewMatchService(h.DB, h.Cache)
	match, err := service.GetMatch(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, match)
}
