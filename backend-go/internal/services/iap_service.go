package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/awa/go-iap/appstore/api"
	"github.com/awa/go-iap/playstore"
	"github.com/sirupsen/logrus"
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
	GoogleKeyPath string
	GooglePackage string
}

// IAPValidationResult represents the result of an IAP validation
type IAPValidationResult struct {
	Platform              string
	ProductID             string
	TransactionID         string
	OriginalTransactionID string
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

	// Google
	googleClient *playstore.Client
	googleReady  bool
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
	if cfg.GoogleKeyPath != "" {
		client, err := playstore.New(keyData(cfg.GoogleKeyPath))
		if err != nil {
			logger.Warnf("[IAP] Cannot init Google Play client: %v — Google IAP disabled", err)
		} else {
			s.googleClient = client
			s.googleReady = true
			logger.Info("[IAP] Google Play validation ready")
		}
	} else {
		logger.Warn("[IAP] Google IAP key path not set — Google IAP disabled")
	}

	return s
}

// keyData reads a JSON key file and returns its bytes
func keyData(path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	return data
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

// ValidateGooglePurchase validates a Google Play subscription purchase
func (s *IAPService) ValidateGooglePurchase(ctx context.Context, productID string, purchaseToken string) (*IAPValidationResult, error) {
	if !s.googleReady {
		return nil, fmt.Errorf("Google IAP validation is not configured")
	}

	resp, err := s.googleClient.VerifySubscription(ctx, s.config.GooglePackage, productID, purchaseToken)
	if err != nil {
		return nil, fmt.Errorf("Google validation failed: %w", err)
	}

	result := &IAPValidationResult{
		Platform:      "android",
		ProductID:     productID,
		TransactionID: purchaseToken,
		IsValid:       true,
		Status:        "active",
	}

	// Check expiry
	now := time.Now()
	if resp.ExpiryTimeMillis > 0 {
		result.ExpiresAt = time.UnixMilli(resp.ExpiryTimeMillis)
		if !result.ExpiresAt.After(now) {
			result.IsValid = false
			result.Status = "expired"
		}
	}

	// Check cancellation (CancelReason is int64, not pointer)
	if resp.CancelReason > 0 {
		result.Status = "canceled"
	}

	// PaymentState: 0=pending, 1=received, 2=free trial, 3=deferred
	if resp.PaymentState != nil && *resp.PaymentState == 0 {
		result.IsValid = false
		result.Status = "payment_pending"
	}

	return result, nil
}

// UpdateUserIAPStatus updates the user's premium status based on IAP validation
func (s *IAPService) UpdateUserIAPStatus(ctx context.Context, userID int64, result *IAPValidationResult) error {
	premium := result.IsValid

	updates := map[string]interface{}{
		"premium":            premium,
		"iap_platform":       result.Platform,
		"iap_product_id":     result.ProductID,
		"iap_transaction_id": result.TransactionID,
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
