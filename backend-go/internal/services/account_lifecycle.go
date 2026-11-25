package services

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// lastSeenEvery bounds the writes of users.last_seen_at: one per user and per
// window, however many requests the account sends.
const lastSeenEvery = 10 * time.Minute

// seenThrottle remembers, per process, when each user was last stamped.
type seenThrottle struct {
	mu   sync.Mutex
	last map[int64]time.Time
}

const seenThrottleMaxEntries = 50_000

func (t *seenThrottle) due(userID int64, now time.Time) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.last == nil {
		t.last = make(map[int64]time.Time)
	}
	if at, ok := t.last[userID]; ok && now.Sub(at) < lastSeenEvery {
		return false
	}
	if len(t.last) >= seenThrottleMaxEntries {
		for id, at := range t.last {
			if now.Sub(at) >= lastSeenEvery {
				delete(t.last, id)
			}
		}
	}
	t.last[userID] = now
	return true
}

// TouchLastSeen stamps users.last_seen_at off the request path: it never slows
// a request down and never fails one.
func (s *AuthService) TouchLastSeen(userID int64) {
	if s.gormDB == nil || userID <= 0 || !s.lastSeen.due(userID, time.Now()) {
		return
	}
	go s.stampAccount(userID, "UPDATE users SET last_seen_at = now() WHERE id = ?", userID)
}

// RecordSignup notes where a new account was created (ios, android, web; empty
// when the request doesn't say) and counts the signup as a first visit.
func (s *AuthService) RecordSignup(userID int64, source string) {
	if s.gormDB == nil || userID <= 0 {
		return
	}
	s.lastSeen.due(userID, time.Now())
	go s.stampAccount(userID, "UPDATE users SET signup_source = NULLIF(?, ''), last_seen_at = now() WHERE id = ?", source, userID)
}

func (s *AuthService) stampAccount(userID int64, query string, args ...interface{}) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.gormDB.WithContext(ctx).Exec(query, args...).Error; err != nil {
		logrus.Debugf("account stamp skipped (user %d): %v", userID, err)
	}
}

// Tables holding rows that belong to one account and nothing worth keeping
// once it is gone.
var accountTables = []string{
	"push_token", "match_subscription", "tournament_subscription", "notifications",
	"bo_totp", "bo_backup_code", "bo_trusted_device",
}

const deletedAccountTable = "bo_deleted_account"

// DeletedBySelf marks a tombstone left by the account's owner.
const DeletedBySelf = "self"

// PurgeAccount deletes an account with its devices and subscriptions, leaves a
// tombstone carrying no personal data, and signs every device out. deletedBy is
// DeletedBySelf or the name of the team member who did it.
func (s *AuthService) PurgeAccount(ctx context.Context, userID int64, deletedBy, reason string) error {
	if s.gormDB == nil {
		return errors.New("account purge needs the GORM handle")
	}
	err := s.gormDB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var account struct{ CreatedAt *time.Time }
		found := tx.Raw("SELECT created_at FROM users WHERE id = ? FOR UPDATE", userID).Scan(&account)
		if found.Error != nil {
			return found.Error
		}
		if found.RowsAffected == 0 {
			return ErrUserNotFound
		}

		// Some of these tables come from migrations a database may not have
		// (integration tests build the bare minimum): a statement on a missing
		// table would abort the whole transaction.
		var present []string
		candidates := append([]string{deletedAccountTable}, accountTables...)
		if err := tx.Raw("SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename IN ?", candidates).
			Scan(&present).Error; err != nil {
			return err
		}
		exists := make(map[string]bool, len(present))
		for _, name := range present {
			exists[name] = true
		}

		for _, table := range accountTables {
			if !exists[table] {
				continue
			}
			if err := tx.Exec("DELETE FROM "+table+" WHERE user_id = ?", userID).Error; err != nil {
				return fmt.Errorf("purge %s: %w", table, err)
			}
		}
		if err := tx.Exec("DELETE FROM users WHERE id = ?", userID).Error; err != nil {
			return fmt.Errorf("delete user: %w", err)
		}
		if exists[deletedAccountTable] {
			if err := tx.Exec(
				"INSERT INTO "+deletedAccountTable+" (user_id, registered_at, deleted_by, reason) VALUES (?, ?, ?, ?)",
				userID, account.CreatedAt, deletedBy, reason).Error; err != nil {
				return fmt.Errorf("tombstone: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.revokeAllSessionsOrLog(ctx, userID)
	return nil
}

// premiumUnlessGifted is what a store or Stripe verdict writes into
// users.premium: an account the team gifted Premium to keeps it whatever the
// stores answer. Every write of that column from a purchase goes through here.
func premiumUnlessGifted(premium bool) clause.Expr {
	return gorm.Expr("(? OR premium_gifted)", premium)
}
