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

// Limits for free users
const (
	FreeMatchSubLimit      = 5
	FreeTournamentSubLimit = 3
)

type MatchSubHandler struct {
	BaseHandler
	authService *services.AuthService
	gormDB      interface{}
}

func (h *MatchSubHandler) getDB() *gorm.DB {
	switch v := h.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}

func (h *MatchSubHandler) extractUserID(c echo.Context) (int64, error) {
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

func (h *MatchSubHandler) RegisterRoutes(g RouterGroup) {
	// Push tokens
	g.POST("/push-tokens", h.RegisterPushToken)
	g.DELETE("/push-tokens", h.UnregisterPushToken)

	// Match subscriptions
	g.GET("/subscriptions/matches", h.GetMatchSubscriptions)
	g.GET("/subscriptions/matches/ids", h.GetMatchSubscriptionIDs)
	g.POST("/subscriptions/matches/:matchId", h.SubscribeToMatch)
	g.DELETE("/subscriptions/matches/:matchId", h.UnsubscribeFromMatch)

	// Tournament subscriptions
	g.GET("/subscriptions/tournaments", h.GetTournamentSubscriptions)
	g.GET("/subscriptions/tournaments/ids", h.GetTournamentSubscriptionIDs)
	g.POST("/subscriptions/tournaments/:tournamentId", h.SubscribeToTournament)
	g.DELETE("/subscriptions/tournaments/:tournamentId", h.UnsubscribeFromTournament)
}

// --- Push Tokens ---

func (h *MatchSubHandler) RegisterPushToken(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := c.Bind(&input); err != nil || input.Token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Token is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Upsert: find or create by token, always update user_id/platform/active
	var pushToken models.PushToken
	result := h.getDB().WithContext(ctx).
		Where("token = ?", input.Token).
		Assign(map[string]interface{}{
			"user_id":  userID,
			"platform": input.Platform,
			"active":   true,
		}).
		FirstOrCreate(&pushToken, models.PushToken{Token: input.Token})
	if result.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to register push token")
	}

	status := http.StatusOK
	if result.RowsAffected > 0 {
		status = http.StatusCreated
	}
	return c.JSON(status, pushToken)
}

func (h *MatchSubHandler) UnregisterPushToken(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input struct {
		Token string `json:"token"`
	}
	if err := c.Bind(&input); err != nil || input.Token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Token is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Soft-deactivate the token
	h.getDB().WithContext(ctx).Model(&models.PushToken{}).
		Where("token = ? AND user_id = ?", input.Token, userID).
		Update("active", false)

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// --- Match Subscriptions ---

func (h *MatchSubHandler) GetMatchSubscriptions(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var subs []models.MatchSubscription
	if err := h.getDB().WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&subs).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch match subscriptions")
	}

	return c.JSON(http.StatusOK, subs)
}

func (h *MatchSubHandler) GetMatchSubscriptionIDs(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var ids []int64
	if err := h.getDB().WithContext(ctx).
		Model(&models.MatchSubscription{}).
		Where("user_id = ?", userID).
		Pluck("match_id", &ids).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch match subscription IDs")
	}

	if ids == nil {
		ids = []int64{}
	}

	return c.JSON(http.StatusOK, ids)
}

func (h *MatchSubHandler) SubscribeToMatch(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	matchID, err := strconv.ParseInt(c.Param("matchId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid match ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check premium status and enforce limits
	if err := h.checkMatchSubLimit(ctx, userID); err != nil {
		return err
	}

	var input struct {
		MatchName      string  `json:"match_name"`
		TournamentName string  `json:"tournament_name"`
		GameAcronym    string  `json:"game_acronym"`
		BeginAt        *string `json:"begin_at"`
	}
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	var beginAt *time.Time
	if input.BeginAt != nil && *input.BeginAt != "" {
		t, err := time.Parse(time.RFC3339, *input.BeginAt)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid begin_at format, expected RFC3339")
		}
		beginAt = &t
	}

	sub := models.MatchSubscription{
		UserID:         userID,
		MatchID:        matchID,
		GameAcronym:    input.GameAcronym,
		MatchName:      input.MatchName,
		TournamentName: input.TournamentName,
		BeginAt:        beginAt,
		Status:         "upcoming",
	}

	// Use ON CONFLICT to avoid duplicates
	result := h.getDB().WithContext(ctx).
		Where("user_id = ? AND match_id = ?", userID, matchID).
		FirstOrCreate(&sub)
	if result.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to subscribe to match")
	}

	return c.JSON(http.StatusCreated, sub)
}

func (h *MatchSubHandler) UnsubscribeFromMatch(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	matchID, err := strconv.ParseInt(c.Param("matchId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid match ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := h.getDB().WithContext(ctx).
		Where("user_id = ? AND match_id = ?", userID, matchID).
		Delete(&models.MatchSubscription{}).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unsubscribe from match")
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// --- Tournament Subscriptions ---

func (h *MatchSubHandler) GetTournamentSubscriptions(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var subs []models.TournamentSubscription
	if err := h.getDB().WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&subs).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournament subscriptions")
	}

	return c.JSON(http.StatusOK, subs)
}

func (h *MatchSubHandler) GetTournamentSubscriptionIDs(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var ids []int64
	if err := h.getDB().WithContext(ctx).
		Model(&models.TournamentSubscription{}).
		Where("user_id = ?", userID).
		Pluck("tournament_id", &ids).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch tournament subscription IDs")
	}

	if ids == nil {
		ids = []int64{}
	}

	return c.JSON(http.StatusOK, ids)
}

func (h *MatchSubHandler) SubscribeToTournament(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	tournamentID, err := strconv.ParseInt(c.Param("tournamentId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tournament ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check premium status and enforce limits
	if err := h.checkTournamentSubLimit(ctx, userID); err != nil {
		return err
	}

	var input struct {
		TournamentName string  `json:"tournament_name"`
		GameAcronym    string  `json:"game_acronym"`
		BeginAt        *string `json:"begin_at"`
		EndAt          *string `json:"end_at"`
		MatchIDs       []int64 `json:"match_ids"`
	}
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	var beginAt, endAt *time.Time
	if input.BeginAt != nil && *input.BeginAt != "" {
		t, err := time.Parse(time.RFC3339, *input.BeginAt)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid begin_at format, expected RFC3339")
		}
		beginAt = &t
	}
	if input.EndAt != nil && *input.EndAt != "" {
		t, err := time.Parse(time.RFC3339, *input.EndAt)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid end_at format, expected RFC3339")
		}
		endAt = &t
	}

	// Check match sub limit for free users when auto-subscribing matches
	var isPremium bool
	var currentUser models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&currentUser).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}
	isPremium = currentUser.Premium != nil && *currentUser.Premium

	// Use transaction for tournament + match subscriptions
	err = h.getDB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create tournament subscription
		tournamentSub := models.TournamentSubscription{
			UserID:         userID,
			TournamentID:   tournamentID,
			GameAcronym:    input.GameAcronym,
			TournamentName: input.TournamentName,
			BeginAt:        beginAt,
			EndAt:          endAt,
			Status:         "running",
		}

		result := tx.Where("user_id = ? AND tournament_id = ?", userID, tournamentID).
			FirstOrCreate(&tournamentSub)
		if result.Error != nil {
			return result.Error
		}

		// Auto-subscribe to all matches in the tournament (respecting limits for free users)
		if len(input.MatchIDs) > 0 {
			var existingMatchSubCount int64
			if err := tx.Model(&models.MatchSubscription{}).
				Where("user_id = ?", userID).
				Count(&existingMatchSubCount).Error; err != nil {
				return err
			}

			for _, matchID := range input.MatchIDs {
				// Check limit for free users before each creation
				if !isPremium && existingMatchSubCount >= FreeMatchSubLimit {
					break
				}

				matchSub := models.MatchSubscription{
					UserID:         userID,
					MatchID:        matchID,
					GameAcronym:    input.GameAcronym,
					TournamentName: input.TournamentName,
					Status:         "upcoming",
					FromTournament: &tournamentID,
				}
				// Skip if already subscribed to this match
				res := tx.Where("user_id = ? AND match_id = ?", userID, matchID).
					FirstOrCreate(&matchSub)
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected > 0 {
					existingMatchSubCount++
				}
			}
		}

		return nil
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to subscribe to tournament")
	}

	// Return the created tournament subscription
	var created models.TournamentSubscription
	if err := h.getDB().WithContext(ctx).
		Where("user_id = ? AND tournament_id = ?", userID, tournamentID).
		First(&created).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Tournament subscribed but failed to fetch result")
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *MatchSubHandler) UnsubscribeFromTournament(c echo.Context) error {
	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	tournamentID, err := strconv.ParseInt(c.Param("tournamentId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tournament ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use transaction to delete tournament sub + auto-created match subs
	err = h.getDB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete auto-created match subscriptions from this tournament
		if err := tx.Where("user_id = ? AND from_tournament = ?", userID, tournamentID).
			Delete(&models.MatchSubscription{}).Error; err != nil {
			return err
		}

		// Delete the tournament subscription
		if err := tx.Where("user_id = ? AND tournament_id = ?", userID, tournamentID).
			Delete(&models.TournamentSubscription{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unsubscribe from tournament")
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// --- Helpers ---

func (h *MatchSubHandler) checkMatchSubLimit(ctx context.Context, userID int64) error {
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	// Premium users have no limit
	if user.Premium != nil && *user.Premium {
		return nil
	}

	var count int64
	if err := h.getDB().WithContext(ctx).Model(&models.MatchSubscription{}).
		Where("user_id = ?", userID).
		Count(&count).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to count match subscriptions")
	}

	if count >= FreeMatchSubLimit {
		return echo.NewHTTPError(http.StatusForbidden, map[string]interface{}{
			"error": "Free users are limited to 5 match subscriptions",
			"limit": FreeMatchSubLimit,
			"count": count,
		})
	}

	return nil
}

func (h *MatchSubHandler) checkTournamentSubLimit(ctx context.Context, userID int64) error {
	var user models.User
	if err := h.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	// Premium users have no limit
	if user.Premium != nil && *user.Premium {
		return nil
	}

	var count int64
	if err := h.getDB().WithContext(ctx).Model(&models.TournamentSubscription{}).
		Where("user_id = ?", userID).
		Count(&count).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to count tournament subscriptions")
	}

	if count >= FreeTournamentSubLimit {
		return echo.NewHTTPError(http.StatusForbidden, map[string]interface{}{
			"error": "Free users are limited to 3 tournament subscriptions",
			"limit": FreeTournamentSubLimit,
			"count": count,
		})
	}

	return nil
}
