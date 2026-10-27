package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/api/androidpublisher/v3"
)

// testGoogleKeyJSON builds a syntactically valid service-account key file.
func testGoogleKeyJSON(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	doc := map[string]string{
		"type":           "service_account",
		"project_id":     "esportnews-test",
		"private_key_id": "abc123",
		"private_key":    string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})),
		"client_email":   "play-billing@esportnews-test.iam.gserviceaccount.com",
		"client_id":      "1",
		"token_uri":      "https://oauth2.googleapis.com/token",
	}
	b, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestLoadGoogleKey_InlineWinsOverPath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sa.json")
	if err := os.WriteFile(path, []byte(`{"from":"file"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	data, src := LoadGoogleKey(&IAPConfig{GoogleKeyContent: ` {"from":"inline"} `, GoogleKeyPath: path})
	if src != "inline" || string(data) != `{"from":"inline"}` {
		t.Fatalf("got source=%q data=%q", src, data)
	}
}

func TestLoadGoogleKey_PathFallbackAndNone(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sa.json")
	if err := os.WriteFile(path, []byte(`{"from":"file"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if data, src := LoadGoogleKey(&IAPConfig{GoogleKeyPath: path}); src != "file:"+path || string(data) != `{"from":"file"}` {
		t.Fatalf("got source=%q data=%q", src, data)
	}
	// Railway's image ships no files: an unreachable path must mean "no key".
	if data, src := LoadGoogleKey(&IAPConfig{GoogleKeyPath: "/nonexistent/sa.json"}); data != nil || src != "none" {
		t.Fatalf("got source=%q data=%q", src, data)
	}
}

func TestNewIAPService_GoogleReadyWithInlineKey(t *testing.T) {
	// playstore.New fetches an OAuth token from Google on construction; keep the
	// test offline by stubbing the constructor and only checking what it is fed.
	orig := newGooglePlayClient
	t.Cleanup(func() { newGooglePlayClient = orig })
	var fed []byte
	newGooglePlayClient = func(jsonKey []byte) (googlePlayClient, error) {
		fed = jsonKey
		return &fakePlay{}, nil
	}
	logger, logs := silentLogger()
	keyJSON := testGoogleKeyJSON(t)
	s := NewIAPService(nil, logger, &IAPConfig{GoogleKeyContent: keyJSON, GooglePackage: "com.esportnewsapp.mobile"})
	if string(fed) != keyJSON {
		t.Fatal("the inline key must be handed to the Play client untouched")
	}
	if s.googlePlay == nil {
		t.Fatalf("Google Play client should be ready; logs:\n%s", logs.String())
	}
	if !strings.Contains(logs.String(), "Google Play validation ready (key source: inline") {
		t.Fatalf("boot log should name the key source; logs:\n%s", logs.String())
	}
}

func TestNewIAPService_GoogleDisabledOnUnusableKey(t *testing.T) {
	// The client is built without contacting Google, so only a key that is not
	// a service-account document is rejected here; bad credentials surface per call.
	logger, logs := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{GoogleKeyContent: `{"type":"authorized_user"}`})
	if s.googlePlay != nil {
		t.Fatal("a non service-account key must not enable Google Play")
	}
	if !strings.Contains(logs.String(), "Cannot init Google Play client") {
		t.Fatalf("expected init warning; logs:\n%s", logs.String())
	}
	logger, logs = silentLogger()
	s = NewIAPService(nil, logger, &IAPConfig{})
	if s.googlePlay != nil || !strings.Contains(logs.String(), "Google key not provided") {
		t.Fatalf("missing key must disable Google with a warning; logs:\n%s", logs.String())
	}
}

// --- validation ------------------------------------------------------------

type fakePlay struct {
	resp  *androidpublisher.SubscriptionPurchaseV2
	err   error
	calls []string
}

func (f *fakePlay) VerifySubscriptionV2(_ context.Context, pkg, token string) (*androidpublisher.SubscriptionPurchaseV2, error) {
	f.calls = append(f.calls, pkg+"|"+token)
	if f.resp == nil && f.err == nil {
		return nil, fmt.Errorf("fake: no response for %s", token)
	}
	return f.resp, f.err
}

func googleService(play *fakePlay) *IAPService {
	logger, _ := silentLogger()
	return &IAPService{logger: logger, config: &IAPConfig{GooglePackage: "com.esportnewsapp.mobile"}, googlePlay: play}
}

func playResponse(state string, expiry time.Time) *androidpublisher.SubscriptionPurchaseV2 {
	return &androidpublisher.SubscriptionPurchaseV2{
		SubscriptionState:    state,
		AcknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
		LineItems:            []*androidpublisher.SubscriptionPurchaseLineItem{{ProductId: "premium_monthly", ExpiryTime: expiry.UTC().Format(time.RFC3339Nano)}},
	}
}

const playToken = "opaque-purchase-token-from-play"

func TestValidateGooglePurchase_ActiveSubscription(t *testing.T) {
	renewsAt := time.Now().Add(25 * 24 * time.Hour).Truncate(time.Millisecond)
	play := &fakePlay{resp: playResponse("SUBSCRIPTION_STATE_ACTIVE", renewsAt)}
	s := googleService(play)

	res, err := s.ValidateGooglePurchase(t.Context(), playToken)
	if err != nil {
		t.Fatal(err)
	}
	if !res.IsValid || res.Status != "active" {
		t.Fatalf("got valid=%v status=%q", res.IsValid, res.Status)
	}
	if !res.ExpiresAt.Equal(renewsAt) {
		t.Fatalf("ExpiresAt = %s, want %s", res.ExpiresAt, renewsAt)
	}
	if res.Platform != "android" || res.ProductID != "premium_monthly" || res.TransactionID != playToken {
		t.Fatalf("got platform=%s product=%s tx=%s", res.Platform, res.ProductID, res.TransactionID)
	}
	if len(play.calls) != 1 || play.calls[0] != "com.esportnewsapp.mobile|"+playToken {
		t.Fatalf("Play lookups = %v", play.calls)
	}
}

func TestValidateGooglePurchase_StateMapping(t *testing.T) {
	future := time.Now().Add(10 * 24 * time.Hour)
	past := time.Now().Add(-time.Hour)
	cases := []struct {
		name       string
		state      string
		expiry     time.Time
		wantValid  bool
		wantStatus string
	}{
		{"canceled but paid period still running keeps access", "SUBSCRIPTION_STATE_CANCELED", future, true, "canceled"},
		{"canceled and period over", "SUBSCRIPTION_STATE_CANCELED", past, false, "canceled"},
		{"grace period keeps access", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", future, true, "grace_period"},
		{"on hold", "SUBSCRIPTION_STATE_ON_HOLD", past, false, "on_hold"},
		{"paused", "SUBSCRIPTION_STATE_PAUSED", future, false, "paused"},
		{"expired", "SUBSCRIPTION_STATE_EXPIRED", past, false, "expired"},
		{"pending payment", "SUBSCRIPTION_STATE_PENDING", future, false, "payment_pending"},
		{"pending purchase canceled", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED", future, false, "canceled"},
		{"unspecified", "SUBSCRIPTION_STATE_UNSPECIFIED", future, false, "unknown"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := googleService(&fakePlay{resp: playResponse(tc.state, tc.expiry)})
			res, err := s.ValidateGooglePurchase(t.Context(), playToken)
			if err != nil {
				t.Fatal(err)
			}
			if res.IsValid != tc.wantValid || res.Status != tc.wantStatus {
				t.Fatalf("got valid=%v status=%q, want valid=%v status=%q", res.IsValid, res.Status, tc.wantValid, tc.wantStatus)
			}
		})
	}
}

func TestValidateGooglePurchase_ActiveButExpiryElapsedIsNotValid(t *testing.T) {
	// Defensive against a stale ACTIVE: the paid period is the truth we store.
	s := googleService(&fakePlay{resp: playResponse("SUBSCRIPTION_STATE_ACTIVE", time.Now().Add(-time.Minute))})
	res, err := s.ValidateGooglePurchase(t.Context(), playToken)
	if err != nil {
		t.Fatal(err)
	}
	if res.IsValid {
		t.Fatal("an elapsed expiry must not grant access")
	}
}

func TestValidateGooglePurchase_NoLineItemsLeavesProductAndExpiryEmpty(t *testing.T) {
	// UpdateUserIAPStatus skips empty values, so nothing stored gets erased.
	s := googleService(&fakePlay{resp: &androidpublisher.SubscriptionPurchaseV2{SubscriptionState: "SUBSCRIPTION_STATE_EXPIRED"}})
	res, err := s.ValidateGooglePurchase(t.Context(), playToken)
	if err != nil {
		t.Fatal(err)
	}
	if res.ProductID != "" || !res.ExpiresAt.IsZero() || res.IsValid {
		t.Fatalf("got product=%q expires=%s valid=%v", res.ProductID, res.ExpiresAt, res.IsValid)
	}
}

func TestValidateGooglePurchase_CarriesTheLinkedToken(t *testing.T) {
	// Resubscription or plan change: Play issues a new token linked to the old
	// one, which is what the user row still carries.
	resp := playResponse("SUBSCRIPTION_STATE_ACTIVE", time.Now().Add(24*time.Hour))
	resp.LinkedPurchaseToken = "previous-token"
	res, err := googleService(&fakePlay{resp: resp}).ValidateGooglePurchase(t.Context(), playToken)
	if err != nil {
		t.Fatal(err)
	}
	if res.PreviousTransactionID != "previous-token" || res.TransactionID != playToken {
		t.Fatalf("got tx=%s previous=%s", res.TransactionID, res.PreviousTransactionID)
	}
}

func TestGoogleTerminalNotifications(t *testing.T) {
	// CANCELED only turns auto-renew off: the paid period keeps running, so it
	// must go through validation instead of cutting access on the spot.
	for _, terminal := range []int{rtdnRevoked, rtdnExpired, rtdnOnHold} {
		if !isGoogleTerminalNotification(terminal) {
			t.Fatalf("type %d must end access immediately", terminal)
		}
	}
	for _, live := range []int{rtdnCanceled, rtdnRenewed, rtdnPurchased, rtdnInGracePeriod, rtdnRecovered, rtdnRestarted, rtdnPaused} {
		if isGoogleTerminalNotification(live) {
			t.Fatalf("type %d must be re-validated, not cut", live)
		}
	}
}

func TestValidateGooglePurchase_ApiErrorSurfaces(t *testing.T) {
	s := googleService(&fakePlay{err: fmt.Errorf("googleapi: Error 400: Invalid purchase token")})
	if _, err := s.ValidateGooglePurchase(t.Context(), playToken); err == nil {
		t.Fatal("expected the Play API error to surface")
	}
}

func TestValidateGooglePurchase_NotConfigured(t *testing.T) {
	logger, _ := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{})
	if _, err := s.ValidateGooglePurchase(t.Context(), playToken); err == nil {
		t.Fatal("expected error when Google IAP is not configured")
	}
}
