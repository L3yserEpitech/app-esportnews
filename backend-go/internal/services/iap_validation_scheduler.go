package services

import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

const (
	// How often the scheduler wakes up. We check once a day because Apple's
	// sandbox expires subscriptions quickly (minutes) but production flips
	// happen in day increments.
	iapValidationTickInterval = 24 * time.Hour

	// We re-validate any subscription that is already expired OR expiring
	// within this window — catches users we missed via webhook (Apple hiccup,
	// network issues, etc.) and keeps expires_at in sync for the UI.
	iapRevalidationWindow = 48 * time.Hour

	// Safety: never revalidate more than this per tick. Prevents a cascading
	// outage if Apple starts returning slow 5xx responses.
	maxIAPRevalidationsPerTick = 500
)

// IAPValidationScheduler periodically re-validates every user's IAP receipt
// with Apple/Google to ensure the `premium` flag and `iap_expires_at` stay in
// sync even if the mobile app never triggers a manual "Restore purchases" and
// the Apple Server Notification webhook fails (network issues, etc.).
type IAPValidationScheduler struct {
	gormDB     interface{}
	iapService *IAPService
	logger     *logrus.Logger
}

func NewIAPValidationScheduler(gormDB interface{}, iapService *IAPService, logger *logrus.Logger) *IAPValidationScheduler {
	return &IAPValidationScheduler{
		gormDB:     gormDB,
		iapService: iapService,
		logger:     logger,
	}
}

func (s *IAPValidationScheduler) getDB() *gorm.DB {
	switch v := s.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}

// Start runs the scheduler in a goroutine. Blocks until the context is canceled.
// A first tick runs shortly after startup so operators can validate it works
// without waiting 24h.
func (s *IAPValidationScheduler) Start(ctx context.Context) {
	s.logger.Info("[IAPScheduler] Starting IAP validation scheduler")

	// Run once shortly after boot (5 min delay so HTTP server and DB are warm).
	warmup := time.NewTimer(5 * time.Minute)
	defer warmup.Stop()

	ticker := time.NewTicker(iapValidationTickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("[IAPScheduler] Stopping IAP validation scheduler")
			return
		case <-warmup.C:
			s.revalidateExpiringSubs(ctx)
		case <-ticker.C:
			s.revalidateExpiringSubs(ctx)
		}
	}
}

// revalidateExpiringSubs finds users whose IAP subscription is either already
// past its expiration OR is expiring soon, and re-validates with Apple/Google.
// The resulting premium flip is written via iapService.UpdateUserIAPStatus.
func (s *IAPValidationScheduler) revalidateExpiringSubs(ctx context.Context) {
	db := s.getDB()
	cutoff := time.Now().Add(iapRevalidationWindow)

	var users []models.User
	err := db.WithContext(ctx).
		Where("iap_platform IS NOT NULL").
		Where("iap_expires_at IS NOT NULL").
		Where("iap_expires_at <= ?", cutoff).
		Limit(maxIAPRevalidationsPerTick).
		Find(&users).Error
	if err != nil {
		s.logger.Errorf("[IAPScheduler] Failed to load users: %v", err)
		return
	}

	if len(users) == 0 {
		s.logger.Debug("[IAPScheduler] No IAP subscriptions due for revalidation")
		return
	}

	s.logger.Infof("[IAPScheduler] Revalidating %d IAP subscription(s)", len(users))

	var successCount, failCount int
	for _, u := range users {
		// Respect cancellation.
		if ctx.Err() != nil {
			return
		}
		if err := s.revalidateOne(ctx, &u); err != nil {
			failCount++
			s.logger.Warnf("[IAPScheduler] User %d revalidation failed: %v", u.ID, err)
			continue
		}
		successCount++
	}

	s.logger.Infof("[IAPScheduler] Done — ok=%d fail=%d", successCount, failCount)
}

// revalidateOne re-validates a single user. Chooses the right platform based
// on iap_platform and only touches ios for now (Google Play revalidation
// requires the purchase token which we don't persist).
func (s *IAPValidationScheduler) revalidateOne(ctx context.Context, u *models.User) error {
	platform := derefString(u.IAPPlatform)
	switch platform {
	case "ios":
		// Use the ORIGINAL transaction id if present — it's the stable anchor
		// that Apple keeps across renewals. Otherwise fall back to the last
		// known transaction id.
		txID := derefString(u.IAPOriginalTransactionID)
		if txID == "" {
			txID = derefString(u.IAPTransactionID)
		}
		if txID == "" {
			return nil // Nothing we can query Apple with.
		}

		result, err := s.iapService.ValidateApplePurchase(ctx, txID)
		if err != nil {
			return err
		}
		return s.iapService.UpdateUserIAPStatus(ctx, u.ID, result)

	case "android":
		// Google revalidation requires the purchase token; we don't store it
		// separately. Rely on the webhook (Real-time Developer Notifications)
		// or on the mobile "Restore" button for Android.
		return nil

	default:
		return nil
	}
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
