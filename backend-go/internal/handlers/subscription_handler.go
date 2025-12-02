package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type SubscriptionHandler struct {
	stripeService *services.StripeService
	authService   *services.AuthService
	logger        *logrus.Logger
	gormDB        *gorm.DB
}

type CheckoutSessionResponse struct {
	SessionURL string `json:"session_url"`
}

type SubscriptionStatusResponse struct {
	Premium                       bool       `json:"premium"`
	SubscriptionID                *string    `json:"subscription_id,omitempty"`
	CustomerID                    *string    `json:"customer_id,omitempty"`
	SubscriptionStatus            *string    `json:"subscription_status,omitempty"`
	SubscriptionCurrentPeriodEnd  *time.Time `json:"subscription_current_period_end,omitempty"`
}

type PortalURLResponse struct {
	PortalURL string `json:"portal_url"`
}

func NewSubscriptionHandler(
	stripeService *services.StripeService,
	authService *services.AuthService,
	logger *logrus.Logger,
	gormDB *database.Database,
) *SubscriptionHandler {
	return &SubscriptionHandler{
		stripeService: stripeService,
		authService:   authService,
		logger:        logger,
		gormDB:        gormDB.DB,
	}
}

func (h *SubscriptionHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/subscriptions/checkout", h.CreateCheckoutSession)
	g.GET("/subscriptions/status", h.GetSubscriptionStatus)
	g.GET("/subscriptions/portal", h.GetCustomerPortalURL)
}

// CreateCheckoutSession creates a Stripe checkout session for subscription
func (h *SubscriptionHandler) CreateCheckoutSession(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Extract user ID from JWT
	userID, err := h.extractUserID(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to extract user ID from token")
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// Get user from database
	var user models.User
	if err := h.gormDB.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		h.logger.WithError(err).WithField("user_id", userID).Error("Failed to fetch user")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	// Check if user already has an active subscription
	if user.Premium != nil && *user.Premium {
		h.logger.WithField("user_id", userID).Warn("User already has active subscription")
		return echo.NewHTTPError(http.StatusBadRequest, "User already has an active subscription")
	}

	// Create or get Stripe customer
	var stripeCustomerID string
	if user.StripeCustomerID != nil && *user.StripeCustomerID != "" {
		stripeCustomerID = *user.StripeCustomerID
	} else {
		var err error
		stripeCustomerID, err = h.stripeService.CreateStripeCustomer(ctx, &user)
		if err != nil {
			h.logger.WithError(err).WithField("user_id", userID).Error("Failed to create Stripe customer")
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create Stripe customer")
		}
		h.logger.WithFields(map[string]interface{}{
			"user_id":             userID,
			"stripe_customer_id":  stripeCustomerID,
		}).Info("Created Stripe customer")
	}

	// Create checkout session
	sessionURL, err := h.stripeService.CreateCheckoutSession(ctx, userID, stripeCustomerID)
	if err != nil {
		h.logger.WithError(err).WithField("user_id", userID).Error("Failed to create checkout session")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create checkout session")
	}

	h.logger.WithFields(map[string]interface{}{
		"user_id":     userID,
		"session_url": sessionURL,
	}).Info("Checkout session created")

	return c.JSON(http.StatusOK, CheckoutSessionResponse{
		SessionURL: sessionURL,
	})
}

// GetSubscriptionStatus returns current subscription status
func (h *SubscriptionHandler) GetSubscriptionStatus(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Extract user ID from JWT
	userID, err := h.extractUserID(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to extract user ID from token")
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// Get user from database
	var user models.User
	if err := h.gormDB.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		h.logger.WithError(err).WithField("user_id", userID).Error("Failed to fetch user")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	response := SubscriptionStatusResponse{
		Premium:        user.Premium != nil && *user.Premium,
		SubscriptionID: user.StripeSubscriptionID,
		CustomerID:     user.StripeCustomerID,
		SubscriptionStatus: user.SubscriptionStatus,
		SubscriptionCurrentPeriodEnd: user.SubscriptionCurrentPeriodEnd,
	}

	return c.JSON(http.StatusOK, response)
}

// GetCustomerPortalURL returns the Stripe customer portal URL
func (h *SubscriptionHandler) GetCustomerPortalURL(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Extract user ID from JWT
	userID, err := h.extractUserID(c)
	if err != nil {
		h.logger.WithError(err).Error("Failed to extract user ID from token")
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	// Get user from database
	var user models.User
	if err := h.gormDB.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}
		h.logger.WithError(err).WithField("user_id", userID).Error("Failed to fetch user")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user")
	}

	// Check if user has a Stripe customer ID
	if user.StripeCustomerID == nil || *user.StripeCustomerID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "User does not have a Stripe customer ID")
	}

	// Get return URL from query parameter (default to profile page)
	returnURL := c.QueryParam("return_url")
	if returnURL == "" {
		returnURL = "http://localhost:3000/profile?section=subscription"
	}

	// Create billing portal session
	portalURL, err := h.stripeService.GetCustomerPortalURL(ctx, *user.StripeCustomerID, returnURL)
	if err != nil {
		h.logger.WithError(err).WithField("user_id", userID).Error("Failed to create billing portal session")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create billing portal session")
	}

	h.logger.WithFields(map[string]interface{}{
		"user_id":     userID,
		"portal_url":  portalURL,
	}).Info("Billing portal URL created")

	return c.JSON(http.StatusOK, PortalURLResponse{
		PortalURL: portalURL,
	})
}

// extractUserID extracts user ID from JWT token
func (h *SubscriptionHandler) extractUserID(c echo.Context) (int64, error) {
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
