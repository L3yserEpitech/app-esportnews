package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

type TeamHandler struct {
	BaseHandler
}

func (h *TeamHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/teams/search", h.SearchTeams)
	g.GET("/users/favorite-teams/ids", h.GetFavoriteTeamIDs)
	g.GET("/users/favorite-teams", h.GetFavoriteTeams)
	g.POST("/users/favorite-teams/:teamId", h.AddFavoriteTeam)
	g.DELETE("/users/favorite-teams/:teamId", h.RemoveFavoriteTeam)
}

func (h *TeamHandler) SearchTeams(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := c.QueryParam("q")
	if query == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Missing search query")
	}

	limit := 10
	if l := c.QueryParam("limit"); l != "" {
		if lim, err := strconv.Atoi(l); err == nil && lim > 0 {
			limit = lim
		}
	}

	service := services.NewTeamService(h.DB)
	teams, err := service.SearchTeams(ctx, query, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, teams)
}

func (h *TeamHandler) GetFavoriteTeamIDs(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var teamIDs []int64
	err = h.DB.QueryRow(ctx, "SELECT favorite_teams FROM public.users WHERE id = $1", userID).Scan(&teamIDs)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"team_ids": teamIDs})
}

func (h *TeamHandler) GetFavoriteTeams(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	service := services.NewTeamService(h.DB)
	teams, err := service.GetFavoriteTeams(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, teams)
}

func (h *TeamHandler) AddFavoriteTeam(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	teamID, err := strconv.ParseInt(c.Param("teamId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid team ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	service := services.NewTeamService(h.DB)
	if err := service.AddFavoriteTeam(ctx, userID, teamID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Team added to favorites"})
}

func (h *TeamHandler) RemoveFavoriteTeam(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	teamID, err := strconv.ParseInt(c.Param("teamId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid team ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	service := services.NewTeamService(h.DB)
	if err := service.RemoveFavoriteTeam(ctx, userID, teamID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Team removed from favorites"})
}

// Helper to extract user ID
func extractUserIDFromHandler(h *TeamHandler, c echo.Context) (int64, error) {
	auth := c.Request().Header.Get("Authorization")
	if len(auth) <= 7 || auth[:7] != "Bearer " {
		return 0, fmt.Errorf("missing token")
	}

	_ = auth[7:] // tokenString - TODO: implement token verification and parsing
	// For now, return temporary placeholder
	return 1, nil
}
