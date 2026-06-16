package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
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
	AppleKeyPath     string
	AppleKeyContent  string // inline PEM of the .p8 key (takes precedence over AppleKeyPath)
	AppleKeyID       string
	AppleIssuerID    string
	AppleBundleID    string
	AppleEnvironment string

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

// IAPService handles in-app purchase validation for iOS and Android
type IAPService struct {
	db     *gorm.DB
	logger *logrus.Logger
	config *IAPConfig

	// Apple
	appleClient *api.StoreClient // single-env client, kept for parsing signed transactions
	appleAPI    *api.APIClient   // dual-env client: tries production, falls back to sandbox
	appleKey    *ecdsa.PrivateKey
	appleReady  bool

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
	appleKeyData, keySource := loadAppleKey(cfg)
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
		} else if ecKey, ok := key.(*ecdsa.PrivateKey); !ok {
			logger.Warn("[IAP] Apple key is not ECDSA — Apple IAP disabled")
		} else {
			s.appleKey = ecKey
			storeConfig := api.StoreConfig{
				KeyContent: appleKeyData,
				KeyID:      cfg.AppleKeyID,
				BundleID:   cfg.AppleBundleID,
				Issuer:     cfg.AppleIssuerID,
				Sandbox:    cfg.AppleEnvironment == "sandbox",
			}
			// Single-env client (used only to parse signed transactions).
			s.appleClient = api.NewStoreClient(&storeConfig)
			// Dual-env client: Verify() tries production first, then sandbox on
			// TransactionIdNotFoundError. This is what makes the SAME backend work
			// for both real App Store purchases AND sandbox/TestFlight/App Review.
			s.appleAPI = api.NewAPIClient(storeConfig)
			s.appleReady = true
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

// loadAppleKey returns the Apple .p8 key material, preferring inline content
// (APPLE_IAP_KEY_CONTENT) over a file path (APPLE_IAP_KEY_PATH). Inline content
// pasted into env vars often has its newlines escaped as the two characters
// "\n"; we restore real newlines so pem.Decode can parse it. Returns nil if no
// usable key is configured, plus a short label describing the source.
func loadAppleKey(cfg *IAPConfig) ([]byte, string) {
	if content := strings.TrimSpace(cfg.AppleKeyContent); content != "" {
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

// ValidateApplePurchase validates an Apple App Store transaction
func (s *IAPService) ValidateApplePurchase(ctx context.Context, transactionID string) (*IAPValidationResult, error) {
	if !s.appleReady {
		return nil, fmt.Errorf("Apple IAP validation is not configured")
	}

	// Verify against production first, falling back to sandbox automatically.
	// Do NOT rely on a single hardcoded environment: real purchases live in
	// production while TestFlight / App Review / sandbox testers live in sandbox.
	resp, err := s.appleAPI.Verify(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("Apple validation failed: %w", err)
	}

	// Decode the signed transaction
	tx, err := s.appleClient.ParseSignedTransaction(resp.SignedTransactionInfo)
	if err != nil {
		return nil, fmt.Errorf("cannot parse Apple transaction: %w", err)
	}

	result := &IAPValidationResult{
		Platform:              "ios",
		ProductID:             tx.ProductID,
		TransactionID:         transactionID,
		OriginalTransactionID: tx.OriginalTransactionId,
		IsValid:               true,
		Status:                "active",
	}

	// Check expiration
	if tx.ExpiresDate > 0 {
		result.ExpiresAt = time.UnixMilli(tx.ExpiresDate)
		if result.ExpiresAt.Before(time.Now()) {
			result.IsValid = false
			result.Status = "expired"
		}
	}

	// Check revocation
	if tx.RevocationDate > 0 {
		result.IsValid = false
		result.Status = "revoked"
	}

	return result, nil
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
