// iapdiag queries the App Store Server API to diagnose App Store Server
// Notifications delivery: it lists the notifications Apple tried to send us
// (with each delivery attempt's result) and can trigger a TEST notification.
//
// Run with the production env vars:
//
//	railway run --service app-esportnews -- go run ./cmd/iapdiag [-sandbox] [-days 180] [-test] [-tx id] [-sub id]
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/awa/go-iap/appstore/api"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/config"
	"github.com/esportnews/backend/internal/services"
)

func main() {
	sandbox := flag.Bool("sandbox", false, "query the sandbox environment instead of production")
	days := flag.Int("days", 180, "history window in days (max 180)")
	sendTest := flag.Bool("test", false, "ask Apple to send a TEST notification and report its delivery status")
	txID := flag.String("tx", "", "print Apple's transaction info and subscription statuses for this (original) transaction id")
	subID := flag.String("sub", "", "run IAPService.ValidateAppleSubscription (the scheduler's code path) for this transaction id")
	flag.Parse()

	cfg := config.LoadConfig()
	iapCfg := &services.IAPConfig{
		AppleKeyPath:    cfg.AppleIAPKeyPath,
		AppleKeyContent: cfg.AppleIAPKeyContent,
		AppleKeyID:      cfg.AppleIAPKeyID,
		AppleIssuerID:   cfg.AppleIAPIssuerID,
		AppleBundleID:   cfg.AppleIAPBundleID,
	}
	key, _ := services.LoadAppleKey(iapCfg)
	if key == nil || iapCfg.AppleKeyID == "" || iapCfg.AppleIssuerID == "" {
		fmt.Fprintln(os.Stderr, "APPLE_IAP_KEY_CONTENT (or APPLE_IAP_KEY_PATH), APPLE_IAP_KEY_ID and APPLE_IAP_ISSUER_ID are required")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	if *subID != "" {
		// The service's own code path: production first, sandbox fallback,
		// so -sandbox does not apply here.
		logger := logrus.New()
		logger.SetLevel(logrus.WarnLevel)
		res, err := services.NewIAPService(nil, logger, iapCfg).ValidateAppleSubscription(ctx, *subID)
		if err != nil {
			fmt.Printf("ValidateAppleSubscription error: %v\n", err)
			os.Exit(2)
		}
		fmt.Printf("ValidateAppleSubscription: valid=%v status=%s product=%s tx=%s originalTx=%s expiresAt=%s\n",
			res.IsValid, res.Status, res.ProductID, res.TransactionID, res.OriginalTransactionID, res.ExpiresAt.UTC().Format(time.RFC3339))
		return
	}

	client := api.NewStoreClient(&api.StoreConfig{
		KeyContent: key,
		KeyID:      iapCfg.AppleKeyID,
		BundleID:   iapCfg.AppleBundleID,
		Issuer:     iapCfg.AppleIssuerID,
		Sandbox:    *sandbox,
	})
	env := "production"
	if *sandbox {
		env = "sandbox"
	}
	fmt.Printf("== environment: %s, bundle: %s ==\n", env, iapCfg.AppleBundleID)

	if *sendTest {
		runTest(ctx, client)
		return
	}
	if *txID != "" {
		lookupTx(ctx, client, *txID)
		return
	}

	if *days < 1 || *days > 180 {
		fmt.Fprintln(os.Stderr, "-days must be between 1 and 180 (Apple keeps 180 days of history)")
		os.Exit(1)
	}
	end := time.Now()
	start := end.Add(-time.Duration(*days) * 24 * time.Hour)
	items, err := client.GetAllNotificationHistory(ctx, api.NotificationHistoryRequest{
		StartDate: start.UnixMilli(),
		EndDate:   end.UnixMilli(),
	}, 300*time.Millisecond)
	if err != nil {
		fmt.Printf("history error: %v\n", err)
		os.Exit(2)
	}
	fmt.Printf("notifications in the last %d days: %d\n", *days, len(items))
	for _, it := range items {
		p := decodePayload(it.SignedPayload)
		fmt.Printf("- %s %s/%s originalTx=%s product=%s first=%s attempts=%d",
			p.when, p.ntype, p.subtype, p.originalTx, p.product, it.FirstSendAttemptResult, len(it.SendAttempts))
		for _, a := range it.SendAttempts {
			fmt.Printf(" [%s %s]", time.UnixMilli(a.AttemptDate).UTC().Format("01-02 15:04"), a.SendAttemptResult)
		}
		fmt.Println()
	}
}

type summary struct {
	when, ntype, subtype, originalTx, product string
}

// decodePayload reads the unverified claims of a notification Apple just handed us over its authenticated API.
func decodePayload(signed string) summary {
	var outer struct {
		NotificationType string `json:"notificationType"`
		Subtype          string `json:"subtype"`
		SignedDate       int64  `json:"signedDate"`
		Data             struct {
			SignedTransactionInfo string `json:"signedTransactionInfo"`
			Environment           string `json:"environment"`
		} `json:"data"`
	}
	s := summary{ntype: "?"}
	if err := jwsClaims(signed, &outer); err != nil {
		return s
	}
	s.ntype, s.subtype = outer.NotificationType, outer.Subtype
	s.when = time.UnixMilli(outer.SignedDate).UTC().Format("2006-01-02 15:04")
	var tx struct {
		OriginalTransactionID string `json:"originalTransactionId"`
		ProductID             string `json:"productId"`
	}
	if outer.Data.SignedTransactionInfo != "" && jwsClaims(outer.Data.SignedTransactionInfo, &tx) == nil {
		s.originalTx, s.product = tx.OriginalTransactionID, tx.ProductID
	}
	return s
}

func jwsClaims(signed string, v any) error {
	parts := strings.Split(signed, ".")
	if len(parts) != 3 {
		return fmt.Errorf("malformed JWS")
	}
	b, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func lookupTx(ctx context.Context, client *api.StoreClient, id string) {
	info, err := client.GetTransactionInfo(ctx, id)
	if err != nil {
		fmt.Printf("transaction info error: %v\n", err)
	} else {
		var tx map[string]any
		if err := jwsClaims(info.SignedTransactionInfo, &tx); err == nil {
			for _, k := range []string{"originalTransactionId", "transactionId", "productId", "type", "environment", "storefront", "inAppOwnershipType", "appAccountToken", "offerType", "price", "currency"} {
				if v, ok := tx[k]; ok {
					fmt.Printf("  %-22s %v\n", k, v)
				}
			}
			for _, k := range []string{"originalPurchaseDate", "purchaseDate", "expiresDate", "signedDate", "revocationDate"} {
				if v, ok := tx[k].(float64); ok {
					fmt.Printf("  %-22s %s\n", k, time.UnixMilli(int64(v)).UTC().Format(time.RFC3339))
				}
			}
		}
	}
	statuses, err := client.GetALLSubscriptionStatuses(ctx, id, nil)
	if err != nil {
		fmt.Printf("subscription statuses error: %v\n", err)
		return
	}
	fmt.Printf("subscription statuses: env=%s bundle=%s groups=%d\n", statuses.Environment, statuses.BundleId, len(statuses.Data))
	for _, g := range statuses.Data {
		for _, lt := range g.LastTransactions {
			fmt.Printf("  group=%s originalTx=%s status=%d\n", g.SubscriptionGroupIdentifier, lt.OriginalTransactionId, lt.Status)
		}
	}
}

func runTest(ctx context.Context, client *api.StoreClient) {
	code, body, err := client.SendRequestTestNotification(ctx)
	fmt.Printf("request test notification: http=%d err=%v body=%s\n", code, err, strings.TrimSpace(string(body)))
	if err != nil || code != 200 {
		return
	}
	var r api.SendTestNotificationResponse
	if err := json.Unmarshal(body, &r); err != nil || r.TestNotificationToken == "" {
		fmt.Println("no testNotificationToken in response")
		return
	}
	for i := 0; i < 6; i++ {
		time.Sleep(5 * time.Second)
		code, body, err = client.GetTestNotificationStatus(ctx, r.TestNotificationToken)
		var status struct {
			FirstSendAttemptResult api.FirstSendAttemptResult `json:"firstSendAttemptResult"`
			SendAttempts           []api.SendAttemptItem      `json:"sendAttempts"`
		}
		_ = json.Unmarshal(body, &status)
		fmt.Printf("status check %d: http=%d err=%v first=%s attempts=%d\n", i+1, code, err, status.FirstSendAttemptResult, len(status.SendAttempts))
		if len(status.SendAttempts) > 0 {
			for _, a := range status.SendAttempts {
				fmt.Printf("  [%s %s]\n", time.UnixMilli(a.AttemptDate).UTC().Format(time.RFC3339), a.SendAttemptResult)
			}
			return
		}
	}
}
