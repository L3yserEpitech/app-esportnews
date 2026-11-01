package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
	// Past this lateness, a due subscription is marked as notified without
	// sending: a scheduler restart or a backfill must never fire a burst of
	// "starts now" pushes for matches that began hours ago.
	maxStartNotifLateness = 3 * time.Hour
	// Same horizon as the poller's running query: a match unfinished on Liquipedia
	// this long after its start is out of every cache and will never be seen again.
	matchAbandonedAfter = 24 * time.Hour
	// Margin past a tournament's end_at before hydration may close it.
	tournamentEndGrace = 48 * time.Hour
	// Backstops for the tournaments hydration can't close: unknown wiki (inherited
	// from PandaScore), repeated upstream failures, no end date.
	tournamentHardCapAfterEnd   = 30 * 24 * time.Hour
	tournamentHardCapWithoutEnd = 90 * 24 * time.Hour
	// A like without a match date (never set by current clients) can't age out by date.
	matchHardCapWithoutDate = 30 * 24 * time.Hour
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
	ctx = BackgroundLane(ctx)
	s.logger.Info("[NotifScheduler] Starting notification scheduler")

	mainTicker := time.NewTicker(schedulerTickInterval)
	cleanupTicker := time.NewTicker(cleanupTickInterval)
	hydrationTicker := time.NewTicker(hydrationTickInterval)
	favTeamTicker := time.NewTicker(hydrationTickInterval)

	defer mainTicker.Stop()
	defer cleanupTicker.Stop()
	defer hydrationTicker.Stop()
	defer favTeamTicker.Stop()

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
		case <-favTeamTicker.C:
			s.hydrateFavoriteTeamMatches(ctx)
		}
	}
}

// processMatchNotifications walks active match subscriptions and dispatches a
// "match starts now" push, either when the scheduled kick-off time is reached
// or when the match shows up live in the Liquipedia running cache — whichever
// comes first. Reschedules (begin_at drift) are persisted back to the row.
func (s *NotificationScheduler) processMatchNotifications(ctx context.Context) {
	db := s.getDB()

	var subs []models.MatchSubscription
	// A row with neither date nor match2id (old auto-subscriptions) can never fire.
	// Earliest first: rows for future matches must not push due ones past the limit.
	if err := db.WithContext(ctx).
		Where("status IN ? AND notified_start = ?", []string{"upcoming", "running"}, false).
		Where("begin_at IS NOT NULL OR COALESCE(match2_id, '') <> ''").
		Order("begin_at ASC NULLS LAST").
		Limit(maxSubsPerTick).
		Find(&subs).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch subscriptions: %v", err)
		return
	}

	if len(subs) == 0 {
		return
	}

	now := time.Now()
	var (
		messages     []ExpoPushMessage
		subsToUpdate []subUpdate
		waiting      []models.MatchSubscription
	)

	// Primary trigger: the scheduled kick-off time is reached. Purely time-based
	// so the push lands on time instead of waiting for the poller to flip the
	// match to running in Redis (up to 8 min later).
	for _, sub := range subs {
		if sub.BeginAt == nil || sub.BeginAt.After(now) {
			waiting = append(waiting, sub)
			continue
		}

		if now.Sub(*sub.BeginAt) <= maxStartNotifLateness {
			if msg, ok := s.buildStartNotification(ctx, sub, matchLabelFromName(sub.MatchName), sub.Match2ID); ok {
				messages = append(messages, msg)
			}
		}
		subsToUpdate = append(subsToUpdate, subUpdate{
			id: sub.ID,
			fields: map[string]interface{}{
				"notified_start": true,
				"status":         "running",
			},
		})
	}

	if len(waiting) == 0 {
		s.dispatch(ctx, messages, subsToUpdate)
		return
	}

	// Safety net: matches already live ahead of their announced time, or without
	// a known begin_at. Also the only place begin_at drift gets persisted.
	// Batch Redis lookups by game so we only build the running map once per game.
	subsByGame := make(map[string][]models.MatchSubscription, len(waiting))
	for _, sub := range waiting {
		subsByGame[sub.GameAcronym] = append(subsByGame[sub.GameAcronym], sub)
	}

	for gameAcronym, gameSubs := range subsByGame {
		runningMap, err := s.runningMatchesByMatch2ID(ctx, gameAcronym)
		if err != nil {
			s.logger.WithError(err).WithField("game", gameAcronym).
				Warn("[NotifScheduler] Skipping game — failed to load running matches")
			continue
		}

		for _, sub := range gameSubs {
			match, inCache := runningMap[sub.Match2ID]
			if !inCache {
				continue
			}

			fields := map[string]interface{}{}
			newBeginAt := matchBeginsAt(match)
			if newBeginAt != nil && sub.BeginAt != nil && !newBeginAt.Equal(*sub.BeginAt) {
				fields["begin_at"] = newBeginAt
			}

			// The running cache reaches 6 h ahead (poller cutoff): being listed
			// doesn't mean the match has started.
			if newBeginAt != nil && newBeginAt.After(now) {
				if len(fields) > 0 {
					subsToUpdate = append(subsToUpdate, subUpdate{id: sub.ID, fields: fields})
				}
				continue
			}

			fields["notified_start"] = true
			fields["status"] = "running"
			if msg, ok := s.buildStartNotification(ctx, sub, matchLabel(match, sub.MatchName), sub.Match2ID); ok {
				messages = append(messages, msg)
			}
			subsToUpdate = append(subsToUpdate, subUpdate{id: sub.ID, fields: fields})
		}
	}

	s.dispatch(ctx, messages, subsToUpdate)
}

// dispatch sends the batch and persists the subscription updates.
func (s *NotificationScheduler) dispatch(ctx context.Context, messages []ExpoPushMessage, subsToUpdate []subUpdate) {
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

	db := s.getDB()
	for _, upd := range subsToUpdate {
		if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
			Where("id = ?", upd.id).
			Updates(upd.fields).Error; err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to update subscription %d: %v", upd.id, err)
		}
	}
}

// runningMatchesByMatch2ID returns the matches of the running cache for a game,
// keyed by match2id: their numeric id is shared by the whole tournament page.
func (s *NotificationScheduler) runningMatchesByMatch2ID(ctx context.Context, gameAcronym string) (map[string]models.NormalizedMatch, error) {
	matches, err := s.liqService.MatchesByStatus(ctx, gameAcronym, MatchStatusRunning)
	if err != nil {
		if errors.Is(err, ErrUnknownGame) {
			// Stale acronym (e.g. legacy PandaScore data) — treat as empty, never crash.
			s.logger.WithField("game", gameAcronym).Debug("[NotifScheduler] Skipping unknown game")
			return map[string]models.NormalizedMatch{}, nil
		}
		return nil, err
	}

	indexed := make(map[string]models.NormalizedMatch, len(matches))
	for _, m := range matches {
		if m.Match2ID != "" {
			indexed[m.Match2ID] = m
		}
	}
	return indexed, nil
}

// buildStartNotification returns the ExpoPushMessage to send for a match that
// is starting. The second return value is false when the user has no active
// push token. Preference gating is intentionally disabled: any subscriber with
// a token gets the match-start notification.
func (s *NotificationScheduler) buildStartNotification(ctx context.Context, sub models.MatchSubscription, label, match2ID string) (ExpoPushMessage, bool) {
	tokens := s.getUserPushTokens(ctx, sub.UserID)
	if len(tokens) == 0 {
		return ExpoPushMessage{}, false
	}

	body := "Le match commence maintenant !"
	if label != "" {
		body = fmt.Sprintf("%s commence maintenant !", label)
	}

	// wiki + match2id let the app open the exact match page: the detail endpoint
	// only resolves an alphanumeric match2id on-demand, a numeric id falls back
	// to a 10-wiki cache scan and 404s once the match leaves the poller caches.
	wiki, _ := models.ResolveWiki(sub.GameAcronym)

	return ExpoPushMessage{
		To:        tokens,
		Title:     "Match en direct",
		Body:      body,
		Sound:     "default",
		Priority:  "high",         // APNs priority 10 (iOS) + FCM high priority (Android)
		ChannelId: "match-alerts", // Android-only: routes to the HIGH-importance channel for heads-up
		Data: map[string]interface{}{
			"type":         "match_start",
			"match_id":     sub.MatchID,
			"m2":           match2ID,
			"wiki":         wiki,
			"game_acronym": sub.GameAcronym,
		},
	}, true
}

// matchLabel builds a concise "Équipe A contre Équipe B" label.
// Prefers the two opponent team names from the live match; falls back to the
// stored match name.
func matchLabel(m models.NormalizedMatch, fallback string) string {
	var names []string
	for _, o := range m.Opponents {
		if o.Opponent != nil {
			if n := strings.TrimSpace(o.Opponent.Name); n != "" {
				names = append(names, n)
			}
		}
	}
	if len(names) >= 2 {
		return fmt.Sprintf("%s contre %s", names[0], names[1])
	}

	if strings.TrimSpace(fallback) == "" {
		return matchLabelFromName(m.Name)
	}
	return matchLabelFromName(fallback)
}

// namedOpponents returns the opponent names, without bracket placeholders.
func namedOpponents(m models.NormalizedMatch) []string {
	var names []string
	for _, o := range m.Opponents {
		if o.Opponent == nil || o.Type == "literal" {
			continue
		}
		if n := strings.TrimSpace(o.Opponent.Name); n != "" && n != "TBD" {
			names = append(names, n)
		}
	}
	return names
}

// subscriptionMatchName is the name stored on an auto-created subscription. The
// normalized match name is often the tournament's, useless in a push body.
func subscriptionMatchName(m models.NormalizedMatch) string {
	if names := namedOpponents(m); len(names) >= 2 {
		return names[0] + " vs " + names[1]
	}
	return m.Name
}

// matchLabelFromName normalizes a stored match name ("A vs B") into the label
// used in notification bodies.
func matchLabelFromName(name string) string {
	label := strings.TrimSpace(name)
	label = strings.ReplaceAll(label, " vs ", " contre ")
	label = strings.ReplaceAll(label, " VS ", " contre ")
	return label
}

// cleanupStaleSubscriptions deletes subscriptions whose underlying match or
// tournament has been finished for more than staleFinishedThreshold.
func (s *NotificationScheduler) cleanupStaleSubscriptions(ctx context.Context) {
	s.finishEndedSubscriptions(ctx)

	db := s.getDB()
	threshold := time.Now().Add(-staleFinishedThreshold)

	result := db.WithContext(ctx).
		Where("status IN ? AND COALESCE(begin_at, created_at) < ?", []string{"finished", "canceled"}, threshold).
		Delete(&models.MatchSubscription{})
	if result.Error != nil {
		s.logger.Errorf("[NotifScheduler] Cleanup match subs error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		s.logger.Infof("[NotifScheduler] Cleaned up %d stale match subscriptions", result.RowsAffected)
	}

	result = db.WithContext(ctx).
		Where("status = ? AND COALESCE(end_at, begin_at, created_at) < ?", "finished", threshold).
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
	now := time.Now().UTC()

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

		// nil = the fetch failed for an earlier subscriber: that says nothing.
		if matches != nil && tournamentIsOver(ts, matches, now) {
			if err := db.WithContext(ctx).Model(&models.TournamentSubscription{}).
				Where("id = ?", ts.ID).
				Update("status", "finished").Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to close tournament sub %d: %v", ts.ID, err)
			}
			continue
		}

		for _, match := range matches {
			if !hydratableTournamentMatch(match, now) {
				continue
			}

			var count int64
			if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
				Where("user_id = ? AND match2_id = ?", ts.UserID, match.Match2ID).
				Count(&count).Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to count match subs for user %d match %s: %v", ts.UserID, match.Match2ID, err)
				continue
			}
			if count > 0 {
				continue
			}

			matchSub := models.MatchSubscription{
				UserID:         ts.UserID,
				MatchID:        int64(match.ID),
				Match2ID:       match.Match2ID,
				GameAcronym:    ts.GameAcronym,
				MatchName:      subscriptionMatchName(match),
				TournamentName: ts.TournamentName,
				BeginAt:        matchBeginsAt(match),
				Status:         "upcoming",
				FromTournament: &ts.TournamentID,
			}
			if err := db.WithContext(ctx).Create(&matchSub).Error; err != nil {
				s.logger.Errorf("[NotifScheduler] Failed to create match sub for user %d match %s: %v", ts.UserID, match.Match2ID, err)
			}
		}
	}
}

// finishEndedSubscriptions closes the subscriptions whose match is over, from the
// poller's past cache (no Liquipedia call) or by age. Without it nothing ever left
// "running": the profile showed old matches as live, the purge deleted nothing and
// the free allowance filled up for good.
func (s *NotificationScheduler) finishEndedSubscriptions(ctx context.Context) {
	db := s.getDB()
	now := time.Now().UTC()
	active := []string{"upcoming", "running"}

	if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
		Where("status IN ?", active).
		Where("begin_at < ? OR (begin_at IS NULL AND created_at < ?)", now.Add(-matchAbandonedAfter), now.Add(-matchHardCapWithoutDate)).
		Update("status", "finished").Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to close abandoned match subs: %v", err)
	}

	var started []models.MatchSubscription
	if err := db.WithContext(ctx).
		Where("status IN ? AND COALESCE(match2_id, '') <> ''", active).
		Where("begin_at IS NULL OR begin_at <= ?", now).
		Find(&started).Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to fetch started match subs: %v", err)
	}
	subsByGame := make(map[string][]models.MatchSubscription)
	for _, sub := range started {
		subsByGame[sub.GameAcronym] = append(subsByGame[sub.GameAcronym], sub)
	}
	for gameAcronym, gameSubs := range subsByGame {
		past, err := s.liqService.MatchesByStatus(ctx, gameAcronym, MatchStatusPast)
		if err != nil {
			continue // unknown game: the age rule above takes care of it
		}
		finished := make(map[string]bool, len(past))
		for _, m := range past {
			finished[m.Match2ID] = true
		}
		var ids []int64
		for _, sub := range gameSubs {
			if finished[sub.Match2ID] {
				ids = append(ids, sub.ID)
			}
		}
		if len(ids) == 0 {
			continue
		}
		if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
			Where("id IN ?", ids).
			Update("status", "finished").Error; err != nil {
			s.logger.Errorf("[NotifScheduler] Failed to close finished match subs: %v", err)
		}
	}

	if err := db.WithContext(ctx).Model(&models.TournamentSubscription{}).
		Where("status IN ?", active).
		Where("end_at < ? OR (end_at IS NULL AND COALESCE(begin_at, created_at) < ?)",
			now.Add(-tournamentHardCapAfterEnd), now.Add(-tournamentHardCapWithoutEnd)).
		Update("status", "finished").Error; err != nil {
		s.logger.Errorf("[NotifScheduler] Failed to close old tournament subs: %v", err)
	}
}

// tournamentIsOver tells whether nothing is left to alert on. end_at is a snapshot
// taken at subscription time: the tournament may have been extended since, so its
// matches have the last word.
func tournamentIsOver(ts models.TournamentSubscription, matches []models.NormalizedMatch, now time.Time) bool {
	if ts.EndAt == nil || ts.EndAt.After(now.Add(-tournamentEndGrace)) {
		return false
	}
	for _, m := range matches {
		if beginAt := matchBeginsAt(m); beginAt != nil && beginAt.After(now) {
			return false
		}
	}
	return true
}

// hydratableTournamentMatch keeps the matches a tournament subscriber should be
// alerted for. Hydration runs again every 10 min, so a match left out now is
// picked up as soon as its date and opponents are known. A match that already
// began stays out: creating its row would fire a late "starts now" push.
func hydratableTournamentMatch(m models.NormalizedMatch, now time.Time) bool {
	if m.Match2ID == "" || !m.DateExact || len(namedOpponents(m)) < 2 {
		return false
	}
	beginAt := matchBeginsAt(m)
	return beginAt != nil && beginAt.After(now)
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
