package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type TeamHandler struct {
	BaseHandler
	authService       *services.AuthService
	liquipediaService *services.LiquipediaService
	gormDB            interface{} // Can be *gorm.DB or *database.Database
}

// getDB extracts the *gorm.DB from the interface
func (h *TeamHandler) getDB() *gorm.DB {
	switch v := h.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}

func (h *TeamHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/teams/search", h.SearchTeams)
	g.GET("/teams/:id", h.GetTeam)
	g.GET("/users/favorite-teams/ids", h.GetFavoriteTeamIDs)
	g.GET("/users/favorite-teams", h.GetFavoriteTeams)
	g.POST("/users/favorite-teams/:teamId", h.AddFavoriteTeam)
	g.DELETE("/users/favorite-teams/:teamId", h.RemoveFavoriteTeam)
}

// SearchTeams searches teams via Liquipedia across all wikis.
// GET /api/teams/search?query=fnatic&page_size=10
func (h *TeamHandler) SearchTeams(c echo.Context) error {
	query := c.QueryParam("query")
	if query == "" {
		query = c.QueryParam("q")
	}
	if query == "" {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	pageSize := 10
	if ps := c.QueryParam("page_size"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}
	if ps := c.QueryParam("pageSize"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	teams, err := h.liquipediaService.SearchTeams(ctx, query, pageSize)
	if err != nil {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	return c.JSON(http.StatusOK, teams)
}

// GetTeam retrieves a single team by pageid with roster.
// GET /api/teams/:id
func (h *TeamHandler) GetTeam(c echo.Context) error {
	idParam := c.Param("id")
	pageID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid team ID")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	team, err := h.liquipediaService.GetTeamByPageID(ctx, pageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Team not found")
	}

	return c.JSON(http.StatusOK, team)
}

// GetFavoriteTeamIDs returns the raw list of favorite team IDs from DB.
// GET /api/users/favorite-teams/ids
func (h *TeamHandler) GetFavoriteTeamIDs(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.JSON(http.StatusOK, []int64{})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch favorite teams: "+err.Error())
	}

	if user.FavoriteTeams == nil {
		user.FavoriteTeams = []int64{}
	}

	return c.JSON(http.StatusOK, user.FavoriteTeams)
}

// GetFavoriteTeams returns favorite teams with full details resolved via Liquipedia.
// GET /api/users/favorite-teams
func (h *TeamHandler) GetFavoriteTeams(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 20*time.Second)
	defer cancel()

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user: "+err.Error())
	}

	if user.FavoriteTeams == nil || len(user.FavoriteTeams) == 0 {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	// Resolve team details via Liquipedia (parallel fetches)
	teams := h.liquipediaService.GetTeamsByPageIDs(ctx, []int64(user.FavoriteTeams))

	return c.JSON(http.StatusOK, teams)
}

// AddFavoriteTeam adds a team to user favorites (max 3).
// POST /api/users/favorite-teams/:teamId
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

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user: "+err.Error())
	}

	// Check if team is already in favorites
	for _, id := range user.FavoriteTeams {
		if id == teamID {
			return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": user.FavoriteTeams})
		}
	}

	// Check max limit (3 teams)
	if len(user.FavoriteTeams) >= 3 {
		return echo.NewHTTPError(http.StatusBadRequest, "Vous ne pouvez avoir que 3 equipes favorites")
	}

	user.FavoriteTeams = append(user.FavoriteTeams, teamID)
	if err := h.getDB().WithContext(ctx).Model(&user).Update("favorite_teams", user.FavoriteTeams).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to add favorite team: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": user.FavoriteTeams})
}

// RemoveFavoriteTeam removes a team from user favorites.
// DELETE /api/users/favorite-teams/:teamId
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

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user: "+err.Error())
	}

	newFavorites := []int64{}
	for _, id := range user.FavoriteTeams {
		if id != teamID {
			newFavorites = append(newFavorites, id)
		}
	}

	if err := h.getDB().WithContext(ctx).Model(&user).Update("favorite_teams", newFavorites).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to remove favorite team: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": newFavorites})
}

// Helper to extract user ID
func extractUserIDFromHandler(h *TeamHandler, c echo.Context) (int64, error) {
	if h.authService == nil {
		return 0, fmt.Errorf("auth service not available")
	}

	tokenString := extractToken(c)
	if tokenString == "" {
		return 0, fmt.Errorf("missing token")
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return 0, err
	}

	return claims.UserID, nil
}
