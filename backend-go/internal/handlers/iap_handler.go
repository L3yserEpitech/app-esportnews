package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type IAPHandler struct {
	iapService  *services.IAPService
	authService *services.AuthService
	logger      *logrus.Logger
	gormDB      *gorm.DB
}

type IAPValidateRequest struct {
	Platform      string `json:"platform"`       // "ios" or "android"
	TransactionID string `json:"transaction_id"`  // iOS: StoreKit transactionId
	ProductID     string `json:"product_id"`      // Product SKU
	PurchaseToken string `json:"purchase_token"`  // Android: Google Play purchaseToken
}

type IAPValidateResponse struct {
	Premium      bool       `json:"premium"`
	IAPPlatform  string     `json:"iap_platform"`
	IAPExpiresAt *time.Time `json:"iap_expires_at,omitempty"`
	Message      string     `json:"message"`
}

func NewIAPHandler(
	iapService *services.IAPService,
	authService *services.AuthService,
	logger *logrus.Logger,
	gormDB *gorm.DB,
) *IAPHandler {
	return &IAPHandler{
		iapService:  iapService,
		authService: authService,
		logger:      logger,
		gormDB:      gormDB,
	}
}

func (h *IAPHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/subscriptions/iap/validate", h.ValidateIAPReceipt)
}

// ValidateIAPReceipt validates an iOS or Android in-app purchase receipt
// and updates the user's premium status in the database
func (h *IAPHandler) ValidateIAPReceipt(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Extract user ID from JWT
	userID, err := h.extractUserID(c)
	if err != nil {
		h.logger.WithError(err).Error("[IAP] Failed to extract user ID from token")
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// Parse request body
	var req IAPValidateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	// Validate platform
	if req.Platform != "ios" && req.Platform != "android" {
		return echo.NewHTTPError(http.StatusBadRequest, "Platform must be 'ios' or 'android'")
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":  userID,
		"platform": req.Platform,
	}).Info("[IAP] Validating purchase receipt")

	// Get user from database
	var user models.User
	if err := h.gormDB.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		h.logger.WithError(err).WithField("user_id", userID).Error("[IAP] Failed to fetch user")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	// If user is already premium via IAP on the same platform, return success (idempotent)
	if user.Premium != nil && *user.Premium && user.IAPPlatform != nil && *user.IAPPlatform == req.Platform {
		h.logger.WithField("user_id", userID).Info("[IAP] User already premium via IAP, returning success")
		return c.JSON(http.StatusOK, IAPValidateResponse{
			Premium:      true,
			IAPPlatform:  req.Platform,
			IAPExpiresAt: user.IAPExpiresAt,
			Message:      "Subscription already active",
		})
	}

	// Validate receipt based on platform
	var result *services.IAPValidationResult
	switch req.Platform {
	case "ios":
		if req.TransactionID == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "transaction_id is required for iOS")
		}
		result, err = h.iapService.ValidateApplePurchase(ctx, req.TransactionID)
	case "android":
		if req.ProductID == "" || req.PurchaseToken == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "product_id and purchase_token are required for Android")
		}
		result, err = h.iapService.ValidateGooglePurchase(ctx, req.ProductID, req.PurchaseToken)
	}

	if err != nil {
		h.logger.WithError(err).WithFields(logrus.Fields{
			"user_id":  userID,
			"platform": req.Platform,
		}).Error("[IAP] Receipt validation failed")
		return echo.NewHTTPError(http.StatusPaymentRequired, fmt.Sprintf("Receipt validation failed: %v", err))
	}

	if !result.IsValid {
		h.logger.WithFields(logrus.Fields{
			"user_id":  userID,
			"platform": req.Platform,
			"status":   result.Status,
		}).Warn("[IAP] Receipt is not valid")
		return echo.NewHTTPError(http.StatusPaymentRequired, fmt.Sprintf("Subscription is %s", result.Status))
	}

	// Update user's premium status in database
	if err := h.iapService.UpdateUserIAPStatus(ctx, userID, result); err != nil {
		h.logger.WithError(err).WithField("user_id", userID).Error("[IAP] Failed to update user IAP status")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update subscription status")
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":  userID,
		"platform": result.Platform,
		"status":   result.Status,
	}).Info("[IAP] Purchase validated and user updated successfully")

	return c.JSON(http.StatusOK, IAPValidateResponse{
		Premium:      true,
		IAPPlatform:  result.Platform,
		IAPExpiresAt: &result.ExpiresAt,
		Message:      "Subscription validated successfully",
	})
}

// extractUserID extracts user ID from JWT token
func (h *IAPHandler) extractUserID(c echo.Context) (int64, error) {
	tokenString := extractToken(c)
	if tokenString == "" {
		return 0, fmt.Errorf("missing token")
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return 0, err
	}

	return claims.UserID, nil
}
