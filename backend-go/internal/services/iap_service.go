package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/awa/go-iap/appstore/api"
	"github.com/awa/go-iap/playstore"
	"github.com/sirupsen/logrus"
	"google.golang.org/api/androidpublisher/v3"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
)

// IAPConfig holds configuration for Apple and Google IAP validation
type IAPConfig struct {
	// Apple App Store
	AppleKeyPath    string
	AppleKeyContent string // inline PEM of the .p8 key (takes precedence over AppleKeyPath)
	AppleKeyID      string
	AppleIssuerID   string
	AppleBundleID   string

	// Google Play Store
	GoogleKeyPath    string
	GoogleKeyContent string // inline service-account JSON (takes precedence over GoogleKeyPath)
	GooglePackage    string
}

// IAPValidationResult represents the result of an IAP validation
type IAPValidationResult struct {
	Platform              string
	ProductID             string
	TransactionID         string
	OriginalTransactionID string
	PreviousTransactionID string // Play: token this purchase replaces (resubscription / plan change)
	ExpiresAt             time.Time
	IsValid               bool
	Status                string
}

// appleStoreClient is the slice of *api.StoreClient we call, so tests can feed canned Apple responses.
type appleStoreClient interface {
	GetTransactionInfo(ctx context.Context, transactionID string) (*api.TransactionInfoResponse, error)
	GetALLSubscriptionStatuses(ctx context.Context, transactionID string, query *url.Values) (*api.StatusResponse, error)
}

// IAPService handles in-app purchase validation for iOS and Android
type IAPService struct {
	db     *gorm.DB
	logger *logrus.Logger
	config *IAPConfig

	// Apple: nil clients = Apple IAP disabled. Real purchases live in
	// production, TestFlight / App Review / sandbox testers in sandbox.
	appleProd         appleStoreClient
	appleSandbox      appleStoreClient
	parseAppleTx      func(signed string) (*api.JWSTransaction, error)
	parseAppleRenewal func(signed string) (*api.JWSRenewalInfoDecodedPayload, error)

	// Google Play: nil = disabled.
	googlePlay googlePlayClient
}

// googlePlayClient is the slice of *playstore.Client we call, so tests can feed canned Play responses.
type googlePlayClient interface {
	VerifySubscriptionV2(ctx context.Context, packageName, token string) (*androidpublisher.SubscriptionPurchaseV2, error)
}

// newGooglePlayClient builds the Play client without the eager token probe of
// playstore.New: a flaky boot must not disable Google IAP for the process lifetime.
var newGooglePlayClient = func(jsonKey []byte) (googlePlayClient, error) {
	return playstore.NewWithClient(jsonKey, &http.Client{Timeout: 10 * time.Second})
}

// NewIAPService creates a new IAP service. It does NOT fail if keys are missing —
// it logs a warning and disables the corresponding platform.
func NewIAPService(db *gorm.DB, logger *logrus.Logger, cfg *IAPConfig) *IAPService {
	s := &IAPService{
		db:     db,
		logger: logger,
		config: cfg,
	}

	// --- Apple setup ---
	// The key can be provided inline (APPLE_IAP_KEY_CONTENT, preferred on hosts
	// like Railway that can't mount files) or as a file path (APPLE_IAP_KEY_PATH).
	appleKeyData, keySource := LoadAppleKey(cfg)
	if appleKeyData == nil {
		logger.Warn("[IAP] Apple key not provided (set APPLE_IAP_KEY_CONTENT or APPLE_IAP_KEY_PATH) — Apple IAP disabled")
	} else if cfg.AppleKeyID == "" || cfg.AppleIssuerID == "" {
		logger.Warn("[IAP] Apple IAP config incomplete (APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID missing) — Apple IAP disabled")
	} else {
		block, _ := pem.Decode(appleKeyData)
		if block == nil {
			logger.Warn("[IAP] Cannot decode Apple PEM key — Apple IAP disabled")
		} else if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
			logger.Warnf("[IAP] Cannot parse Apple private key: %v — Apple IAP disabled", err)
		} else if _, ok := key.(*ecdsa.PrivateKey); !ok {
			logger.Warn("[IAP] Apple key is not ECDSA — Apple IAP disabled")
		} else {
			prodConfig := api.StoreConfig{
				KeyContent: appleKeyData,
				KeyID:      cfg.AppleKeyID,
				BundleID:   cfg.AppleBundleID,
				Issuer:     cfg.AppleIssuerID,
			}
			sandboxConfig := prodConfig
			sandboxConfig.Sandbox = true
			prod := api.NewStoreClient(&prodConfig)
			s.appleProd = prod
			s.appleSandbox = api.NewStoreClient(&sandboxConfig)
			s.parseAppleTx = prod.ParseSignedTransaction
			s.parseAppleRenewal = parseAppleRenewalInfo
			logger.Infof("[IAP] Apple App Store validation ready (key source: %s, prod+sandbox fallback enabled)", keySource)
		}
	}

	// --- Google setup ---
	googleKey, googleSource := LoadGoogleKey(cfg)
	if googleKey == nil {
		logger.Warn("[IAP] Google key not provided (set GOOGLE_IAP_KEY_CONTENT or GOOGLE_IAP_KEY_PATH) — Google IAP disabled")
	} else if client, err := newGooglePlayClient(googleKey); err != nil {
		logger.Warnf("[IAP] Cannot init Google Play client: %v — Google IAP disabled", err)
	} else {
		s.googlePlay = client
		logger.Infof("[IAP] Google Play validation ready (key source: %s)", googleSource)
	}

	return s
}

// LoadGoogleKey returns the service-account JSON (inline content wins over the file path) and a label naming its source, or nil.
func LoadGoogleKey(cfg *IAPConfig) ([]byte, string) {
	if content := strings.TrimSpace(cfg.GoogleKeyContent); content != "" {
		return []byte(content), "inline"
	}
	if cfg.GoogleKeyPath != "" {
		if data, err := os.ReadFile(cfg.GoogleKeyPath); err == nil {
			return data, "file:" + cfg.GoogleKeyPath
		}
	}
	return nil, "none"
}

// LoadAppleKey returns the Apple .p8 key material (inline content wins over the file path) and a label naming its source, or nil.
func LoadAppleKey(cfg *IAPConfig) ([]byte, string) {
	if content := strings.TrimSpace(cfg.AppleKeyContent); content != "" {
		// Railway stores the PEM on one line with literal "\n" sequences.
		if !strings.Contains(content, "\n") && strings.Contains(content, "\\n") {
			content = strings.ReplaceAll(content, "\\n", "\n")
		}
		return []byte(content), "inline"
	}
	if cfg.AppleKeyPath != "" {
		if data, err := os.ReadFile(cfg.AppleKeyPath); err == nil {
			return data, "file:" + cfg.AppleKeyPath
		}
	}
	return nil, "none"
}

// ValidateAppleSubscription returns the current state of the subscription txID belongs to.
func (s *IAPService) ValidateAppleSubscription(ctx context.Context, txID string) (*IAPValidationResult, error) {
	if s.appleProd == nil {
		return nil, fmt.Errorf("Apple IAP validation is not configured")
	}

	// Subscription statuses, never GetTransactionInfo alone: asked about the
	// original transaction of a renewed subscription, the latter describes the
	// first billing period (long expired) and would strip a paying subscriber.
	resp, client, err := appleFirst(s.appleProd, s.appleSandbox, func(c appleStoreClient) (*api.StatusResponse, error) {
		return c.GetALLSubscriptionStatuses(ctx, txID, nil)
	})
	if err != nil {
		return nil, fmt.Errorf("Apple subscription status failed: %w", err)
	}

	last, ok := subscriptionAnchoredOn(resp, txID)
	if !ok {
		// txID is a renewal id and the group holds several subscriptions: the
		// entries only carry original ids, so ask which one txID belongs to.
		info, err := client.GetTransactionInfo(ctx, txID)
		if err != nil {
			return nil, fmt.Errorf("Apple transaction lookup failed: %w", err)
		}
		tx, err := s.parseAppleTx(info.SignedTransactionInfo)
		if err != nil {
			return nil, fmt.Errorf("cannot parse Apple transaction: %w", err)
		}
		if last, ok = subscriptionAnchoredOn(resp, tx.OriginalTransactionId); !ok {
			return nil, fmt.Errorf("Apple lists no subscription anchored on %s (original of %s)", tx.OriginalTransactionId, txID)
		}
	}

	tx, err := s.parseAppleTx(last.SignedTransactionInfo)
	if err != nil {
		return nil, fmt.Errorf("cannot parse Apple transaction: %w", err)
	}
	result := appleSubscriptionResult(last.Status, tx)

	// In a billing grace period the transaction's expiresDate is already past;
	// the renewal info carries the date access actually ends.
	if last.Status == api.SubscriptionGracePeriod && last.SignedRenewalInfo != "" {
		renewal, err := s.parseAppleRenewal(last.SignedRenewalInfo)
		if err != nil {
			return nil, fmt.Errorf("cannot parse Apple renewal info: %w", err)
		}
		if renewal.GracePeriodExpiresDate > 0 {
			result.ExpiresAt = time.UnixMilli(renewal.GracePeriodExpiresDate)
		}
	}
	return result, nil
}

// appleFirst runs call on production, then on sandbox when the transaction is unknown there, and returns the client that answered.
func appleFirst[T any](prod, sandbox appleStoreClient, call func(appleStoreClient) (T, error)) (T, appleStoreClient, error) {
	v, err := call(prod)
	if err != nil && isAppleTransactionNotFound(err) {
		v, err = call(sandbox)
		return v, sandbox, err
	}
	return v, prod, err
}

func isAppleTransactionNotFound(err error) bool {
	return errors.Is(err, api.OriginalTransactionIdNotFoundError) ||
		errors.Is(err, api.TransactionIdNotFoundError)
}

// subscriptionAnchoredOn finds the group entry with this original transaction id, or the only entry when Apple listed a single subscription.
func subscriptionAnchoredOn(resp *api.StatusResponse, originalTxID string) (*api.LastTransactionsItem, bool) {
	var candidates []api.LastTransactionsItem
	for _, group := range resp.Data {
		for _, item := range group.LastTransactions {
			if item.OriginalTransactionId == originalTxID {
				return &item, true
			}
			candidates = append(candidates, item)
		}
	}
	if len(candidates) == 1 {
		return &candidates[0], true
	}
	return nil, false
}

// appleSubscriptionResult maps Apple's subscription status to our premium decision.
func appleSubscriptionResult(status api.AutoRenewSubscriptionStatus, tx *api.JWSTransaction) *IAPValidationResult {
	result := &IAPValidationResult{
		Platform:              "ios",
		ProductID:             tx.ProductID,
		TransactionID:         tx.TransactionID,
		OriginalTransactionID: tx.OriginalTransactionId,
	}
	if tx.ExpiresDate > 0 {
		result.ExpiresAt = time.UnixMilli(tx.ExpiresDate)
	}

	// Apple asks that users keep their entitlement during a billing grace period.
	switch status {
	case api.SubscriptionActive:
		result.IsValid, result.Status = true, "active"
	case api.SubscriptionGracePeriod:
		result.IsValid, result.Status = true, "grace_period"
	case api.SubscriptionRetryPeriod:
		result.Status = "billing_retry"
	case api.SubscriptionRevoked:
		result.Status = "revoked"
	default:
		result.Status = "expired"
	}
	// A refund ends access at the revocation date, whatever the paid period says.
	if tx.RevocationDate > 0 {
		result.IsValid, result.Status = false, "revoked"
		result.ExpiresAt = time.UnixMilli(tx.RevocationDate)
	}
	return result
}

// parseAppleRenewalInfo verifies a signed renewal-info JWS (go-iap has no exported parser for it).
func parseAppleRenewalInfo(signed string) (*api.JWSRenewalInfoDecodedPayload, error) {
	var renewal api.JWSRenewalInfoDecodedPayload
	if err := verifyAppleJWS(signed, &renewal); err != nil {
		return nil, err
	}
	return &renewal, nil
}

// ValidateGooglePurchase returns the current state of the Play subscription behind purchaseToken.
func (s *IAPService) ValidateGooglePurchase(ctx context.Context, purchaseToken string) (*IAPValidationResult, error) {
	if s.googlePlay == nil {
		return nil, fmt.Errorf("Google IAP validation is not configured")
	}

	// purchases.subscriptionsv2, not v1: v1 only reads base plans flagged
	// "backwards compatible" in the Play Console and knows nothing of the
	// subscription state machine (grace, hold, pause).
	resp, err := s.googlePlay.VerifySubscriptionV2(ctx, s.config.GooglePackage, purchaseToken)
	if err != nil {
		return nil, fmt.Errorf("Google validation failed: %w", err)
	}
	if resp.AcknowledgementState == "ACKNOWLEDGEMENT_STATE_PENDING" {
		// The app acknowledges in finishTransaction; Play refunds unacknowledged purchases after 3 days.
		s.logger.Warnf("[IAP] Google purchase %.20s... is not acknowledged yet", purchaseToken)
	}
	return googleSubscriptionResult(resp, purchaseToken, time.Now()), nil
}

// googleSubscriptionResult maps a Play subscription state to our premium decision.
func googleSubscriptionResult(resp *androidpublisher.SubscriptionPurchaseV2, purchaseToken string, now time.Time) *IAPValidationResult {
	result := &IAPValidationResult{
		Platform:              "android",
		TransactionID:         purchaseToken,
		PreviousTransactionID: resp.LinkedPurchaseToken,
	}
	for _, item := range resp.LineItems {
		if item.ProductId != "" {
			result.ProductID = item.ProductId
		}
		if t, err := time.Parse(time.RFC3339Nano, item.ExpiryTime); err == nil && t.After(result.ExpiresAt) {
			result.ExpiresAt = t
		}
	}
	paidPeriodRunning := !result.ExpiresAt.IsZero() && result.ExpiresAt.After(now)

	switch resp.SubscriptionState {
	case "SUBSCRIPTION_STATE_ACTIVE":
		result.IsValid, result.Status = paidPeriodRunning, "active"
	case "SUBSCRIPTION_STATE_CANCELED":
		// Auto-renew is off but the paid period keeps running until expiry.
		result.IsValid, result.Status = paidPeriodRunning, "canceled"
	case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
		// Play asks that users keep their entitlement during a billing grace period.
		result.IsValid, result.Status = true, "grace_period"
	case "SUBSCRIPTION_STATE_ON_HOLD":
		result.Status = "on_hold"
	case "SUBSCRIPTION_STATE_PAUSED":
		result.Status = "paused"
	case "SUBSCRIPTION_STATE_EXPIRED":
		result.Status = "expired"
	case "SUBSCRIPTION_STATE_PENDING":
		result.Status = "payment_pending"
	case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
		result.Status = "canceled"
	default:
		result.Status = "unknown"
	}
	return result
}

// UpdateUserIAPStatus updates the user's premium status based on IAP validation
func (s *IAPService) UpdateUserIAPStatus(ctx context.Context, userID int64, result *IAPValidationResult) error {
	premium := result.IsValid

	updates := map[string]interface{}{
		"premium":            premium,
		"iap_platform":       result.Platform,
		"iap_transaction_id": result.TransactionID,
	}
	if result.ProductID != "" {
		updates["iap_product_id"] = result.ProductID
	}

	if result.OriginalTransactionID != "" {
		updates["iap_original_transaction_id"] = result.OriginalTransactionID
	}

	if !result.ExpiresAt.IsZero() {
		updates["iap_expires_at"] = result.ExpiresAt
	}

	err := s.db.WithContext(ctx).
		Model(&models.User{}).
		Where("id = ?", userID).
		Updates(updates).Error

	if err != nil {
		return fmt.Errorf("failed to update user IAP status: %w", err)
	}

	s.logger.Infof("[IAP] User %d → premium=%v platform=%s product=%s", userID, premium, result.Platform, result.ProductID)
	return nil
}
