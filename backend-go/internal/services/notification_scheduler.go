package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

const (
	schedulerTickInterval  = 60 * time.Second
	cleanupTickInterval    = 30 * time.Minute
	hydrationTickInterval  = 10 * time.Minute
	maxSubsPerTick         = 500
	staleFinishedThreshold = 7 * 24 * time.Hour // 7 days
)

// NotificationScheduler checks match subscriptions and dispatches push notifications
type NotificationScheduler struct {
	gormDB      interface{}
	redisClient *cache.RedisCache
	pushService *ExpoPushService
	logger      *logrus.Logger
}

func NewNotificationScheduler(
	gormDB interface{},
	redisClient *cache.RedisCache,
	pushService *ExpoPushService,
	logger *logrus.Logger,
) *NotificationScheduler {
	return &NotificationScheduler{
		gormDB:      gormDB,
		redisClient: redisClient,
		pushService: pushService,
		logger:      logger,
	}
}

func (s *NotificationScheduler) getDB() *gorm.DB {
	switch v := s.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}

// Start runs the scheduler in a goroutine. Blocks until context is canceled.
func (s *NotificationScheduler) Start(ctx context.Context) {
	s.logger.Info("[NotifScheduler] Starting notification scheduler")

	mainTicker := time.NewTicker(schedulerTickInterval)
	cleanupTicker := time.NewTicker(cleanupTickInterval)
	hydrationTicker := time.NewTicker(hydrationTickInterval)

	defer mainTicker.Stop()
	defer cleanupTicker.Stop()
	defer hydrationTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("[NotifScheduler] Stopping notification scheduler")
			return
		case <-mainTicker.C:
			s.processMatchNotifications(ctx)
		case <-cleanupTicker.C:
			s.cleanupStaleSubscriptions(ctx)
		case <-hydrationTicker.C:
			s.hydrateTournamentMatches(ctx)
		}
	}
}

// processMatchNotifications checks active match subscriptions against Redis match data
func (s *NotificationScheduler) processMatchNotifications(ctx context.Context) {
	db := s.getDB()

	// Fetch active subscriptions that haven't been fully notified
	var subs []models.MatchSubscription
	if err := db.WithContext(ctx).
		Where("status IN ? AND notified_start = ?", []string{"upcoming", "running"}, false).
		Limit(maxSubsPerTick).
		Find(&subs).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch subscriptions: %v", err)
		return
	}

	if len(subs) == 0 {
		return
	}

	// Group subscriptions by game acronym to batch Redis lookups
	subsByGame := make(map[string][]models.MatchSubscription)
	for _, sub := range subs {
		subsByGame[sub.GameAcronym] = append(subsByGame[sub.GameAcronym], sub)
	}

	var messages []ExpoPushMessage
	var subsToUpdate []subUpdate

	for gameAcronym, gameSubs := range subsByGame {
		// Build a match lookup from Redis running matches
		runningMatches := s.getMatchesFromRedis(ctx, "running", gameAcronym)
		runningMap := make(map[int64]models.PandaMatch)
		for _, m := range runningMatches {
			runningMap[m.ID] = m
		}

		for _, sub := range gameSubs {
			match, isRunning := runningMap[sub.MatchID]

			if isRunning && !sub.NotifiedStart {
				// Match is now running — send "match started" notification
				tokens := s.getUserPushTokens(ctx, sub.UserID)
				if len(tokens) > 0 && s.userWantsMatchNotifs(ctx, sub.UserID) {
					matchName := sub.MatchName
					if matchName == "" && match.Name != "" {
						matchName = match.Name
					}
					messages = append(messages, ExpoPushMessage{
						To:    tokens,
						Title: "Match en direct",
						Body:  fmt.Sprintf("%s vient de commencer !", matchName),
						Sound: "default",
						Data: map[string]interface{}{
							"type":         "match_start",
							"match_id":     sub.MatchID,
							"game_acronym": sub.GameAcronym,
						},
					})
				}
				subsToUpdate = append(subsToUpdate, subUpdate{
					id:     sub.ID,
					fields: map[string]interface{}{"notified_start": true, "status": "running"},
				})
			}

			// Check for reschedule
			if isRunning && match.BeginAt != nil && sub.BeginAt != nil {
				if !match.BeginAt.Equal(*sub.BeginAt) {
					subsToUpdate = append(subsToUpdate, subUpdate{
						id:     sub.ID,
						fields: map[string]interface{}{"begin_at": match.BeginAt},
					})
				}
			}
		}
	}

	// Send all notifications in batch
	if len(messages) > 0 {
		invalidTokens, err := s.pushService.SendBatch(ctx, messages)
		if err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to send batch: %v", err)
		}
		// Deactivate invalid tokens
		if len(invalidTokens) > 0 {
			s.deactivateTokens(ctx, invalidTokens)
		}
		s.logger.Infof("[NotifScheduler] Sent %d notifications", len(messages))
	}

	// Apply DB updates
	for _, upd := range subsToUpdate {
		if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
			Where("id = ?", upd.id).
			Updates(upd.fields).Error; err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to update subscription %d: %v", upd.id, err)
		}
	}
}

// cleanupStaleSubscriptions marks finished subs and deletes old ones
func (s *NotificationScheduler) cleanupStaleSubscriptions(ctx context.Context) {
	db := s.getDB()
	threshold := time.Now().Add(-staleFinishedThreshold)

	// Delete old finished/canceled match subscriptions
	result := db.WithContext(ctx).
		Where("status IN ? AND created_at < ?", []string{"finished", "canceled"}, threshold).
		Delete(&models.MatchSubscription{})
	if result.Error != nil {
		s.logger.Errorf("[NotifScheduler] Cleanup match subs error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		s.logger.Infof("[NotifScheduler] Cleaned up %d stale match subscriptions", result.RowsAffected)
	}

	// Delete old finished tournament subscriptions
	result = db.WithContext(ctx).
		Where("status = ? AND end_at < ?", "finished", threshold).
		Delete(&models.TournamentSubscription{})
	if result.Error != nil {
		s.logger.Errorf("[NotifScheduler] Cleanup tournament subs error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		s.logger.Infof("[NotifScheduler] Cleaned up %d stale tournament subscriptions", result.RowsAffected)
	}
}

// hydrateTournamentMatches creates missing match subscriptions for tournament subscribers
func (s *NotificationScheduler) hydrateTournamentMatches(ctx context.Context) {
	db := s.getDB()

	var tournamentSubs []models.TournamentSubscription
	if err := db.WithContext(ctx).
		Where("status IN ?", []string{"running", "upcoming"}).
		Find(&tournamentSubs).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch tournament subs: %v", err)
		return
	}

	for _, ts := range tournamentSubs {
		// Read tournament from Redis to get current match list
		tournamentKey := cache.PandaScoreTournamentKey(fmt.Sprintf("%d", ts.TournamentID))
		data, err := s.redisClient.Get(ctx, tournamentKey)
		if err != nil {
			continue // Tournament not in cache, skip
		}

		var tournament models.Tournament
		if err := json.Unmarshal([]byte(data), &tournament); err != nil {
			s.logger.Warnf("[NotifScheduler] Failed to unmarshal tournament %d: %v", ts.TournamentID, err)
			continue
		}

		// Check each match in the tournament
		for _, match := range tournament.Matches {
			var count int64
			if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
				Where("user_id = ? AND match_id = ?", ts.UserID, match.ID).
				Count(&count).Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to count match subs for user %d match %d: %v", ts.UserID, match.ID, err)
				continue
			}

			if count == 0 {
				// Create missing match subscription
				matchSub := models.MatchSubscription{
					UserID:         ts.UserID,
					MatchID:        match.ID,
					GameAcronym:    ts.GameAcronym,
					MatchName:      match.Name,
					TournamentName: ts.TournamentName,
					BeginAt:        match.BeginAt,
					Status:         "upcoming",
					FromTournament: &ts.TournamentID,
				}
				if err := db.WithContext(ctx).Create(&matchSub).Error; err != nil {
					s.logger.Errorf("[NotifScheduler] Failed to create match sub for user %d match %d: %v", ts.UserID, match.ID, err)
				}
			}
		}
	}
}

// --- Helpers ---

type subUpdate struct {
	id     int64
	fields map[string]interface{}
}

// getMatchesFromRedis reads cached matches for a given status and game
func (s *NotificationScheduler) getMatchesFromRedis(ctx context.Context, status, gameAcronym string) []models.PandaMatch {
	var cacheKey string
	switch status {
	case "running":
		cacheKey = cache.PandaScoreRunningMatchesKey(&gameAcronym)
	case "upcoming":
		cacheKey = cache.PandaScoreUpcomingMatchesKey(&gameAcronym)
	case "past":
		cacheKey = cache.PandaScorePastMatchesKey(&gameAcronym)
	default:
		return nil
	}

	data, err := s.redisClient.Get(ctx, cacheKey)
	if err != nil {
		return nil
	}

	var matches []models.PandaMatch
	if err := json.Unmarshal([]byte(data), &matches); err != nil {
		s.logger.Warnf("[NotifScheduler] Failed to unmarshal matches for %s/%s: %v", status, gameAcronym, err)
		return nil
	}

	return matches
}

// getUserPushTokens returns active push tokens for a user
func (s *NotificationScheduler) getUserPushTokens(ctx context.Context, userID int64) []string {
	db := s.getDB()

	var tokens []string
	if err := db.WithContext(ctx).Model(&models.PushToken{}).
		Where("user_id = ? AND active = ?", userID, true).
		Pluck("token", &tokens).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch push tokens for user %d: %v", userID, err)
		return nil
	}

	return tokens
}

// userWantsMatchNotifs checks if the user has match notifications enabled
func (s *NotificationScheduler) userWantsMatchNotifs(ctx context.Context, userID int64) bool {
	db := s.getDB()

	var user models.User
	if err := db.WithContext(ctx).
		Select("notifi_push", "notif_matchs").
		Where("id = ?", userID).
		First(&user).Error; err != nil {
		return false
	}

	pushEnabled := user.NotifiPush != nil && *user.NotifiPush
	matchEnabled := user.NotifMatches != nil && *user.NotifMatches

	return pushEnabled && matchEnabled
}

// deactivateTokens marks tokens as inactive
func (s *NotificationScheduler) deactivateTokens(ctx context.Context, tokens []string) {
	db := s.getDB()
	if err := db.WithContext(ctx).Model(&models.PushToken{}).
		Where("token IN ?", tokens).
		Update("active", false).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to deactivate tokens: %v", err)
	}
}
