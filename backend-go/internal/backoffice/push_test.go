package backoffice

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/testdb"
)

func TestValidateManualPush(t *testing.T) {
	ok := manualPushInput{Title: "  Les Worlds commencent  ", Body: " Suivez la finale en direct ", Audience: "android"}
	cases := []struct {
		name    string
		change  func(in *manualPushInput)
		problem string
	}{
		{"valid", func(*manualPushInput) {}, ""},
		{"no title", func(in *manualPushInput) { in.Title = "   " }, "Le titre est requis"},
		{"no body", func(in *manualPushInput) { in.Body = "" }, "Le message est requis"},
		{"title at the limit", func(in *manualPushInput) { in.Title = strings.Repeat("é", maxPushTitle) }, ""},
		{"title too long", func(in *manualPushInput) { in.Title = strings.Repeat("é", maxPushTitle+1) }, "Le titre dépasse 65 caractères"},
		{"body at the limit", func(in *manualPushInput) { in.Body = strings.Repeat("é", maxPushBody) }, ""},
		{"body too long", func(in *manualPushInput) { in.Body = strings.Repeat("a", maxPushBody+1) }, "Le message dépasse 178 caractères"},
		{"unknown audience", func(in *manualPushInput) { in.Audience = "premium" }, "Audience inconnue"},
		{"no audience", func(in *manualPushInput) { in.Audience = "" }, "Audience inconnue"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := ok
			tc.change(&in)
			_, _, problem := validateManualPush(in)
			assert.Equal(t, tc.problem, problem)
		})
	}

	clean, audience, problem := validateManualPush(ok)
	require.Empty(t, problem)
	assert.Equal(t, "Les Worlds commencent", clean.Title)
	assert.Equal(t, "Suivez la finale en direct", clean.Body)
	assert.Equal(t, pushAudience{Platform: "android", Label: "Android seulement"}, audience)
}

// The published app only routes match_start, new_article and new_news: any
// other type opens the app without navigating.
func TestManualPushData(t *testing.T) {
	news := "Actus"
	other := "Valorant"
	assert.Equal(t, map[string]interface{}{"type": "manual"}, manualPushData("", nil))
	assert.Equal(t, map[string]interface{}{"type": "new_news", "slug": "un-slug"}, manualPushData("un-slug", &news))
	assert.Equal(t, map[string]interface{}{"type": "new_article", "slug": "un-slug"}, manualPushData("un-slug", &other))
	assert.Equal(t, map[string]interface{}{"type": "new_article", "slug": "un-slug"}, manualPushData("un-slug", nil))
}

// expoStub stands in for exp.host: no test ever talks to the real service.
type expoStub struct {
	mu           sync.Mutex
	refused      map[string]string // token -> ticket error
	receipts     map[string]services.ExpoPushReceipt
	sent         []services.ExpoPushMessage
	receiptCalls [][]string
	receiptsDown bool
}

func (e *expoStub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	e.mu.Lock()
	defer e.mu.Unlock()
	body, _ := io.ReadAll(r.Body)
	switch r.URL.Path {
	case "/--/api/v2/push/send":
		var messages []services.ExpoPushMessage
		_ = json.Unmarshal(body, &messages)
		tickets := make([]services.ExpoPushTicket, 0, len(messages))
		for _, m := range messages {
			e.sent = append(e.sent, m)
			if code, refused := e.refused[m.To[0]]; refused {
				ticket := services.ExpoPushTicket{Status: "error", Message: code}
				ticket.Details.Error = code
				tickets = append(tickets, ticket)
				continue
			}
			tickets = append(tickets, services.ExpoPushTicket{Status: "ok", ID: "ticket-" + m.To[0]})
		}
		_ = json.NewEncoder(w).Encode(services.ExpoPushResponse{Data: tickets})
	case "/--/api/v2/push/getReceipts":
		if e.receiptsDown {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		var req struct {
			IDs []string `json:"ids"`
		}
		_ = json.Unmarshal(body, &req)
		e.receiptCalls = append(e.receiptCalls, req.IDs)
		data := map[string]services.ExpoPushReceipt{}
		for _, id := range req.IDs {
			if receipt, ok := e.receipts[id]; ok {
				data[id] = receipt
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"data": data})
	default:
		http.NotFound(w, r)
	}
}

func pushReceiptError(code string) services.ExpoPushReceipt {
	r := services.ExpoPushReceipt{Status: "error", Message: code}
	r.Details.Error = code
	return r
}

// pushTestModule needs a real Postgres (RETURNING, FILTER): skipped without
// TEST_DATABASE_URL. Run with -p 1, the services tests empty the same tables.
func pushTestModule(t *testing.T, expo *expoStub) *Module {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Article{}, &models.PushToken{}))
	require.NoError(t, EnsureSchema(db))
	require.NoError(t, db.Exec(
		"TRUNCATE bo_push_log, bo_push_ticket, bo_setting, bo_audit_log, push_token, users, articles RESTART IDENTITY").Error)

	srv := httptest.NewServer(expo)
	t.Cleanup(srv.Close)
	t.Setenv("EXPO_PUSH_BASE_URL", srv.URL)
	logger := logrus.New()
	logger.SetOutput(io.Discard)

	mr := miniredis.RunT(t)
	m, err := New(Deps{
		DB:     db,
		Cache:  cache.NewRedisClient("redis://" + mr.Addr()),
		Push:   services.NewExpoPushService(logger),
		Logger: logger,
		Config: Config{Secret: "test-secret"},
	})
	require.NoError(t, err)
	return m
}

func seedPushTokens(t *testing.T, db *gorm.DB, tokens ...models.PushToken) {
	t.Helper()
	for i := range tokens {
		tokens[i].UserID = int64(i + 1)
		tokens[i].Active = true
		require.NoError(t, db.Create(&tokens[i]).Error)
	}
}

type pushLogCounts struct {
	Sent, Delivered, Failed, Deactivated int
	ReceiptsCheckedAt                    *time.Time
}

func readPushLog(t *testing.T, db *gorm.DB, id int64) pushLogCounts {
	t.Helper()
	var got pushLogCounts
	require.NoError(t, db.Raw(
		"SELECT sent, delivered, failed, deactivated, receipts_checked_at FROM bo_push_log WHERE id = ?", id).Scan(&got).Error)
	return got
}

func pushTicketsLeft(t *testing.T, db *gorm.DB, logID int64) []string {
	t.Helper()
	var ids []string
	require.NoError(t, db.Raw("SELECT ticket_id FROM bo_push_ticket WHERE push_log_id = ? ORDER BY id", logID).Scan(&ids).Error)
	return ids
}

func backdatePush(t *testing.T, db *gorm.DB, logID int64, age time.Duration) {
	t.Helper()
	at := time.Now().Add(-age)
	require.NoError(t, db.Exec("UPDATE bo_push_log SET created_at = ? WHERE id = ?", at, logID).Error)
	require.NoError(t, db.Exec("UPDATE bo_push_ticket SET created_at = ? WHERE push_log_id = ?", at, logID).Error)
}

func TestRecordPushThenReceipts(t *testing.T) {
	expo := &expoStub{receipts: map[string]services.ExpoPushReceipt{}}
	m := pushTestModule(t, expo)
	ctx := context.Background()
	const a, b, c, d, e = "ExponentPushToken[local-test-a]", "ExponentPushToken[local-test-b]", "ExponentPushToken[local-test-c]",
		"ExponentPushToken[local-test-d]", "ExponentPushToken[local-test-e]"
	seedPushTokens(t, m.db, models.PushToken{Token: a}, models.PushToken{Token: b}, models.PushToken{Token: c},
		models.PushToken{Token: d}, models.PushToken{Token: e})
	// Registered before the send, like every device a push reaches.
	require.NoError(t, m.db.Exec("UPDATE push_token SET updated_at = now() - interval '1 day'").Error)

	id, err := m.recordPush(ctx, services.PushRecord{
		Kind: services.PushKindArticle, Title: "Un article", Body: "Son début", Audience: services.PushAudienceAll, Ref: "4821",
		Results: []services.PushResult{
			{Token: a, TicketID: "t-a"}, {Token: b, TicketID: "t-b"}, {Token: c, TicketID: "t-c"}, {Token: d, TicketID: "t-d"},
			{Token: e, Error: services.PushErrorDeviceNotRegistered},
		},
	})
	require.NoError(t, err)

	got := readPushLog(t, m.db, id)
	assert.Equal(t, pushLogCounts{Sent: 5, Failed: 1, Deactivated: 1}, got)
	assert.Equal(t, []string{"t-a", "t-b", "t-c", "t-d"}, pushTicketsLeft(t, m.db, id))

	// Too early: Expo advises to wait 15 minutes.
	m.checkPushReceipts(ctx)
	assert.Empty(t, expo.receiptCalls)
	assert.Nil(t, readPushLog(t, m.db, id).ReceiptsCheckedAt)

	backdatePush(t, m.db, id, 20*time.Minute)
	// b's owner opened the app again after the send: the token is alive.
	require.NoError(t, m.db.Exec("UPDATE push_token SET updated_at = now() WHERE token = ?", b).Error)
	expo.receipts["t-a"] = services.ExpoPushReceipt{Status: "ok"}
	expo.receipts["t-b"] = pushReceiptError(services.PushErrorDeviceNotRegistered)
	expo.receipts["t-c"] = pushReceiptError(services.PushErrorDeviceNotRegistered)

	expo.receiptsDown = true
	m.checkPushReceipts(ctx)
	assert.Nil(t, readPushLog(t, m.db, id).ReceiptsCheckedAt, "a failed call to Expo is not a check")
	expo.receiptsDown = false

	m.checkPushReceipts(ctx)
	require.Len(t, expo.receiptCalls, 1)
	assert.Equal(t, []string{"t-a", "t-b", "t-c", "t-d"}, expo.receiptCalls[0])
	got = readPushLog(t, m.db, id)
	require.NotNil(t, got.ReceiptsCheckedAt)
	assert.Equal(t, 5, got.Sent)
	assert.Equal(t, 1, got.Delivered)
	assert.Equal(t, 3, got.Failed)
	assert.Equal(t, 2, got.Deactivated, "c joins e; b registered again since the send")
	assert.Equal(t, []string{"t-d"}, pushTicketsLeft(t, m.db, id), "a ticket without receipt waits")

	var active []string
	require.NoError(t, m.db.Raw("SELECT token FROM push_token WHERE active = true ORDER BY token").Scan(&active).Error)
	assert.Equal(t, []string{a, b, d, e}, active, "e was refused at send time: its sender deactivates it, not the job")

	// Run again at once: the send waits before its next try.
	m.checkPushReceipts(ctx)
	assert.Len(t, expo.receiptCalls, 1)

	require.NoError(t, m.db.Exec("UPDATE bo_push_log SET receipts_checked_at = now() - interval '31 minutes' WHERE id = ?", id).Error)
	expo.receipts["t-d"] = services.ExpoPushReceipt{Status: "ok"}
	m.checkPushReceipts(ctx)
	require.Len(t, expo.receiptCalls, 2)
	assert.Equal(t, []string{"t-d"}, expo.receiptCalls[1])
	got = readPushLog(t, m.db, id)
	assert.Equal(t, 2, got.Delivered)
	assert.Equal(t, 3, got.Failed)
	assert.Empty(t, pushTicketsLeft(t, m.db, id))

	require.NoError(t, m.db.Exec("UPDATE bo_push_log SET receipts_checked_at = now() - interval '2 hours' WHERE id = ?", id).Error)
	m.checkPushReceipts(ctx)
	assert.Len(t, expo.receiptCalls, 2, "nothing left to ask")
}

func TestRecordPush_NothingToWaitForWhenAllRefused(t *testing.T) {
	m := pushTestModule(t, &expoStub{})
	id, err := m.recordPush(context.Background(), services.PushRecord{
		Kind: services.PushKindMatch, Title: "Match en direct · A vs B", Audience: services.PushAudienceMatch, Ref: "X_0001",
		Results: []services.PushResult{{Token: "ExponentPushToken[local-test-a]", Error: services.PushErrorNotSent}},
	})
	require.NoError(t, err)
	got := readPushLog(t, m.db, id)
	assert.NotNil(t, got.ReceiptsCheckedAt)
	assert.Equal(t, 1, got.Failed)
	assert.Equal(t, 0, got.Deactivated)
}

func TestCheckPushReceipts_DropsTicketsPastTheirReceipt(t *testing.T) {
	expo := &expoStub{receipts: map[string]services.ExpoPushReceipt{"t-old": {Status: "ok"}}}
	m := pushTestModule(t, expo)
	ctx := context.Background()
	id, err := m.recordPush(ctx, services.PushRecord{
		Kind: services.PushKindManual, Title: "Ancien", Audience: services.PushAudienceAll,
		Results: []services.PushResult{{Token: "ExponentPushToken[local-test-a]", TicketID: "t-old"}},
	})
	require.NoError(t, err)
	backdatePush(t, m.db, id, 25*time.Hour)

	m.checkPushReceipts(ctx)

	assert.Empty(t, expo.receiptCalls, "Expo clears receipts after 24 hours")
	assert.Empty(t, pushTicketsLeft(t, m.db, id))
	got := readPushLog(t, m.db, id)
	assert.Nil(t, got.ReceiptsCheckedAt, "never read: the delivered figure stays unknown")
	assert.Equal(t, 0, got.Delivered)
}

func TestStoreStatus(t *testing.T) {
	m := pushTestModule(t, &expoStub{})
	ctx := context.Background()
	status := func() (string, string) {
		apple, google, err := m.storeStatuses(ctx)
		require.NoError(t, err)
		return apple.Status, google.Status
	}
	alerts := func() int {
		e := echo.New()
		c := e.NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())
		n := m.navPushAlerts(c)
		require.NotNil(t, n)
		return *n
	}

	apple, google := status()
	assert.Equal(t, "idle", apple, "nothing received, but nobody subscribed either")
	assert.Equal(t, "idle", google)
	assert.Equal(t, 0, alerts())

	require.NoError(t, m.db.Exec(
		`INSERT INTO users (created_at, name, email, password, premium, iap_platform) VALUES
		 (now(), 'A', 'a@esportnews.local', 'x', true, 'ios'),
		 (now(), 'B', 'b@esportnews.local', 'x', true, 'android'),
		 (now(), 'C', 'c@esportnews.local', 'x', false, 'android')`).Error)
	apple, google = status()
	assert.Equal(t, "silent", apple)
	assert.Equal(t, "silent", google)
	assert.Equal(t, 2, alerts())

	require.NoError(t, m.setSetting(ctx, settingStoreLastApple, time.Now().Add(-2*time.Hour).UTC().Format(time.RFC3339)))
	require.NoError(t, m.setSetting(ctx, settingStoreLastGoogle, time.Now().Add(-72*time.Hour).UTC().Format(time.RFC3339)))
	apple, google = status()
	assert.Equal(t, "received", apple)
	assert.Equal(t, "silent", google)
	assert.Equal(t, 1, alerts())

	require.NoError(t, m.db.Exec("UPDATE users SET premium = false WHERE iap_platform = 'android'").Error)
	_, google = status()
	assert.Equal(t, "idle", google, "no Android subscriber left: silence is expected")

	m.StoreNotificationAccepted("google")()
	require.Eventually(t, func() bool {
		_, g := status()
		return g == "received"
	}, 3*time.Second, 20*time.Millisecond)
	assert.False(t, m.settingBool(ctx, "missing", false))
	assert.True(t, m.MatchLiveAlertEnabled(ctx), "on until someone switches it off")
}

func pushSendRequest(t *testing.T, m *Module, role Role, sudo bool, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	g := e.Group("/api/bo", func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			s := &Session{UserID: 9, User: &teamUser{ID: 9, Name: "Camille Test", Role: role}}
			if sudo {
				s.SudoUntil = time.Now().Add(time.Minute)
			}
			c.Set(ctxSession, s)
			return next(c)
		}
	})
	m.registerPushRoutes(g)
	req := httptest.NewRequest(http.MethodPost, "/api/bo/push/send", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func pushErrorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var e apiError
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &e))
	return e.Code
}

func TestHandlePushSend(t *testing.T) {
	const ios, android, gone = "ExponentPushToken[local-test-ios]", "ExponentPushToken[local-test-android]", "ExponentPushToken[local-test-gone]"
	expo := &expoStub{refused: map[string]string{gone: services.PushErrorDeviceNotRegistered}}
	m := pushTestModule(t, expo)
	seedPushTokens(t, m.db,
		models.PushToken{Token: ios, Platform: "ios"},
		models.PushToken{Token: android, Platform: "android"},
		models.PushToken{Token: gone, Platform: "android"})
	require.NoError(t, m.db.Exec(
		`INSERT INTO articles (created_at, slug, title, category, status) VALUES
		 (now(), 'worlds-finale', 'Finale des Worlds', 'Actus', 'published'),
		 (now(), 'brouillon', 'Pas encore', 'Actus', 'draft')`).Error)
	body := func(title, audience, slug string) string {
		return fmt.Sprintf(`{"title":%q,"body":"Suivez la finale en direct","audience":%q,"article_slug":%q}`, title, audience, slug)
	}

	rec := pushSendRequest(t, m, RoleReader, true, body("Les Worlds commencent", "all", ""))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "forbidden", pushErrorCode(t, rec))
	rec = pushSendRequest(t, m, RoleEditor, true, body("Les Worlds commencent", "all", ""))
	assert.Equal(t, "forbidden", pushErrorCode(t, rec))
	rec = pushSendRequest(t, m, RoleAdmin, false, body("Les Worlds commencent", "all", ""))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "reauth_required", pushErrorCode(t, rec))

	rec = pushSendRequest(t, m, RoleAdmin, true, body("", "all", ""))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = pushSendRequest(t, m, RoleAdmin, true, body(strings.Repeat("x", 66), "all", ""))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	rec = pushSendRequest(t, m, RoleAdmin, true, body("Les Worlds commencent", "all", "inconnu"))
	assert.Equal(t, "article_not_found", pushErrorCode(t, rec))
	rec = pushSendRequest(t, m, RoleAdmin, true, body("Les Worlds commencent", "all", "brouillon"))
	assert.Equal(t, "article_not_found", pushErrorCode(t, rec))
	assert.Empty(t, expo.sent, "nothing left for a refused request")

	// Android only, no link.
	rec = pushSendRequest(t, m, RoleAdmin, true, body("Les Worlds commencent", "android", ""))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var entry pushLogRow
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &entry))
	assert.Equal(t, "manual", entry.Kind)
	assert.Equal(t, "Les Worlds commencent", entry.Title)
	assert.Equal(t, "Android seulement", entry.Audience)
	assert.Equal(t, 2, entry.Sent)
	assert.Equal(t, 1, entry.Failed)
	assert.Nil(t, entry.Delivered, "unknown until the receipts are read")
	require.Len(t, expo.sent, 2)
	for _, msg := range expo.sent {
		assert.Equal(t, "content-updates", msg.ChannelId)
		assert.Equal(t, map[string]interface{}{"type": "manual"}, msg.Data)
		assert.NotEqual(t, ios, msg.To[0])
	}
	got := readPushLog(t, m.db, entry.ID)
	assert.Equal(t, pushLogCounts{Sent: 2, Failed: 1, Deactivated: 1}, got)
	assert.Equal(t, []string{"ticket-" + android}, pushTicketsLeft(t, m.db, entry.ID))
	var actor int64
	require.NoError(t, m.db.Raw("SELECT actor_id FROM bo_push_log WHERE id = ?", entry.ID).Scan(&actor).Error)
	assert.EqualValues(t, 9, actor)
	var stillActive bool
	require.NoError(t, m.db.Raw("SELECT active FROM push_token WHERE token = ?", gone).Scan(&stillActive).Error)
	assert.False(t, stillActive)

	var audit auditRow
	require.NoError(t, m.db.Raw("SELECT * FROM bo_audit_log WHERE action = 'push.manual'").Scan(&audit).Error)
	assert.Equal(t, "Android seulement", audit.TargetLabel)
	assert.Equal(t, `"Les Worlds commencent", 2 appareils`, audit.Detail)
	assert.Equal(t, "Camille Test", audit.ActorName)

	// The same push again within the minute: a double click, not a second send.
	rec = pushSendRequest(t, m, RoleAdmin, true, body("Les Worlds commencent", "android", ""))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "duplicate", pushErrorCode(t, rec))
	assert.Len(t, expo.sent, 2)

	// Everyone, with a link: the payload of an article notification.
	rec = pushSendRequest(t, m, RoleAdmin, true, body("La finale est lancée", "all", "worlds-finale"))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	require.Len(t, expo.sent, 4, "the device deactivated by the first send is left out")
	assert.Equal(t, map[string]interface{}{"type": "new_news", "slug": "worlds-finale"}, expo.sent[3].Data)
	assert.Equal(t, "La finale est lancée", expo.sent[3].Title)
	assert.Equal(t, "Suivez la finale en direct", expo.sent[3].Body)

	require.NoError(t, m.db.Exec("UPDATE push_token SET active = false WHERE platform = 'ios'").Error)
	rec = pushSendRequest(t, m, RoleAdmin, true, body("Pour iOS", "ios", ""))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "no_device", pushErrorCode(t, rec))
}
