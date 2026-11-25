package services

import (
	"context"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

func TestSeenThrottleLetsOneStampThroughPerWindow(t *testing.T) {
	var throttle seenThrottle
	start := time.Now()

	assert.True(t, throttle.due(7, start))
	assert.False(t, throttle.due(7, start.Add(lastSeenEvery-time.Second)))
	assert.True(t, throttle.due(8, start), "another user has its own window")
	assert.True(t, throttle.due(7, start.Add(lastSeenEvery)))
	assert.False(t, throttle.due(7, start.Add(lastSeenEvery+time.Minute)))
}

func TestSeenThrottleForgetsStaleUsersWhenFull(t *testing.T) {
	var throttle seenThrottle
	start := time.Now()
	for id := int64(1); id <= seenThrottleMaxEntries; id++ {
		throttle.due(id, start)
	}
	require.Len(t, throttle.last, seenThrottleMaxEntries)

	assert.True(t, throttle.due(seenThrottleMaxEntries+1, start.Add(lastSeenEvery)))
	assert.Len(t, throttle.last, 1)
}

// accountTestDB is the schema the account paths need: the legacy tables plus
// the columns and the tombstone table the back-office adds at boot.
func accountTestDB(t *testing.T) *gorm.DB {
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(
		&models.User{}, &models.PushToken{}, &models.MatchSubscription{}, &models.TournamentSubscription{}, &models.Notification{}))
	for _, stmt := range []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_gifted boolean NOT NULL DEFAULT false`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source text`,
		`CREATE TABLE IF NOT EXISTS bo_deleted_account (
			id bigserial PRIMARY KEY, user_id bigint NOT NULL, registered_at timestamptz,
			deleted_at timestamptz NOT NULL DEFAULT now(), deleted_by text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '')`,
	} {
		require.NoError(t, db.Exec(stmt).Error)
	}
	return db
}

func accountTestUser(t *testing.T, db *gorm.DB, email string) *models.User {
	require.NoError(t, db.Exec("DELETE FROM users WHERE email = ?", email).Error)
	user := &models.User{Name: "Compte de test", Email: email, Password: "x"}
	require.NoError(t, db.Create(user).Error)
	t.Cleanup(func() {
		db.Exec("DELETE FROM users WHERE id = ?", user.ID)
		db.Exec("DELETE FROM bo_deleted_account WHERE user_id = ?", user.ID)
	})
	return user
}

func premiumOf(t *testing.T, db *gorm.DB, userID int64) bool {
	var premium bool
	require.NoError(t, db.Raw("SELECT COALESCE(premium, false) FROM users WHERE id = ?", userID).Scan(&premium).Error)
	return premium
}

// Every purchase path that can take Premium away, on a gifted account and on
// an ordinary one. The Apple notification writes through the same expression;
// it needs a signed payload and isn't driven here.
func TestStoreVerdictsNeverRemoveAGiftedPremium(t *testing.T) {
	db := accountTestDB(t)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	iap := &IAPService{db: db, logger: logger}
	stripeSvc := &StripeService{db: db}
	ctx := context.Background()

	downgrades := map[string]func(u *models.User) error{
		"iap validation (app, daily scheduler)": func(u *models.User) error {
			return iap.UpdateUserIAPStatus(ctx, u.ID, &IAPValidationResult{IsValid: false, Platform: "ios", TransactionID: "tx-" + u.Email})
		},
		"google terminal notification": func(u *models.User) error {
			require.NoError(t, db.Exec("UPDATE users SET iap_transaction_id = ? WHERE id = ?", "token-"+u.Email, u.ID).Error)
			return iap.setGoogleUserPremium(ctx, "token-"+u.Email, false)
		},
		"stripe subscription update": func(u *models.User) error {
			return stripeSvc.UpdateUserSubscriptionStatus(ctx, u.ID, map[string]interface{}{"premium": false, "subscription_status": "canceled"})
		},
		"stripe premium flag": func(u *models.User) error {
			return stripeSvc.SetUserPremium(ctx, u.ID, false)
		},
	}

	for name, downgrade := range downgrades {
		t.Run(name, func(t *testing.T) {
			gifted := accountTestUser(t, db, "gifted@premium-guard.test")
			plain := accountTestUser(t, db, "plain@premium-guard.test")
			require.NoError(t, db.Exec("UPDATE users SET premium = true, premium_gifted = true WHERE id = ?", gifted.ID).Error)
			require.NoError(t, db.Exec("UPDATE users SET premium = true WHERE id = ?", plain.ID).Error)

			require.NoError(t, downgrade(gifted))
			require.NoError(t, downgrade(plain))

			assert.True(t, premiumOf(t, db, gifted.ID), "a gifted account keeps Premium")
			assert.False(t, premiumOf(t, db, plain.ID), "an ordinary account loses it")
		})
	}
}

func TestStoreVerdictStillGrantsPremium(t *testing.T) {
	db := accountTestDB(t)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	iap := &IAPService{db: db, logger: logger}
	user := accountTestUser(t, db, "buyer@premium-guard.test")

	expires := time.Now().Add(30 * 24 * time.Hour)
	require.NoError(t, iap.UpdateUserIAPStatus(context.Background(), user.ID,
		&IAPValidationResult{IsValid: true, Platform: "ios", TransactionID: "tx-buyer", ExpiresAt: expires}))

	assert.True(t, premiumOf(t, db, user.ID))
}

func TestStripeUpdateLeavesTheCallersMapAlone(t *testing.T) {
	db := accountTestDB(t)
	user := accountTestUser(t, db, "map@premium-guard.test")
	updates := map[string]interface{}{"premium": false}

	require.NoError(t, (&StripeService{db: db}).UpdateUserSubscriptionStatus(context.Background(), user.ID, updates))

	assert.Equal(t, false, updates["premium"])
}

func TestPurgeAccountDeletesEverythingAndLeavesATombstone(t *testing.T) {
	db := accountTestDB(t)
	mr := miniredis.RunT(t)
	svc := NewAuthServiceWithGORM(&database.Database{DB: db}, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	ctx := context.Background()

	user := accountTestUser(t, db, "purge@account.test")
	other := accountTestUser(t, db, "other@account.test")
	for _, id := range []int64{user.ID, other.ID} {
		token := fmt.Sprintf("ExponentPushToken[purge-%d-%d]", id, time.Now().UnixNano())
		require.NoError(t, db.Create(&models.PushToken{UserID: id, Token: token, Platform: "ios", Active: true}).Error)
		require.NoError(t, db.Create(&models.MatchSubscription{UserID: id, MatchID: 1, Match2ID: "purgeAAAAA_0001", Status: "upcoming"}).Error)
		require.NoError(t, db.Create(&models.TournamentSubscription{UserID: id, TournamentID: 990000 + id, Status: "running"}).Error)
	}
	t.Cleanup(func() {
		for _, table := range []string{"push_token", "match_subscription", "tournament_subscription"} {
			db.Exec("DELETE FROM "+table+" WHERE user_id IN ?", []int64{user.ID, other.ID})
		}
	})
	session, err := svc.LoginAfterSignup(ctx, user)
	require.NoError(t, err)

	require.NoError(t, svc.PurgeAccount(ctx, user.ID, "Une administratrice", "demande de la personne"))

	count := func(table string, userID int64) int64 {
		var n int64
		require.NoError(t, db.Raw("SELECT count(*) FROM "+table+" WHERE user_id = ?", userID).Scan(&n).Error)
		return n
	}
	for _, table := range []string{"push_token", "match_subscription", "tournament_subscription"} {
		assert.Zero(t, count(table, user.ID), table)
		assert.Equal(t, int64(1), count(table, other.ID), "%s of another account", table)
	}
	_, err = svc.GetUser(ctx, user.ID)
	assert.ErrorIs(t, err, ErrUserNotFound)
	_, err = svc.VerifyToken(session.AccessToken)
	assert.ErrorIs(t, err, ErrSessionRevoked)

	var tombstone struct {
		RegisteredAt *time.Time
		DeletedBy    string
		Reason       string
	}
	require.NoError(t, db.Raw("SELECT registered_at, deleted_by, reason FROM bo_deleted_account WHERE user_id = ?", user.ID).Scan(&tombstone).Error)
	assert.Equal(t, "Une administratrice", tombstone.DeletedBy)
	assert.Equal(t, "demande de la personne", tombstone.Reason)
	require.NotNil(t, tombstone.RegisteredAt)
	assert.WithinDuration(t, user.CreatedAt, *tombstone.RegisteredAt, time.Second)

	assert.ErrorIs(t, svc.PurgeAccount(ctx, user.ID, DeletedBySelf, ""), ErrUserNotFound)
}

func TestSelfServiceDeletionLeavesATombstone(t *testing.T) {
	db := accountTestDB(t)
	mr := miniredis.RunT(t)
	svc := NewAuthServiceWithGORM(&database.Database{DB: db}, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	ctx := context.Background()
	const email = "self-delete@account.test"
	require.NoError(t, db.Exec("DELETE FROM users WHERE email = ?", email).Error)
	user, err := svc.Signup(ctx, &models.CreateUserInput{Name: "Compte de test", Email: email, Password: "SecurePass123"})
	require.NoError(t, err)
	t.Cleanup(func() {
		db.Exec("DELETE FROM users WHERE id = ?", user.ID)
		db.Exec("DELETE FROM bo_deleted_account WHERE user_id = ?", user.ID)
	})

	require.Error(t, svc.DeleteAccount(ctx, user.ID, "wrong-password"))
	require.NoError(t, svc.DeleteAccount(ctx, user.ID, "SecurePass123"))

	var deletedBy string
	require.NoError(t, db.Raw("SELECT deleted_by FROM bo_deleted_account WHERE user_id = ?", user.ID).Scan(&deletedBy).Error)
	assert.Equal(t, DeletedBySelf, deletedBy)
}

func TestLastSeenAndSignupSourceAreStamped(t *testing.T) {
	db := accountTestDB(t)
	mr := miniredis.RunT(t)
	svc := NewAuthServiceWithGORM(&database.Database{DB: db}, cache.NewRedisClient("redis://"+mr.Addr()), "test-secret")
	user := accountTestUser(t, db, "seen@account.test")

	read := func() (source *string, seen *time.Time) {
		var row struct {
			SignupSource *string
			LastSeenAt   *time.Time
		}
		require.NoError(t, db.Raw("SELECT signup_source, last_seen_at FROM users WHERE id = ?", user.ID).Scan(&row).Error)
		return row.SignupSource, row.LastSeenAt
	}

	svc.RecordSignup(user.ID, "android")
	require.Eventually(t, func() bool { _, seen := read(); return seen != nil }, 3*time.Second, 20*time.Millisecond)
	source, first := read()
	require.NotNil(t, source)
	assert.Equal(t, "android", *source)

	// Inside the window: no second write.
	svc.TouchLastSeen(user.ID)
	time.Sleep(150 * time.Millisecond)
	_, second := read()
	assert.Equal(t, first.UnixNano(), second.UnixNano())
}
