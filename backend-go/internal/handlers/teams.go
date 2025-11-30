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
	pandaService *services.PandaScoreService
	authService  *services.AuthService
	gormDB       interface{} // Can be *gorm.DB or *database.Database
}

// getDB extracts the *gorm.DB from the interface
func (h *TeamHandler) getDB() *gorm.DB {
	switch v := h.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB // Access the embedded *gorm.DB
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

func (h *TeamHandler) SearchTeams(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := c.QueryParam("query")
	if query == "" {
		// Also try "q" parameter for backward compatibility
		query = c.QueryParam("q")
	}
	if query == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Query parameter is required")
	}

	pageSize := 50
	if l := c.QueryParam("page_size"); l != "" {
		if ps, err := strconv.Atoi(l); err == nil && ps > 0 {
			pageSize = ps
		}
	}

	teams, err := h.pandaService.SearchTeams(ctx, query, pageSize)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to search teams: "+err.Error())
	}

	return c.JSON(http.StatusOK, teams)
}

// GetTeam retrieves a single team by ID
func (h *TeamHandler) GetTeam(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id := c.Param("id")

	team, err := h.pandaService.GetTeam(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch team: "+err.Error())
	}

	return c.JSON(http.StatusOK, team)
}

func (h *TeamHandler) GetFavoriteTeamIDs(c echo.Context) error {
	userID, err := extractUserIDFromHandler(h, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	fmt.Printf("[GetFavoriteTeamIDs] Extracted userID: %d\n", userID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			fmt.Printf("[GetFavoriteTeamIDs] User %d not found, returning empty array\n", userID)
			return c.JSON(http.StatusOK, []int64{})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch favorite teams: "+err.Error())
	}

	if user.FavoriteTeams == nil {
		user.FavoriteTeams = []int64{}
	}

	fmt.Printf("[GetFavoriteTeamIDs] Returning %d team IDs for user %d\n", len(user.FavoriteTeams), userID)
	return c.JSON(http.StatusOK, user.FavoriteTeams)
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
		// If user doesn't exist, return empty array
		if err.Error() == "failed to get favorite team IDs: no rows in result set" {
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if teams == nil {
		return c.JSON(http.StatusOK, []interface{}{})
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

	service := services.NewTeamService(h.gormDB)
	if err := service.AddFavoriteTeam(ctx, userID, teamID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Fetch updated favorite teams list
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		fmt.Printf("[AddFavoriteTeam] Error fetching updated teams for userID %d: %v\n", userID, err)
		if err == gorm.ErrRecordNotFound {
			return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": []int64{}})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch updated favorite teams: "+err.Error())
	}

	if user.FavoriteTeams == nil {
		user.FavoriteTeams = []int64{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": user.FavoriteTeams})
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

	service := services.NewTeamService(h.gormDB)
	if err := service.RemoveFavoriteTeam(ctx, userID, teamID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Fetch updated favorite teams list
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		fmt.Printf("[RemoveFavoriteTeam] Error fetching updated teams for userID %d: %v\n", userID, err)
		if err == gorm.ErrRecordNotFound {
			return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": []int64{}})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch updated favorite teams: "+err.Error())
	}

	if user.FavoriteTeams == nil {
		user.FavoriteTeams = []int64{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"favorite_teams": user.FavoriteTeams})
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
