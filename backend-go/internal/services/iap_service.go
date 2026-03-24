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
	// Apple
	AppleKeyPath     string
	AppleKeyID       string
	AppleIssuerID    string
	AppleBundleID    string
	AppleEnvironment string // "sandbox" or "production"
	// Google
	GoogleKeyPath string
	GooglePackage string
}

// IAPValidationResult is the normalized result of a receipt validation
type IAPValidationResult struct {
	Platform      string    // "ios" or "android"
	ProductID     string
	TransactionID string
	ExpiresAt     time.Time
	IsValid       bool
	Status        string // "active", "expired", "canceled"
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

// NewIAPService creates a new IAPService with Apple and Google validation support
func NewIAPService(db *gorm.DB, logger *logrus.Logger, config *IAPConfig) *IAPService {
	svc := &IAPService{
		db:     db,
		logger: logger,
		config: config,
	}

	// Initialize Apple client
	svc.initApple()

	// Initialize Google client
	svc.initGoogle()

	return svc
}

func (s *IAPService) initApple() {
	if s.config.AppleKeyPath == "" || s.config.AppleKeyID == "" || s.config.AppleIssuerID == "" {
		s.logger.Warn("[IAP] Apple IAP not configured (missing key path, key ID, or issuer ID)")
		return
	}

	keyBytes, err := os.ReadFile(s.config.AppleKeyPath)
	if err != nil {
		s.logger.WithError(err).Warn("[IAP] Failed to read Apple .p8 key file")
		return
	}

	// Parse the .p8 key
	block, _ := pem.Decode(keyBytes)
	if block == nil {
		s.logger.Warn("[IAP] Failed to decode Apple .p8 PEM block")
		return
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		s.logger.WithError(err).Warn("[IAP] Failed to parse Apple private key")
		return
	}

	ecdsaKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		s.logger.Warn("[IAP] Apple key is not ECDSA")
		return
	}

	s.appleKey = ecdsaKey

	// Determine environment
	env := api.Sandbox
	if s.config.AppleEnvironment == "production" {
		env = api.Production
	}

	s.appleClient = api.NewStoreClient(&api.StoreConfig{
		KeyContent: keyBytes,
		KeyID:      s.config.AppleKeyID,
		BundleID:   s.config.AppleBundleID,
		Issuer:     s.config.AppleIssuerID,
		Sandbox:    env == api.Sandbox,
	})

	s.appleReady = true
	s.logger.Info("[IAP] Apple App Store validation initialized")
}

func (s *IAPService) initGoogle() {
	if s.config.GoogleKeyPath == "" {
		s.logger.Warn("[IAP] Google IAP not configured (missing service account key path)")
		return
	}

	keyBytes, err := os.ReadFile(s.config.GoogleKeyPath)
	if err != nil {
		s.logger.WithError(err).Warn("[IAP] Failed to read Google service account JSON")
		return
	}

	client, err := playstore.New(keyBytes)
	if err != nil {
		s.logger.WithError(err).Warn("[IAP] Failed to create Google Play client")
		return
	}

	s.googleClient = client
	s.googleReady = true
	s.logger.Info("[IAP] Google Play validation initialized")
}

// ValidateApplePurchase validates an iOS App Store purchase
func (s *IAPService) ValidateApplePurchase(ctx context.Context, transactionID string) (*IAPValidationResult, error) {
	if !s.appleReady {
		return nil, fmt.Errorf("Apple IAP validation is not configured")
	}

	if transactionID == "" {
		return nil, fmt.Errorf("transaction_id is required for Apple validation")
	}

	// Get transaction info from Apple
	txnResp, err := s.appleClient.GetTransactionInfo(ctx, transactionID)
	if err != nil {
		s.logger.WithError(err).WithField("transaction_id", transactionID).Error("[IAP] Apple GetTransactionInfo failed")
		return nil, fmt.Errorf("failed to validate Apple receipt: %w", err)
	}

	// Parse the signed transaction
	txnInfo, err := s.appleClient.ParseSignedTransaction(txnResp.SignedTransactionInfo)
	if err != nil {
		s.logger.WithError(err).Error("[IAP] Failed to parse Apple signed transaction")
		return nil, fmt.Errorf("failed to parse Apple transaction: %w", err)
	}

	result := &IAPValidationResult{
		Platform:      "ios",
		ProductID:     txnInfo.ProductID,
		TransactionID: txnInfo.OriginalTransactionId,
	}

	// Check expiration
	if txnInfo.ExpiresDate > 0 {
		result.ExpiresAt = time.UnixMilli(txnInfo.ExpiresDate)
	}

	// Determine validity
	now := time.Now()
	if result.ExpiresAt.After(now) && txnInfo.RevocationDate == 0 {
		result.IsValid = true
		result.Status = "active"
	} else if txnInfo.RevocationDate > 0 {
		result.IsValid = false
		result.Status = "canceled"
	} else {
		result.IsValid = false
		result.Status = "expired"
	}

	s.logger.WithFields(logrus.Fields{
		"transaction_id": transactionID,
		"product_id":     result.ProductID,
		"status":         result.Status,
		"expires_at":     result.ExpiresAt,
	}).Info("[IAP] Apple purchase validated")

	return result, nil
}

// ValidateGooglePurchase validates a Google Play Store purchase
func (s *IAPService) ValidateGooglePurchase(ctx context.Context, productID, purchaseToken string) (*IAPValidationResult, error) {
	if !s.googleReady {
		return nil, fmt.Errorf("Google IAP validation is not configured")
	}

	if productID == "" || purchaseToken == "" {
		return nil, fmt.Errorf("product_id and purchase_token are required for Google validation")
	}

	// Verify subscription with Google Play
	resp, err := s.googleClient.VerifySubscription(ctx, s.config.GooglePackage, productID, purchaseToken)
	if err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"product_id":     productID,
			"package":        s.config.GooglePackage,
		}).Error("[IAP] Google VerifySubscription failed")
		return nil, fmt.Errorf("failed to validate Google receipt: %w", err)
	}

	result := &IAPValidationResult{
		Platform:  "android",
		ProductID: productID,
	}

	// Parse expiration time (millis since epoch)
	if resp.ExpiryTimeMillis > 0 {
		result.ExpiresAt = time.UnixMilli(resp.ExpiryTimeMillis)
	}

	// Use order ID as transaction identifier
	result.TransactionID = resp.OrderId

	// Determine validity
	// PaymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred upgrade/downgrade
	// CancelReason: 0=user canceled, 1=system canceled (omitempty: 0 could also mean not set)
	now := time.Now()
	if result.ExpiresAt.After(now) && (resp.PaymentState == nil || *resp.PaymentState == 1 || *resp.PaymentState == 2) {
		result.IsValid = true
		result.Status = "active"
	} else if !result.ExpiresAt.After(now) && resp.CancelReason >= 0 && resp.ExpiryTimeMillis > 0 {
		result.IsValid = false
		result.Status = "canceled"
	} else {
		result.IsValid = false
		result.Status = "expired"
	}

	s.logger.WithFields(logrus.Fields{
		"product_id":    productID,
		"order_id":      resp.OrderId,
		"status":        result.Status,
		"expires_at":    result.ExpiresAt,
		"payment_state": resp.PaymentState,
	}).Info("[IAP] Google purchase validated")

	return result, nil
}

// UpdateUserIAPStatus updates a user's premium status based on IAP validation
func (s *IAPService) UpdateUserIAPStatus(ctx context.Context, userID int64, result *IAPValidationResult) error {
	premium := result.IsValid
	updates := map[string]interface{}{
		"premium":            premium,
		"iap_platform":       result.Platform,
		"iap_product_id":     result.ProductID,
		"iap_transaction_id": result.TransactionID,
		"iap_expires_at":     result.ExpiresAt,
	}

	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to update user IAP status: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"user_id":  userID,
		"platform": result.Platform,
		"premium":  premium,
	}).Info("[IAP] User subscription status updated")

	return nil
}
