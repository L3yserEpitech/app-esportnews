package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

const (
	schedulerTickInterval  = 60 * time.Second
	cleanupTickInterval    = 30 * time.Minute
	hydrationTickInterval  = 10 * time.Minute
	maxSubsPerTick         = 500
	staleFinishedThreshold = 7 * 24 * time.Hour
)

// NotificationScheduler dispatches push notifications when subscribed matches
// go live, hydrates tournament-wide subscriptions with per-match subscriptions,
// and prunes stale subscriptions.
//
// It is a pure consumer of Liquipedia data: all live-data reads go through
// LiquipediaService (which fronts Redis + Liquipedia API), keeping the
// scheduler decoupled from the cache layout and from PandaScore legacy code.
type NotificationScheduler struct {
	gormDB      interface{}
	liqService  *LiquipediaService
	pushService *ExpoPushService
	logger      *logrus.Logger
}

// NewNotificationScheduler builds a scheduler. gormDB may be either a
// *gorm.DB or a *database.Database — both shapes are accepted to ease wiring.
func NewNotificationScheduler(
	gormDB interface{},
	liqService *LiquipediaService,
	pushService *ExpoPushService,
	logger *logrus.Logger,
) *NotificationScheduler {
	return &NotificationScheduler{
		gormDB:      gormDB,
		liqService:  liqService,
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

// Start runs the scheduler until the given context is cancelled.
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

// processMatchNotifications walks active match subscriptions, detects which
// ones just went live in the Liquipedia running cache, and dispatches a push
// notification to the subscribing user. Reschedules (begin_at drift) are
// persisted back to the subscription row.
func (s *NotificationScheduler) processMatchNotifications(ctx context.Context) {
	db := s.getDB()

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

	// Batch Redis lookups by game so we only build the running map once per game.
	subsByGame := make(map[string][]models.MatchSubscription, len(subs))
	for _, sub := range subs {
		subsByGame[sub.GameAcronym] = append(subsByGame[sub.GameAcronym], sub)
	}

	var (
		messages     []ExpoPushMessage
		subsToUpdate []subUpdate
	)

	for gameAcronym, gameSubs := range subsByGame {
		runningMap, err := s.runningMatchesByID(ctx, gameAcronym)
		if err != nil {
			s.logger.WithError(err).WithField("game", gameAcronym).
				Warn("[NotifScheduler] Skipping game — failed to load running matches")
			continue
		}

		for _, sub := range gameSubs {
			match, isRunning := runningMap[sub.MatchID]
			if !isRunning {
				continue
			}

			if !sub.NotifiedStart {
				msg, ok := s.buildStartNotification(ctx, sub, match)
				if ok {
					messages = append(messages, msg)
				}
				subsToUpdate = append(subsToUpdate, subUpdate{
					id: sub.ID,
					fields: map[string]interface{}{
						"notified_start": true,
						"status":         "running",
					},
				})
			}

			if newBeginAt := matchBeginsAt(match); newBeginAt != nil && sub.BeginAt != nil && !newBeginAt.Equal(*sub.BeginAt) {
				subsToUpdate = append(subsToUpdate, subUpdate{
					id:     sub.ID,
					fields: map[string]interface{}{"begin_at": newBeginAt},
				})
			}
		}
	}

	if len(messages) > 0 {
		invalidTokens, err := s.pushService.SendBatch(ctx, messages)
		if err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to send batch: %v", err)
		}
		if len(invalidTokens) > 0 {
			s.deactivateTokens(ctx, invalidTokens)
		}
		s.logger.Infof("[NotifScheduler] Sent %d notifications", len(messages))
	}

	for _, upd := range subsToUpdate {
		if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
			Where("id = ?", upd.id).
			Updates(upd.fields).Error; err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to update subscription %d: %v", upd.id, err)
		}
	}
}

// runningMatchesByID returns the currently running matches for a game, keyed
// by their numeric MatchID. The key type matches MatchSubscription.MatchID
// (int64) to avoid conversions at every lookup site.
func (s *NotificationScheduler) runningMatchesByID(ctx context.Context, gameAcronym string) (map[int64]models.NormalizedMatch, error) {
	matches, err := s.liqService.MatchesByStatus(ctx, gameAcronym, MatchStatusRunning)
	if err != nil {
		if errors.Is(err, ErrUnknownGame) {
			// Stale acronym (e.g. legacy PandaScore data) — treat as empty, never crash.
			s.logger.WithField("game", gameAcronym).Debug("[NotifScheduler] Skipping unknown game")
			return map[int64]models.NormalizedMatch{}, nil
		}
		return nil, err
	}

	indexed := make(map[int64]models.NormalizedMatch, len(matches))
	for _, m := range matches {
		indexed[int64(m.ID)] = m
	}
	return indexed, nil
}

// buildStartNotification returns the ExpoPushMessage to send for a match that
// just went live. The second return value is false when the user has no
// active push token or has disabled match notifications.
func (s *NotificationScheduler) buildStartNotification(ctx context.Context, sub models.MatchSubscription, match models.NormalizedMatch) (ExpoPushMessage, bool) {
	tokens := s.getUserPushTokens(ctx, sub.UserID)
	if len(tokens) == 0 || !s.userWantsMatchNotifs(ctx, sub.UserID) {
		return ExpoPushMessage{}, false
	}

	name := sub.MatchName
	if name == "" && match.Name != "" {
		name = match.Name
	}

	return ExpoPushMessage{
		To:    tokens,
		Title: "Match en direct",
		Body:  fmt.Sprintf("%s vient de commencer !", name),
		Sound: "default",
		Data: map[string]interface{}{
			"type":         "match_start",
			"match_id":     sub.MatchID,
			"game_acronym": sub.GameAcronym,
		},
	}, true
}

// cleanupStaleSubscriptions deletes subscriptions whose underlying match or
// tournament has been finished for more than staleFinishedThreshold.
func (s *NotificationScheduler) cleanupStaleSubscriptions(ctx context.Context) {
	db := s.getDB()
	threshold := time.Now().Add(-staleFinishedThreshold)

	result := db.WithContext(ctx).
		Where("status IN ? AND created_at < ?", []string{"finished", "canceled"}, threshold).
		Delete(&models.MatchSubscription{})
	if result.Error != nil {
		s.logger.Errorf("[NotifScheduler] Cleanup match subs error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		s.logger.Infof("[NotifScheduler] Cleaned up %d stale match subscriptions", result.RowsAffected)
	}

	result = db.WithContext(ctx).
		Where("status = ? AND end_at < ?", "finished", threshold).
		Delete(&models.TournamentSubscription{})
	if result.Error != nil {
		s.logger.Errorf("[NotifScheduler] Cleanup tournament subs error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		s.logger.Infof("[NotifScheduler] Cleaned up %d stale tournament subscriptions", result.RowsAffected)
	}
}

// hydrateTournamentMatches makes sure every user subscribed to a tournament
// also has a match subscription for each known match in that tournament.
// Missing match subscriptions are created with the current begin_at value;
// subsequent reschedules are caught by processMatchNotifications.
func (s *NotificationScheduler) hydrateTournamentMatches(ctx context.Context) {
	db := s.getDB()

	var tournamentSubs []models.TournamentSubscription
	if err := db.WithContext(ctx).
		Where("status IN ?", []string{"running", "upcoming"}).
		Find(&tournamentSubs).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch tournament subs: %v", err)
		return
	}

	// Cache the fetched match list once per tournament so multiple subscribers
	// to the same tournament don't each trigger their own lookup.
	matchesByTournament := make(map[int64][]models.NormalizedMatch, len(tournamentSubs))

	for _, ts := range tournamentSubs {
		matches, ok := matchesByTournament[ts.TournamentID]
		if !ok {
			fetched, err := s.liqService.TournamentMatches(ctx, ts.GameAcronym, ts.TournamentID)
			if err != nil {
				if !errors.Is(err, ErrUnknownGame) {
					s.logger.WithError(err).WithFields(logrus.Fields{
						"game":          ts.GameAcronym,
						"tournament_id": ts.TournamentID,
					}).Warn("[NotifScheduler] Failed to fetch tournament matches")
				}
				matchesByTournament[ts.TournamentID] = nil
				continue
			}
			matches = fetched
			matchesByTournament[ts.TournamentID] = fetched
		}

		for _, match := range matches {
			matchID := int64(match.ID)
			if matchID == 0 {
				continue
			}

			var count int64
			if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
				Where("user_id = ? AND match_id = ?", ts.UserID, matchID).
				Count(&count).Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to count match subs for user %d match %d: %v", ts.UserID, matchID, err)
				continue
			}
			if count > 0 {
				continue
			}

			matchSub := models.MatchSubscription{
				UserID:         ts.UserID,
				MatchID:        matchID,
				GameAcronym:    ts.GameAcronym,
				MatchName:      match.Name,
				TournamentName: ts.TournamentName,
				BeginAt:        matchBeginsAt(match),
				Status:         "upcoming",
				FromTournament: &ts.TournamentID,
			}
			if err := db.WithContext(ctx).Create(&matchSub).Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to create match sub for user %d match %d: %v", ts.UserID, matchID, err)
			}
		}
	}
}

// --- Helpers ---

type subUpdate struct {
	id     int64
	fields map[string]interface{}
}

// matchBeginsAt parses the RFC3339 begin_at field of a normalized match into
// a *time.Time, returning nil on missing/invalid values.
func matchBeginsAt(m models.NormalizedMatch) *time.Time {
	return parseRFC3339Pointer(m.BeginAt)
}

func parseRFC3339Pointer(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil
	}
	return &t
}

// getUserPushTokens returns the active push tokens for a user.
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

// userWantsMatchNotifs returns true when the user has both push and match
// notifications enabled in their preferences.
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

// deactivateTokens flips active=false on the given push tokens, typically in
// response to Expo reporting them as invalid.
func (s *NotificationScheduler) deactivateTokens(ctx context.Context, tokens []string) {
	db := s.getDB()
	if err := db.WithContext(ctx).Model(&models.PushToken{}).
		Where("token IN ?", tokens).
		Update("active", false).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to deactivate tokens: %v", err)
	}
}
