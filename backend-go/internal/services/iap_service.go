package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
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
	Platform      string
	ProductID     string
	TransactionID string
	ExpiresAt     time.Time
	IsValid       bool
	Status        string
}

// IAPService handles in-app purchase validation for iOS and Android
type IAPService struct {
	db     *gorm.DB
	logger *logrus.Logger
	config *IAPConfig

	// Apple
	appleClient *api.StoreClient
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
	if cfg.AppleKeyPath != "" && cfg.AppleKeyID != "" && cfg.AppleIssuerID != "" {
		keyData, err := os.ReadFile(cfg.AppleKeyPath)
		if err != nil {
			logger.Warnf("[IAP] Cannot read Apple key file %s: %v — Apple IAP disabled", cfg.AppleKeyPath, err)
		} else {
			block, _ := pem.Decode(keyData)
			if block == nil {
				logger.Warn("[IAP] Cannot decode Apple PEM key — Apple IAP disabled")
			} else {
				key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
				if err != nil {
					logger.Warnf("[IAP] Cannot parse Apple private key: %v — Apple IAP disabled", err)
				} else {
					ecKey, ok := key.(*ecdsa.PrivateKey)
					if !ok {
						logger.Warn("[IAP] Apple key is not ECDSA — Apple IAP disabled")
					} else {
						s.appleKey = ecKey
						s.appleClient = api.NewStoreClient(&api.StoreConfig{
							KeyContent: keyData,
							KeyID:      cfg.AppleKeyID,
							BundleID:   cfg.AppleBundleID,
							Issuer:     cfg.AppleIssuerID,
							Sandbox:    cfg.AppleEnvironment == "sandbox",
						})
						s.appleReady = true
						logger.Info("[IAP] Apple App Store validation ready")
					}
				}
			}
		}
	} else {
		logger.Warn("[IAP] Apple IAP config incomplete — Apple IAP disabled")
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

// ValidateApplePurchase validates an Apple App Store transaction
func (s *IAPService) ValidateApplePurchase(ctx context.Context, transactionID string) (*IAPValidationResult, error) {
	if !s.appleReady {
		return nil, fmt.Errorf("Apple IAP validation is not configured")
	}

	resp, err := s.appleClient.GetTransactionInfo(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("Apple validation failed: %w", err)
	}

	// Decode the signed transaction
	tx, err := s.appleClient.ParseSignedTransaction(resp.SignedTransactionInfo)
	if err != nil {
		return nil, fmt.Errorf("cannot parse Apple transaction: %w", err)
	}

	result := &IAPValidationResult{
		Platform:      "ios",
		ProductID:     tx.ProductID,
		TransactionID: transactionID,
		IsValid:       true,
		Status:        "active",
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
