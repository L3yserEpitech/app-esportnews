package services

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/awa/go-iap/appstore/api"
	"github.com/sirupsen/logrus"
)

func testAppleKeyPEM(t *testing.T) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

func silentLogger() (*logrus.Logger, *strings.Builder) {
	var buf strings.Builder
	l := logrus.New()
	l.SetOutput(io.MultiWriter(&buf))
	return l, &buf
}

func TestLoadAppleKey_InlineEscapedNewlines(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	// Railway stores the key as a single line with literal "\n" sequences.
	escaped := strings.ReplaceAll(strings.TrimSpace(pemKey), "\n", `\n`)
	if strings.Contains(escaped, "\n") {
		t.Fatal("test setup: escaped key must not contain real newlines")
	}

	data, src := LoadAppleKey(&IAPConfig{AppleKeyContent: escaped})
	if src != "inline" {
		t.Fatalf("source = %q, want inline", src)
	}
	block, _ := pem.Decode(data)
	if block == nil {
		t.Fatal("pem.Decode failed on un-escaped inline key")
	}
	if _, err := x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
		t.Fatalf("key does not parse after un-escaping: %v", err)
	}
}

func TestLoadAppleKey_InlineRealNewlines(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	data, src := LoadAppleKey(&IAPConfig{AppleKeyContent: pemKey})
	if src != "inline" {
		t.Fatalf("source = %q, want inline", src)
	}
	if block, _ := pem.Decode(data); block == nil {
		t.Fatal("pem.Decode failed on multi-line inline key")
	}
}

func TestLoadAppleKey_InlineTakesPrecedenceOverPath(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	path := filepath.Join(t.TempDir(), "other.p8")
	if err := os.WriteFile(path, []byte("garbage"), 0o600); err != nil {
		t.Fatal(err)
	}
	data, src := LoadAppleKey(&IAPConfig{AppleKeyContent: pemKey, AppleKeyPath: path})
	if src != "inline" || string(data) != strings.TrimSpace(pemKey) {
		t.Fatalf("inline content should win over path, got source=%q", src)
	}
}

func TestLoadAppleKey_PathFallback(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	path := filepath.Join(t.TempDir(), "AuthKey.p8")
	if err := os.WriteFile(path, []byte(pemKey), 0o600); err != nil {
		t.Fatal(err)
	}
	data, src := LoadAppleKey(&IAPConfig{AppleKeyPath: path})
	if src != "file:"+path || string(data) != pemKey {
		t.Fatalf("expected file source, got %q", src)
	}
}

func TestLoadAppleKey_MissingPathAndContent(t *testing.T) {
	// Railway's image copies only the binary: a KEY_PATH pointing at keys/*.p8
	// does not exist at runtime and must yield "no key", not a panic.
	data, src := LoadAppleKey(&IAPConfig{AppleKeyPath: "/nonexistent/keys/AuthKey.p8"})
	if data != nil || src != "none" {
		t.Fatalf("expected no key, got source=%q data=%q", src, data)
	}
}

func TestNewIAPService_AppleReadyWithInlineEscapedKey(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	escaped := strings.ReplaceAll(strings.TrimSpace(pemKey), "\n", `\n`)
	logger, logs := silentLogger()

	s := NewIAPService(nil, logger, &IAPConfig{
		AppleKeyContent: escaped,
		AppleKeyID:      "ABC123DEFG",
		AppleIssuerID:   "00000000-0000-0000-0000-000000000000",
		AppleBundleID:   "com.esportnews-app.mobile",
	})
	if s.appleProd == nil {
		t.Fatalf("Apple IAP should be ready; logs:\n%s", logs.String())
	}
	if s.appleProd == nil || s.appleSandbox == nil {
		t.Fatal("production and sandbox clients must be initialised")
	}
	if !strings.Contains(logs.String(), "key source: inline") {
		t.Fatalf("boot log should name the key source; logs:\n%s", logs.String())
	}
}

func TestNewIAPService_AppleDisabledWhenKeyTruncated(t *testing.T) {
	// `railway variables --set` truncates multi-line values at the first newline:
	// only the PEM header survives. The service must disable Apple, not crash.
	logger, logs := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{
		AppleKeyContent: "-----BEGIN PRIVATE KEY-----",
		AppleKeyID:      "ABC123DEFG",
		AppleIssuerID:   "00000000-0000-0000-0000-000000000000",
	})
	if s.appleProd != nil {
		t.Fatal("truncated key must not mark Apple as ready")
	}
	if !strings.Contains(logs.String(), "Cannot decode Apple PEM key") {
		t.Fatalf("expected PEM decode warning; logs:\n%s", logs.String())
	}
}

func TestNewIAPService_AppleDisabledWhenConfigIncomplete(t *testing.T) {
	pemKey := testAppleKeyPEM(t)
	logger, logs := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{AppleKeyContent: pemKey, AppleKeyID: "ABC123DEFG"})
	if s.appleProd != nil {
		t.Fatal("missing issuer must disable Apple")
	}
	if !strings.Contains(logs.String(), "config incomplete") {
		t.Fatalf("expected incomplete-config warning; logs:\n%s", logs.String())
	}
}

func TestNewIAPService_AppleDisabledWhenNoKey(t *testing.T) {
	logger, logs := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{AppleKeyID: "ABC123DEFG", AppleIssuerID: "x"})
	if s.appleProd != nil {
		t.Fatal("no key must disable Apple")
	}
	if !strings.Contains(logs.String(), "Apple key not provided") {
		t.Fatalf("expected missing-key warning; logs:\n%s", logs.String())
	}
}

// --- Subscription revalidation (follows renewals) ---------------------------

type fakeAppleStatuses struct {
	resp  *api.StatusResponse
	err   error
	calls []string

	info      *api.TransactionInfoResponse
	infoErr   error
	infoCalls []string
}

func (f *fakeAppleStatuses) GetALLSubscriptionStatuses(_ context.Context, id string, _ *url.Values) (*api.StatusResponse, error) {
	f.calls = append(f.calls, id)
	return f.resp, f.err
}

func (f *fakeAppleStatuses) GetTransactionInfo(_ context.Context, id string) (*api.TransactionInfoResponse, error) {
	f.infoCalls = append(f.infoCalls, id)
	if f.info == nil && f.infoErr == nil {
		return nil, fmt.Errorf("fake: no transaction info for %s", id)
	}
	return f.info, f.infoErr
}

func statusResponse(items ...api.LastTransactionsItem) *api.StatusResponse {
	return &api.StatusResponse{Data: []api.SubscriptionGroupIdentifierItem{{
		SubscriptionGroupIdentifier: "21918940",
		LastTransactions:            items,
	}}}
}

func subscriptionService(prod, sandbox *fakeAppleStatuses, txs map[string]*api.JWSTransaction) *IAPService {
	return subscriptionServiceWithRenewals(prod, sandbox, txs, nil)
}

func subscriptionServiceWithRenewals(prod, sandbox *fakeAppleStatuses, txs map[string]*api.JWSTransaction, renewals map[string]*api.JWSRenewalInfoDecodedPayload) *IAPService {
	logger, _ := silentLogger()
	return &IAPService{
		logger:       logger,
		appleProd:    prod,
		appleSandbox: sandbox,
		parseAppleTx: func(signed string) (*api.JWSTransaction, error) {
			tx, ok := txs[signed]
			if !ok {
				return nil, fmt.Errorf("unknown signed payload %q", signed)
			}
			return tx, nil
		},
		parseAppleRenewal: func(signed string) (*api.JWSRenewalInfoDecodedPayload, error) {
			r, ok := renewals[signed]
			if !ok {
				return nil, fmt.Errorf("unknown signed renewal %q", signed)
			}
			return r, nil
		},
	}
}

const (
	originalTx = "2000001245545691"
	renewalTx  = "2000001245999999"
)

func TestValidateAppleSubscription_FollowsRenewals(t *testing.T) {
	// Regression: the original transaction expired on day 1, but Apple renewed
	// the subscription since. The current state must come from the LATEST
	// transaction, not from the original one.
	renewedUntil := time.Now().Add(20 * 24 * time.Hour).Truncate(time.Millisecond)
	prod := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
		OriginalTransactionId: originalTx,
		Status:                api.SubscriptionActive,
		SignedTransactionInfo: "latest",
	})}
	s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
		"latest": {
			TransactionID:         renewalTx,
			OriginalTransactionId: originalTx,
			ProductID:             "13801972972",
			ExpiresDate:           renewedUntil.UnixMilli(),
		},
	})

	res, err := s.ValidateAppleSubscription(t.Context(), originalTx)
	if err != nil {
		t.Fatal(err)
	}
	if !res.IsValid || res.Status != "active" {
		t.Fatalf("renewed subscription must be valid/active, got valid=%v status=%q", res.IsValid, res.Status)
	}
	if !res.ExpiresAt.Equal(renewedUntil) {
		t.Fatalf("ExpiresAt = %s, want the renewal's %s", res.ExpiresAt, renewedUntil)
	}
	if res.TransactionID != renewalTx || res.OriginalTransactionID != originalTx {
		t.Fatalf("ids = (%s, %s), want (%s, %s)", res.TransactionID, res.OriginalTransactionID, renewalTx, originalTx)
	}
	if res.Platform != "ios" || res.ProductID != "13801972972" {
		t.Fatalf("platform/product = %s/%s", res.Platform, res.ProductID)
	}
	if len(prod.calls) != 1 || prod.calls[0] != originalTx {
		t.Fatalf("production lookups = %v, want one lookup of %s", prod.calls, originalTx)
	}
}

func TestValidateAppleSubscription_StatusMapping(t *testing.T) {
	past := time.Now().Add(-time.Hour).UnixMilli()
	cases := []struct {
		name       string
		status     api.AutoRenewSubscriptionStatus
		revokedAt  int64
		wantValid  bool
		wantStatus string
	}{
		{"expired", api.SubscriptionExpired, 0, false, "expired"},
		{"billing retry", api.SubscriptionRetryPeriod, 0, false, "billing_retry"},
		{"grace period keeps access", api.SubscriptionGracePeriod, 0, true, "grace_period"},
		{"revoked status", api.SubscriptionRevoked, 0, false, "revoked"},
		{"active but refunded mid-period", api.SubscriptionActive, past, false, "revoked"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			prod := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
				OriginalTransactionId: originalTx, Status: tc.status, SignedTransactionInfo: "tx",
			})}
			s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
				"tx": {TransactionID: renewalTx, OriginalTransactionId: originalTx, ExpiresDate: time.Now().Add(20 * 24 * time.Hour).UnixMilli(), RevocationDate: tc.revokedAt},
			})
			res, err := s.ValidateAppleSubscription(t.Context(), originalTx)
			if err != nil {
				t.Fatal(err)
			}
			if res.IsValid != tc.wantValid || res.Status != tc.wantStatus {
				t.Fatalf("got valid=%v status=%q, want valid=%v status=%q", res.IsValid, res.Status, tc.wantValid, tc.wantStatus)
			}
			if tc.revokedAt > 0 && !res.ExpiresAt.Equal(time.UnixMilli(tc.revokedAt)) {
				t.Fatalf("a refund must end access at the revocation date, got ExpiresAt=%s", res.ExpiresAt)
			}
		})
	}
}

func TestValidateAppleSubscription_FallsBackToSandboxWhenUnknownInProduction(t *testing.T) {
	for _, notFound := range []error{api.OriginalTransactionIdNotFoundError, api.TransactionIdNotFoundError} {
		prod := &fakeAppleStatuses{err: notFound}
		sandbox := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
			OriginalTransactionId: originalTx, Status: api.SubscriptionActive, SignedTransactionInfo: "sb",
		})}
		s := subscriptionService(prod, sandbox, map[string]*api.JWSTransaction{
			"sb": {TransactionID: originalTx, OriginalTransactionId: originalTx, ExpiresDate: time.Now().Add(time.Hour).UnixMilli()},
		})
		res, err := s.ValidateAppleSubscription(t.Context(), originalTx)
		if err != nil {
			t.Fatalf("%v: %v", notFound, err)
		}
		if !res.IsValid || len(sandbox.calls) != 1 {
			t.Fatalf("%v: expected a successful sandbox lookup, got valid=%v sandbox calls=%v", notFound, res.IsValid, sandbox.calls)
		}
	}
}

func TestValidateAppleSubscription_OtherProductionErrorsDoNotFallBack(t *testing.T) {
	prod := &fakeAppleStatuses{err: api.RateLimitExceededError}
	sandbox := &fakeAppleStatuses{}
	s := subscriptionService(prod, sandbox, nil)
	if _, err := s.ValidateAppleSubscription(t.Context(), originalTx); err == nil {
		t.Fatal("expected the production error to surface")
	}
	if len(sandbox.calls) != 0 {
		t.Fatalf("sandbox must not be queried on a non-404 error, calls=%v", sandbox.calls)
	}
}

func TestValidateAppleSubscription_PicksTheMatchingSubscriptionInAGroup(t *testing.T) {
	prod := &fakeAppleStatuses{resp: statusResponse(
		api.LastTransactionsItem{OriginalTransactionId: "111", Status: api.SubscriptionExpired, SignedTransactionInfo: "old"},
		api.LastTransactionsItem{OriginalTransactionId: originalTx, Status: api.SubscriptionActive, SignedTransactionInfo: "mine"},
	)}
	future := time.Now().Add(time.Hour).UnixMilli()
	s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
		"old":  {TransactionID: "111", OriginalTransactionId: "111", ExpiresDate: future},
		"mine": {TransactionID: renewalTx, OriginalTransactionId: originalTx, ExpiresDate: future},
	})
	res, err := s.ValidateAppleSubscription(t.Context(), originalTx)
	if err != nil {
		t.Fatal(err)
	}
	if res.OriginalTransactionID != originalTx || !res.IsValid {
		t.Fatalf("picked %s (valid=%v), want %s", res.OriginalTransactionID, res.IsValid, originalTx)
	}
}

func TestValidateAppleSubscription_RenewalIdResolvesSingleSubscription(t *testing.T) {
	// Looked up by a renewal transaction id: no lastTransactions entry carries
	// that id as originalTransactionId, but a single entry is unambiguous.
	prod := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
		OriginalTransactionId: originalTx, Status: api.SubscriptionActive, SignedTransactionInfo: "tx",
	})}
	s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
		"tx": {TransactionID: renewalTx, OriginalTransactionId: originalTx, ExpiresDate: time.Now().Add(time.Hour).UnixMilli()},
	})
	res, err := s.ValidateAppleSubscription(t.Context(), renewalTx)
	if err != nil {
		t.Fatal(err)
	}
	if res.OriginalTransactionID != originalTx {
		t.Fatalf("OriginalTransactionID = %s, want %s", res.OriginalTransactionID, originalTx)
	}
}

func twoSubscriptions() *api.StatusResponse {
	return statusResponse(
		api.LastTransactionsItem{OriginalTransactionId: "111", Status: api.SubscriptionExpired, SignedTransactionInfo: "a"},
		api.LastTransactionsItem{OriginalTransactionId: "222", Status: api.SubscriptionActive, SignedTransactionInfo: "b"},
	)
}

func TestValidateAppleSubscription_RenewalIdAmongSeveralSubscriptionsResolvesViaTransactionInfo(t *testing.T) {
	// Looked up by a renewal id with two subscriptions in the group: the only
	// way to know which one the id belongs to is to ask Apple for that
	// transaction and read its originalTransactionId.
	prod := &fakeAppleStatuses{resp: twoSubscriptions(), info: &api.TransactionInfoResponse{SignedTransactionInfo: "info"}}
	future := time.Now().Add(time.Hour).UnixMilli()
	s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
		"a":    {TransactionID: "111", OriginalTransactionId: "111"},
		"b":    {TransactionID: "222-latest", OriginalTransactionId: "222", ExpiresDate: future},
		"info": {TransactionID: renewalTx, OriginalTransactionId: "222"},
	})
	res, err := s.ValidateAppleSubscription(t.Context(), renewalTx)
	if err != nil {
		t.Fatal(err)
	}
	if res.OriginalTransactionID != "222" || res.TransactionID != "222-latest" || !res.IsValid {
		t.Fatalf("got original=%s tx=%s valid=%v, want the 222 subscription's latest transaction", res.OriginalTransactionID, res.TransactionID, res.IsValid)
	}
	if len(prod.infoCalls) != 1 || prod.infoCalls[0] != renewalTx {
		t.Fatalf("transaction info lookups = %v, want one lookup of %s", prod.infoCalls, renewalTx)
	}
}

func TestValidateAppleSubscription_FollowUpLookupStaysInTheEnvironmentThatAnswered(t *testing.T) {
	// Sandbox listed the subscriptions, so the renewal id can only be known
	// there: no production round-trip for the follow-up transaction lookup.
	prod := &fakeAppleStatuses{err: api.OriginalTransactionIdNotFoundError, infoErr: api.RateLimitExceededError}
	sandbox := &fakeAppleStatuses{resp: twoSubscriptions(), info: &api.TransactionInfoResponse{SignedTransactionInfo: "info"}}
	s := subscriptionService(prod, sandbox, map[string]*api.JWSTransaction{
		"b":    {TransactionID: "222-latest", OriginalTransactionId: "222", ExpiresDate: time.Now().Add(time.Hour).UnixMilli()},
		"info": {TransactionID: renewalTx, OriginalTransactionId: "222"},
	})
	res, err := s.ValidateAppleSubscription(t.Context(), renewalTx)
	if err != nil {
		t.Fatal(err)
	}
	if res.OriginalTransactionID != "222" || len(prod.infoCalls) != 0 || len(sandbox.infoCalls) != 1 {
		t.Fatalf("got original=%s prod info calls=%v sandbox info calls=%v", res.OriginalTransactionID, prod.infoCalls, sandbox.infoCalls)
	}
}

func TestValidateAppleSubscription_UnresolvableIdIsAnError(t *testing.T) {
	// Transaction info names a subscription Apple did not list: never guess.
	prod := &fakeAppleStatuses{resp: twoSubscriptions(), info: &api.TransactionInfoResponse{SignedTransactionInfo: "info"}}
	s := subscriptionService(prod, &fakeAppleStatuses{}, map[string]*api.JWSTransaction{
		"info": {TransactionID: renewalTx, OriginalTransactionId: "999"},
	})
	if _, err := s.ValidateAppleSubscription(t.Context(), renewalTx); err == nil {
		t.Fatal("expected an error when no listed subscription matches")
	}

	empty := &fakeAppleStatuses{resp: &api.StatusResponse{}}
	s = subscriptionService(empty, &fakeAppleStatuses{}, nil)
	if _, err := s.ValidateAppleSubscription(t.Context(), originalTx); err == nil {
		t.Fatal("empty statuses response must be an error")
	}
}

func TestValidateAppleSubscription_GracePeriodUsesGracePeriodEnd(t *testing.T) {
	billingFailedAt := time.Now().Add(-2 * 24 * time.Hour).Truncate(time.Millisecond)
	graceEnds := time.Now().Add(14 * 24 * time.Hour).Truncate(time.Millisecond)
	prod := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
		OriginalTransactionId: originalTx, Status: api.SubscriptionGracePeriod,
		SignedTransactionInfo: "tx", SignedRenewalInfo: "renewal",
	})}
	s := subscriptionServiceWithRenewals(prod, &fakeAppleStatuses{},
		map[string]*api.JWSTransaction{"tx": {TransactionID: renewalTx, OriginalTransactionId: originalTx, ExpiresDate: billingFailedAt.UnixMilli()}},
		map[string]*api.JWSRenewalInfoDecodedPayload{"renewal": {GracePeriodExpiresDate: graceEnds.UnixMilli()}},
	)
	res, err := s.ValidateAppleSubscription(t.Context(), originalTx)
	if err != nil {
		t.Fatal(err)
	}
	if !res.IsValid || res.Status != "grace_period" {
		t.Fatalf("grace period must keep access, got valid=%v status=%q", res.IsValid, res.Status)
	}
	if !res.ExpiresAt.Equal(graceEnds) {
		t.Fatalf("ExpiresAt = %s, want the grace period end %s", res.ExpiresAt, graceEnds)
	}
}

func TestValidateAppleSubscription_ParseFailureSurfaces(t *testing.T) {
	prod := &fakeAppleStatuses{resp: statusResponse(api.LastTransactionsItem{
		OriginalTransactionId: originalTx, Status: api.SubscriptionActive, SignedTransactionInfo: "garbage",
	})}
	s := subscriptionService(prod, &fakeAppleStatuses{}, nil)
	if _, err := s.ValidateAppleSubscription(t.Context(), originalTx); err == nil {
		t.Fatal("expected parse error")
	}
}

func TestValidateAppleSubscription_NotConfigured(t *testing.T) {
	logger, _ := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{})
	if _, err := s.ValidateAppleSubscription(t.Context(), originalTx); err == nil {
		t.Fatal("expected error when Apple IAP is not configured")
	}
}

func TestNewIAPService_WiresAppleClients(t *testing.T) {
	logger, _ := silentLogger()
	s := NewIAPService(nil, logger, &IAPConfig{
		AppleKeyContent: testAppleKeyPEM(t), AppleKeyID: "ABC123DEFG", AppleIssuerID: "issuer",
	})
	if s.appleProd == nil || s.appleSandbox == nil || s.parseAppleTx == nil || s.parseAppleRenewal == nil {
		t.Fatal("production/sandbox clients and JWS parsers must be wired when Apple is ready")
	}
}
