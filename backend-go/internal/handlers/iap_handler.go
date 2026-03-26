package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/services"
)

// IAPHandler handles in-app purchase validation endpoints
type IAPHandler struct {
	iapService  *services.IAPService
	authService *services.AuthService
	logger      *logrus.Logger
}

// NewIAPHandler creates a new IAP handler
func NewIAPHandler(iapService *services.IAPService, authService *services.AuthService, logger *logrus.Logger) *IAPHandler {
	return &IAPHandler{
		iapService:  iapService,
		authService: authService,
		logger:      logger,
	}
}

// RegisterRoutes registers IAP routes (JWT required)
func (h *IAPHandler) RegisterRoutes(g *echo.Group) {
	g.POST("/subscriptions/iap/validate", h.ValidatePurchase)
}

// ValidatePurchaseRequest is the request body for IAP validation
type ValidatePurchaseRequest struct {
	Platform      string `json:"platform"`       // "ios" or "android"
	TransactionID string `json:"transaction_id"`  // Apple transaction ID or Google order ID
	ProductID     string `json:"product_id"`      // Product/SKU ID
	PurchaseToken string `json:"purchase_token"`  // Google Play purchase token
}

// ValidatePurchase validates an in-app purchase receipt and updates user premium status
func (h *IAPHandler) ValidatePurchase(c echo.Context) error {
	// Extract user ID from JWT
	tokenString := extractToken(c)
	if tokenString == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing authorization token"})
	}

	claims, err := h.authService.VerifyToken(tokenString)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
	}

	userID := claims.UserID

	// Parse request body
	var req ValidatePurchaseRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Platform != "ios" && req.Platform != "android" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "platform must be 'ios' or 'android'"})
	}

	ctx := c.Request().Context()
	var result *services.IAPValidationResult

	switch req.Platform {
	case "ios":
		if req.TransactionID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "transaction_id is required for iOS"})
		}
		result, err = h.iapService.ValidateApplePurchase(ctx, req.TransactionID)

	case "android":
		if req.ProductID == "" || req.PurchaseToken == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "product_id and purchase_token are required for Android"})
		}
		result, err = h.iapService.ValidateGooglePurchase(ctx, req.ProductID, req.PurchaseToken)
	}

	if err != nil {
		h.logger.Errorf("[IAP] Validation error for user %d: %v", userID, err)
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error":   "validation_failed",
			"message": "Could not validate purchase with store",
		})
	}

	// Update user in database
	if err := h.iapService.UpdateUserIAPStatus(ctx, userID, result); err != nil {
		h.logger.Errorf("[IAP] DB update error for user %d: %v", userID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update subscription status"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"premium":        result.IsValid,
		"iap_platform":   result.Platform,
		"iap_expires_at": result.ExpiresAt,
		"status":         result.Status,
		"message":        "Purchase validated successfully",
	})
}
