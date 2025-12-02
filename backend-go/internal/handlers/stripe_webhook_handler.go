package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/webhook"

	"github.com/esportnews/backend/internal/services"
)

type StripeWebhookHandler struct {
	stripeService *services.StripeService
	emailService  *services.EmailService
	logger        *logrus.Logger
	webhookSecret string
}

func NewStripeWebhookHandler(
	stripeService *services.StripeService,
	emailService *services.EmailService,
	logger *logrus.Logger,
	webhookSecret string,
) *StripeWebhookHandler {
	return &StripeWebhookHandler{
		stripeService: stripeService,
		emailService:  emailService,
		logger:        logger,
		webhookSecret: webhookSecret,
	}
}

func (h *StripeWebhookHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/webhooks/stripe", h.HandleStripeWebhook)
}

// HandleStripeWebhook processes Stripe webhook events
func (h *StripeWebhookHandler) HandleStripeWebhook(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Log incoming webhook request
	h.logger.WithFields(logrus.Fields{
		"content_type": c.Request().Header.Get("Content-Type"),
		"has_signature": c.Request().Header.Get("Stripe-Signature") != "",
	}).Info("Received webhook request")

	// Read body
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		h.logger.WithError(err).Error("Failed to read webhook body")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to read body"})
	}

	h.logger.WithField("body_size", len(body)).Debug("Webhook body read")

	// Verify webhook signature
	event, err := webhook.ConstructEvent(body, c.Request().Header.Get("Stripe-Signature"), h.webhookSecret)
	if err != nil {
		h.logger.WithError(err).Error("Failed to verify webhook signature")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid signature"})
	}

	h.logger.WithFields(logrus.Fields{
		"event_type": event.Type,
		"event_id":   event.ID,
	}).Info("Received Stripe webhook")

	// Handle different event types
	switch event.Type {
	case "checkout.session.completed":
		return h.handleCheckoutSessionCompleted(c, ctx, event.Data.Raw)
	case "customer.subscription.updated":
		return h.handleSubscriptionUpdated(c, ctx, event.Data.Raw)
	case "customer.subscription.deleted":
		return h.handleSubscriptionDeleted(c, ctx, event.Data.Raw)
	default:
		h.logger.WithField("event_type", event.Type).Info("Ignoring unhandled webhook event")
		return c.JSON(http.StatusOK, map[string]string{"received": "true"})
	}
}

// handleCheckoutSessionCompleted handles checkout.session.completed event
func (h *StripeWebhookHandler) handleCheckoutSessionCompleted(c echo.Context, ctx context.Context, rawData json.RawMessage) error {
	var session stripe.CheckoutSession
	if err := json.Unmarshal(rawData, &session); err != nil {
		h.logger.WithError(err).Error("Failed to unmarshal checkout session")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to parse event"})
	}

	customerID := ""
	if session.Customer != nil {
		customerID = session.Customer.ID
	}

	h.logger.WithFields(logrus.Fields{
		"session_id":     session.ID,
		"customer_id":    customerID,
		"payment_status": session.PaymentStatus,
	}).Info("Processing checkout.session.completed")

	// Check if customer ID exists
	if customerID == "" {
		h.logger.WithField("session_id", session.ID).Warn("Checkout session has no customer ID - ignoring")
		return c.JSON(http.StatusOK, map[string]string{"received": "true"})
	}

	// Get user by stripe customer ID
	user, err := h.stripeService.GetUserByStripeCustomerID(ctx, customerID)
	if err != nil {
		h.logger.WithError(err).WithField("customer_id", customerID).Error("Failed to find user by customer ID")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User not found"})
	}

	// Update user with subscription info
	// The subscription will be updated via the subscription.updated webhook
	// For now, just mark as premium
	updateMap := map[string]interface{}{
		"premium": true,
	}

	if err := h.stripeService.UpdateUserSubscriptionStatus(ctx, user.ID, updateMap); err != nil {
		h.logger.WithError(err).Error("Failed to update user subscription status")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update user"})
	}

	h.logger.WithFields(logrus.Fields{
		"user_id":   user.ID,
		"user_name": user.Name,
	}).Info("User marked as premium")

	// Send confirmation email asynchronously
	// TODO: Enable email sending once Resend is properly configured
	/*
	go func() {
		// Calculate next billing date (approximate - 30 days from now)
		nextBillingDate := time.Now().AddDate(0, 1, 0)
		if err := h.emailService.SendSubscriptionConfirmation(context.Background(), user.Email, user.Name, nextBillingDate); err != nil {
			h.logger.WithError(err).WithField("user_id", user.ID).Error("Failed to send confirmation email")
		} else {
			h.logger.WithField("user_id", user.ID).Info("Confirmation email sent")
		}
	}()
	*/

	return c.JSON(http.StatusOK, map[string]string{"received": "true"})
}

// handleSubscriptionUpdated handles customer.subscription.updated event
func (h *StripeWebhookHandler) handleSubscriptionUpdated(c echo.Context, ctx context.Context, rawData json.RawMessage) error {
	var subscription stripe.Subscription
	if err := json.Unmarshal(rawData, &subscription); err != nil {
		h.logger.WithError(err).Error("Failed to unmarshal subscription")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to parse event"})
	}

	h.logger.WithFields(logrus.Fields{
		"subscription_id": subscription.ID,
		"status":          subscription.Status,
	}).Info("Processing customer.subscription.updated")

	// Get user by subscription ID
	user, err := h.stripeService.GetUserByStripeSubscriptionID(ctx, subscription.ID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to find user by subscription ID")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User not found"})
	}

	// Build update map from Stripe subscription
	updateMap := h.stripeService.BuildSubscriptionUpdateMap(&subscription)

	if err := h.stripeService.UpdateUserSubscriptionStatus(ctx, user.ID, updateMap); err != nil {
		h.logger.WithError(err).Error("Failed to update user subscription status")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update user"})
	}

	h.logger.WithFields(logrus.Fields{
		"user_id": user.ID,
		"status":  subscription.Status,
	}).Info("User subscription updated")

	return c.JSON(http.StatusOK, map[string]string{"received": "true"})
}

// handleSubscriptionDeleted handles customer.subscription.deleted event
func (h *StripeWebhookHandler) handleSubscriptionDeleted(c echo.Context, ctx context.Context, rawData json.RawMessage) error {
	var subscription stripe.Subscription
	if err := json.Unmarshal(rawData, &subscription); err != nil {
		h.logger.WithError(err).Error("Failed to unmarshal subscription")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to parse event"})
	}

	h.logger.WithFields(logrus.Fields{
		"subscription_id": subscription.ID,
	}).Info("Processing customer.subscription.deleted")

	// Get user by subscription ID
	user, err := h.stripeService.GetUserByStripeSubscriptionID(ctx, subscription.ID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to find user by subscription ID")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User not found"})
	}

	// Update user - mark as not premium, set canceled_at
	now := time.Now()
	updateMap := map[string]interface{}{
		"premium":                    false,
		"stripe_subscription_id":     nil,
		"subscription_status":        "canceled",
		"subscription_canceled_at":   now,
		"subscription_updated_at":    now,
	}

	if err := h.stripeService.UpdateUserSubscriptionStatus(ctx, user.ID, updateMap); err != nil {
		h.logger.WithError(err).Error("Failed to update user subscription status")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update user"})
	}

	h.logger.WithFields(logrus.Fields{
		"user_id": user.ID,
	}).Info("User subscription cancelled")

	// Send cancellation email asynchronously
	// TODO: Enable email sending once Resend is properly configured
	/*
	go func() {
		if err := h.emailService.SendSubscriptionCancelled(context.Background(), user.Email, user.Name); err != nil {
			h.logger.WithError(err).WithField("user_id", user.ID).Error("Failed to send cancellation email")
		} else {
			h.logger.WithField("user_id", user.ID).Info("Cancellation email sent")
		}
	}()
	*/

	return c.JSON(http.StatusOK, map[string]string{"received": "true"})
}
