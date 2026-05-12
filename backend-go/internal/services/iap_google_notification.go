package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/esportnews/backend/internal/models"
)

// rtdnPubSubMessage is the outer Pub/Sub push envelope Google sends.
type rtdnPubSubMessage struct {
	Message struct {
		Data      string `json:"data"`      // base64-encoded DeveloperNotification JSON
		MessageID string `json:"messageId"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}

// rtdnNotification is Google's DeveloperNotification payload (decoded from Data).
// Reference: https://developer.android.com/google/play/billing/rtdn-reference
type rtdnNotification struct {
	Version                string                       `json:"version"`
	PackageName            string                       `json:"packageName"`
	EventTimeMillis        string                       `json:"eventTimeMillis"`
	SubscriptionNotification *rtdnSubscriptionNotification `json:"subscriptionNotification"`
}

type rtdnSubscriptionNotification struct {
	Version          string `json:"version"`
	NotificationType int    `json:"notificationType"`
	PurchaseToken    string `json:"purchaseToken"`
	SubscriptionID   string `json:"subscriptionId"`
}

// Google Play RTDN notification types.
// Reference: https://developer.android.com/google/play/billing/rtdn-reference#sub
const (
	rtdnRecovered              = 1
	rtdnRenewed                = 2
	rtdnCanceled               = 3
	rtdnPurchased              = 4
	rtdnOnHold                 = 5
	rtdnInGracePeriod          = 6
	rtdnRestarted              = 7
	rtdnPriceChangeConfirmed   = 8
	rtdnDeferred               = 9
	rtdnPaused                 = 10
	rtdnPauseScheduleChanged   = 11
	rtdnRevoked                = 12
	rtdnExpired                = 13
)

// HandleGoogleNotification processes a Google Play Real-time Developer Notification
// delivered via Pub/Sub push. The purchase token is used to re-validate with the
// Google Play API and update the matching user's premium status.
func (s *IAPService) HandleGoogleNotification(ctx context.Context, body []byte) error {
	if !s.googleReady {
		s.logger.Warn("[IAP][GoogleWebhook] Received Google notification but Google IAP is not configured")
		return nil
	}

	var msg rtdnPubSubMessage
	if err := json.Unmarshal(body, &msg); err != nil {
		return fmt.Errorf("parse Pub/Sub envelope: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(msg.Message.Data)
	if err != nil {
		return fmt.Errorf("decode Pub/Sub data: %w", err)
	}

	var notif rtdnNotification
	if err := json.Unmarshal(decoded, &notif); err != nil {
		return fmt.Errorf("parse RTDN payload: %w", err)
	}

	// Ignore non-subscription notifications (e.g. one-time purchases).
	if notif.SubscriptionNotification == nil {
		s.logger.Infof("[IAP][GoogleWebhook] Ignoring non-subscription notification (msgId=%s)", msg.Message.MessageID)
		return nil
	}

	sub := notif.SubscriptionNotification
	s.logger.Infof("[IAP][GoogleWebhook] notificationType=%d purchaseToken=%.20s... subscriptionId=%s",
		sub.NotificationType, sub.PurchaseToken, sub.SubscriptionID)

	// For revoke/expiry/cancel we can flip premium=false immediately without
	// hitting the Google API — saves a round-trip and avoids rate limits.
	if isGoogleTerminalNotification(sub.NotificationType) {
		return s.setGoogleUserPremium(ctx, sub.PurchaseToken, false)
	}

	// For all other types, re-validate with Google Play to get the ground truth.
	result, err := s.ValidateGooglePurchase(ctx, sub.SubscriptionID, sub.PurchaseToken)
	if err != nil {
		return fmt.Errorf("re-validate after RTDN: %w", err)
	}

	updates := map[string]interface{}{
		"premium":        result.IsValid,
		"iap_product_id": result.ProductID,
	}
	if !result.ExpiresAt.IsZero() {
		updates["iap_expires_at"] = result.ExpiresAt
	}

	res := s.db.WithContext(ctx).
		Model(&models.User{}).
		Where("iap_transaction_id = ?", sub.PurchaseToken).
		Updates(updates)
	if res.Error != nil {
		return fmt.Errorf("update user by purchase_token: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		s.logger.Warnf("[IAP][GoogleWebhook] No user found for purchaseToken=%.20s...", sub.PurchaseToken)
		return nil
	}

	s.logger.Infof("[IAP][GoogleWebhook] Updated user via purchaseToken=%.20s... → premium=%v", sub.PurchaseToken, result.IsValid)
	return nil
}

// isGoogleTerminalNotification returns true for notification types that
// unconditionally end the subscription (no need to re-validate).
func isGoogleTerminalNotification(t int) bool {
	switch t {
	case rtdnRevoked, rtdnExpired, rtdnCanceled, rtdnOnHold:
		return true
	}
	return false
}

// setGoogleUserPremium flips premium for the user identified by purchaseToken.
func (s *IAPService) setGoogleUserPremium(ctx context.Context, purchaseToken string, premium bool) error {
	res := s.db.WithContext(ctx).
		Model(&models.User{}).
		Where("iap_transaction_id = ?", purchaseToken).
		Update("premium", premium)
	if res.Error != nil {
		return fmt.Errorf("flip premium for purchaseToken: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		s.logger.Warnf("[IAP][GoogleWebhook] No user found for purchaseToken=%.20s... (terminal flip)", purchaseToken)
	} else {
		s.logger.Infof("[IAP][GoogleWebhook] Flipped user premium=%v via purchaseToken=%.20s...", premium, purchaseToken)
	}
	return nil
}
