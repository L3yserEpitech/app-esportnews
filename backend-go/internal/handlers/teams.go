package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type TeamHandler struct {
	BaseHandler
	authService       *services.AuthService
	liquipediaService *services.LiquipediaService
	gormDB            interface{} // Can be *gorm.DB or *database.Database
	redisCache        *cache.RedisCache
	log               *logrus.Logger
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
	g.GET("/teams/by-template", h.GetTeamByTemplate)
	g.GET("/teams/:id/detail", h.GetTeamDetail)
	g.GET("/teams/:id/matches", h.GetTeamMatches)
	g.GET("/teams/:id/placements", h.GetTeamPlacements)
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

// GetTeamByTemplate retrieves a team by its Liquipedia template/pagename on a specific wiki.
// GET /api/teams/by-template?template=xxx&wiki=yyy
func (h *TeamHandler) GetTeamByTemplate(c echo.Context) error {
	template := c.QueryParam("template")
	if template == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "template query parameter required")
	}
	wiki := c.QueryParam("wiki")
	if wiki == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "wiki query parameter required")
	}

	// Resolve wiki name if acronym was passed
	if resolved, ok := models.GameWikiMapping[wiki]; ok {
		wiki = resolved
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	team, err := h.liquipediaService.GetTeamByTemplate(ctx, wiki, template)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Team not found")
	}

	return c.JSON(http.StatusOK, team)
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

// GetTeamDetail returns comprehensive team details including enriched info and roster.
// GET /api/teams/:id/detail
func (h *TeamHandler) GetTeamDetail(c echo.Context) error {
	idParam := c.Param("id")
	pageID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid team ID")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 20*time.Second)
	defer cancel()

	detail, err := h.liquipediaService.GetTeamDetailByPageID(ctx, pageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Team not found")
	}

	return c.JSON(http.StatusOK, detail)
}

// GetTeamMatches returns recent and upcoming matches for a team (lazy loaded).
// GET /api/teams/:id/matches?wiki=valorant&template=fnatic
// Reads from the Redis match caches (populated by the poller) and filters by team template.
func (h *TeamHandler) GetTeamMatches(c echo.Context) error {
	wiki := c.QueryParam("wiki")
	if wiki == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "wiki query parameter required")
	}

	template := c.QueryParam("template")
	if template == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "template query parameter required")
	}

	// Resolve acronym to wiki name if needed
	if resolved, ok := models.GameWikiMapping[wiki]; ok {
		wiki = resolved
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	templateLower := strings.ToLower(template)
	// Also accept team name/pagename for direct API fallback (opponent field is case-sensitive pagename)
	teamName := c.QueryParam("name")

	// Filter: does this LiqMatch involve the requested team?
	// Uses HasPrefix to handle year suffixes (e.g. template "3dmax" matches "3dmax 2024")
	teamFilter := func(m models.LiqMatch) bool {
		if m.Match2Opponents == nil {
			return false
		}
		var opps []models.LiqOpponent
		if err := json.Unmarshal(m.Match2Opponents, &opps); err != nil {
			return false
		}
		for _, opp := range opps {
			oppTemplateLower := strings.ToLower(opp.Template)
			if oppTemplateLower == templateLower || strings.HasPrefix(oppTemplateLower, templateLower+" ") {
				return true
			}
		}
		return false
	}

	// Recent: finished matches (past cache, sorted desc — most recent first)
	recent := h.filterTeamMatchesFromCache(ctx, cache.LiqMatchesPastKey(wiki), wiki, "finished", teamFilter)
	sortNormalizedMatchesDesc(recent)
	if len(recent) > 10 {
		recent = recent[:10]
	}

	// Upcoming: not-started + running matches
	upcomingMatches := h.filterTeamMatchesFromCache(ctx, cache.LiqMatchesUpcomingKey(wiki), wiki, "not_started", teamFilter)
	runningMatches := h.filterTeamMatchesFromCache(ctx, cache.LiqMatchesRunningKey(wiki), wiki, "running", teamFilter)
	allUpcoming := teamMatchesDedup(append(runningMatches, upcomingMatches...))
	sortNormalizedMatchesAsc(allUpcoming)
	if len(allUpcoming) > 10 {
		allUpcoming = allUpcoming[:10]
	}

	// Fallback: if Redis cache is empty for either category, try direct API call independently
	if len(recent) == 0 && teamName != "" {
		h.log.WithFields(logrus.Fields{
			"wiki":     wiki,
			"template": template,
			"name":     teamName,
		}).Info("Redis past cache empty for team, falling back to direct API for recent matches")

		if apiRecent, err := h.liquipediaService.FetchTeamMatches(ctx, wiki, teamName, "recent"); err == nil {
			recent = apiRecent
		}
	}
	if len(allUpcoming) == 0 && teamName != "" {
		h.log.WithFields(logrus.Fields{
			"wiki":     wiki,
			"template": template,
			"name":     teamName,
		}).Info("Redis upcoming cache empty for team, falling back to direct API for upcoming matches")

		if apiUpcoming, err := h.liquipediaService.FetchTeamMatches(ctx, wiki, teamName, "upcoming"); err == nil {
			allUpcoming = apiUpcoming
		}
	}

	if recent == nil {
		recent = []models.NormalizedMatch{}
	}
	if allUpcoming == nil {
		allUpcoming = []models.NormalizedMatch{}
	}

	return c.JSON(http.StatusOK, models.TeamMatchesResponse{
		Recent:   recent,
		Upcoming: allUpcoming,
	})
}

// GetTeamPlacements returns recent tournament placements for a team.
// GET /api/teams/:id/placements?wiki=counterstrike&name=3DMAX
func (h *TeamHandler) GetTeamPlacements(c echo.Context) error {
	wiki := c.QueryParam("wiki")
	if wiki == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "wiki query parameter required")
	}
	teamName := c.QueryParam("name")
	if teamName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name query parameter required")
	}

	// Resolve acronym to wiki name if needed
	if resolved, ok := models.GameWikiMapping[wiki]; ok {
		wiki = resolved
	}

	limit := 20
	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	placements, err := h.liquipediaService.FetchTeamPlacements(ctx, wiki, teamName, limit)
	if err != nil {
		h.log.WithError(err).WithFields(logrus.Fields{
			"wiki": wiki,
			"name": teamName,
		}).Warn("Failed to fetch team placements")
		return c.JSON(http.StatusOK, models.TeamPlacementsResponse{Placements: []models.NormalizedPlacement{}})
	}

	return c.JSON(http.StatusOK, models.TeamPlacementsResponse{Placements: placements})
}

// filterTeamMatchesFromCache reads a Redis cache key containing raw Liquipedia match JSON
// and returns normalized matches that pass the given filter function.
// Falls back to the stale key if the main key has expired.
func (h *TeamHandler) filterTeamMatchesFromCache(ctx context.Context, cacheKey, wiki, statusHint string, filter func(models.LiqMatch) bool) []models.NormalizedMatch {
	if h.redisCache == nil {
		return []models.NormalizedMatch{}
	}
	data, err := h.redisCache.Get(ctx, cacheKey)
	if err != nil || data == "" {
		// Main key expired — try stale key (TTL 1h)
		data, err = h.redisCache.Get(ctx, cache.StaleKey(cacheKey))
		if err != nil || data == "" {
			return []models.NormalizedMatch{}
		}
	}
	resp, err := services.ParseResponse([]byte(data))
	if err != nil {
		return []models.NormalizedMatch{}
	}
	result := make([]models.NormalizedMatch, 0)
	for _, raw := range resp.Result {
		var m models.LiqMatch
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		if !m.HasTwoNamedOpponents() || !filter(m) {
			continue
		}
		result = append(result, models.NormalizeLiqMatch(m, wiki, statusHint))
	}
	return result
}

// teamMatchesDedup removes duplicate matches (by Match2ID) from a slice.
func teamMatchesDedup(matches []models.NormalizedMatch) []models.NormalizedMatch {
	seen := make(map[string]bool)
	result := make([]models.NormalizedMatch, 0, len(matches))
	for _, m := range matches {
		key := m.Match2ID
		if key == "" {
			key = fmt.Sprintf("%d", m.ID)
		}
		if !seen[key] {
			seen[key] = true
			result = append(result, m)
		}
	}
	return result
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
