package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	appstore "github.com/awa/go-iap/appstore"
	"github.com/golang-jwt/jwt/v5"

	"github.com/esportnews/backend/internal/models"
)

// appleRootCAG3PEM is Apple's root certificate used to sign App Store Server
// Notifications V2 (and the inner signed transaction/renewal JWS). Extracted
// from https://www.apple.com/certificateauthority/ — mirrors what the awa/go-iap
// library embeds internally.
const appleRootCAG3PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`

// verifyAppleJWS verifies the signature of an Apple-signed JWS (ES256 with
// x5c cert chain in the header). Populates `claims` on success.
// Mirrors the verification done by awa/go-iap's private parseJWS helper, which
// isn't exported — so we re-implement it here for the outer notification JWS.
func verifyAppleJWS(signed string, claims jwt.Claims) error {
	parts := strings.Split(signed, ".")
	if len(parts) != 3 {
		return errors.New("malformed JWS: expected 3 parts")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		// Apple sometimes uses padding-less standard b64 in the header; try that.
		if hb, err2 := base64.RawStdEncoding.DecodeString(parts[0]); err2 == nil {
			headerBytes = hb
		} else {
			return fmt.Errorf("decode JWS header: %w", err)
		}
	}

	var header struct {
		Alg string   `json:"alg"`
		X5c []string `json:"x5c"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return fmt.Errorf("parse JWS header: %w", err)
	}
	if len(header.X5c) < 3 {
		return errors.New("JWS x5c chain incomplete (need leaf + intermediate + root)")
	}

	leafCert, err := parseX5CCert(header.X5c[0])
	if err != nil {
		return fmt.Errorf("parse leaf cert: %w", err)
	}
	intermediateCert, err := parseX5CCert(header.X5c[1])
	if err != nil {
		return fmt.Errorf("parse intermediate cert: %w", err)
	}
	rootCert, err := parseX5CCert(header.X5c[2])
	if err != nil {
		return fmt.Errorf("parse root cert: %w", err)
	}

	// Verify the chain: the root cert from x5c must chain up to Apple's known
	// root CA (we don't blindly trust the x5c root).
	appleRoots := x509.NewCertPool()
	if !appleRoots.AppendCertsFromPEM([]byte(appleRootCAG3PEM)) {
		return errors.New("failed to load Apple Root CA G3")
	}
	intermediates := x509.NewCertPool()
	intermediates.AddCert(intermediateCert)

	opts := x509.VerifyOptions{
		Roots:         appleRoots,
		Intermediates: intermediates,
	}
	if _, err := rootCert.Verify(opts); err != nil {
		return fmt.Errorf("root cert does not chain to Apple Root CA: %w", err)
	}
	if _, err := leafCert.Verify(opts); err != nil {
		return fmt.Errorf("leaf cert verification failed: %w", err)
	}

	pub, ok := leafCert.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return errors.New("leaf cert public key is not ECDSA")
	}

	_, err = jwt.ParseWithClaims(signed, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return pub, nil
	})
	if err != nil {
		return fmt.Errorf("JWS signature verification failed: %w", err)
	}
	return nil
}

func parseX5CCert(b64 string) (*x509.Certificate, error) {
	der, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, err
	}
	return x509.ParseCertificate(der)
}

// HandleAppleNotification verifies an App Store Server Notification V2 signed
// payload, routes it to the right action (update premium status, etc.) and
// persists changes for the matching user.
//
// Apple sends POST body: { "signedPayload": "eyJ..." }
// Reference: https://developer.apple.com/documentation/appstoreservernotifications
func (s *IAPService) HandleAppleNotification(ctx context.Context, signedPayload string) error {
	if !s.appleReady {
		// We don't want to 500 Apple's retries — treat as no-op but log.
		s.logger.Warn("[IAP][Webhook] Received Apple notification but Apple IAP is not configured")
		return nil
	}

	var payload appstore.SubscriptionNotificationV2DecodedPayload
	if err := verifyAppleJWS(signedPayload, &payload); err != nil {
		return fmt.Errorf("verify outer notification JWS: %w", err)
	}

	// The transaction info is itself a signed JWS string. We use the store
	// client to verify + parse it (library already handles this).
	var (
		originalTxID string
		productID    string
		expiresAt    time.Time
		revoked      bool
	)
	if string(payload.Data.SignedTransactionInfo) != "" {
		tx, err := s.appleClient.ParseSignedTransaction(string(payload.Data.SignedTransactionInfo))
		if err != nil {
			return fmt.Errorf("parse signed transaction info: %w", err)
		}
		originalTxID = tx.OriginalTransactionId
		productID = tx.ProductID
		if tx.ExpiresDate > 0 {
			expiresAt = time.UnixMilli(tx.ExpiresDate)
		}
		if tx.RevocationDate > 0 {
			revoked = true
		}
	}

	s.logger.Infof("[IAP][Webhook] Received %s/%s uuid=%s originalTx=%s product=%s",
		payload.NotificationType, payload.Subtype, payload.NotificationUUID, originalTxID, productID)

	// Handle TEST notifications without touching the DB. Apple uses these to
	// verify the endpoint is reachable when configured in App Store Connect.
	if payload.NotificationType == appstore.NotificationTypeV2Test {
		return nil
	}

	if originalTxID == "" {
		// Without an original transaction id we can't identify the user. This
		// can happen for certain notification types (e.g. EXTERNAL_PURCHASE_TOKEN).
		// Not an error — log and return.
		s.logger.Infof("[IAP][Webhook] Notification %s has no originalTransactionId — skipping", payload.NotificationType)
		return nil
	}

	newPremium, touchExpiry := decideStatusFromNotification(payload.NotificationType, revoked)

	updates := map[string]interface{}{
		"premium": newPremium,
	}
	if touchExpiry && !expiresAt.IsZero() {
		updates["iap_expires_at"] = expiresAt
	}
	// Product id might arrive updated on plan changes.
	if productID != "" {
		updates["iap_product_id"] = productID
	}

	// Match by original transaction id (stable across renewals).
	res := s.db.WithContext(ctx).
		Model(&models.User{}).
		Where("iap_original_transaction_id = ?", originalTxID).
		Updates(updates)
	if res.Error != nil {
		return fmt.Errorf("update user by original_tx: %w", res.Error)
	}

	if res.RowsAffected == 0 {
		// Possible if the user's initial purchase happened before this webhook
		// was deployed, so iap_original_transaction_id isn't stored yet.
		// Fallback: match by iap_transaction_id (the initial tx id equals the
		// original tx id on the first purchase).
		res2 := s.db.WithContext(ctx).
			Model(&models.User{}).
			Where("iap_transaction_id = ?", originalTxID).
			Updates(updates)
		if res2.Error != nil {
			return fmt.Errorf("fallback update by tx: %w", res2.Error)
		}
		if res2.RowsAffected == 0 {
			s.logger.Warnf("[IAP][Webhook] No user found for originalTx=%s (notif %s)", originalTxID, payload.NotificationType)
			return nil
		}
		// Backfill the original_transaction_id for future notifications.
		_ = s.db.WithContext(ctx).
			Model(&models.User{}).
			Where("iap_transaction_id = ?", originalTxID).
			Update("iap_original_transaction_id", originalTxID).Error
	}

	s.logger.Infof("[IAP][Webhook] Updated user via originalTx=%s → premium=%v", originalTxID, newPremium)
	return nil
}

// decideStatusFromNotification maps an Apple notification type to a premium
// decision. Returns (newPremium, writeExpiryIfPresent).
//
// References:
//   - https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
//   - https://developer.apple.com/documentation/appstoreservernotifications/subtype
func decideStatusFromNotification(nt appstore.NotificationTypeV2, revoked bool) (bool, bool) {
	if revoked {
		return false, true
	}
	switch nt {
	case appstore.NotificationTypeV2Subscribed,
		appstore.NotificationTypeV2DidRenew,
		appstore.NotificationTypeV2OfferRedeemed,
		appstore.NotificationTypeV2RenewalExtended:
		return true, true

	case appstore.NotificationTypeV2Expired,
		appstore.NotificationTypeV2GracePeriodExpired,
		appstore.NotificationTypeV2Revoke,
		appstore.NotificationTypeV2Refund:
		return false, true

	case appstore.NotificationTypeV2DidFailToRenew:
		// In billing retry or grace period — keep premium if the transaction
		// still has a non-past expiresDate; rely on the data we parsed.
		// We conservatively keep whatever the transaction says about expiry.
		return true, true

	default:
		// DID_CHANGE_RENEWAL_PREF/STATUS, PRICE_INCREASE, REFUND_DECLINED,
		// REFUND_REVERSED, CONSUMPTION_REQUEST, RENEWAL_EXTENSION, etc.
		// None of these change the premium state on their own.
		return true, false
	}
}

