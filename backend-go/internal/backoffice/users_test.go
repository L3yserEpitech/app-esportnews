package backoffice

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/handlers"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/testdb"
)

func usersStr(s string) *string { return &s }

func TestFreeLimitsMirrorTheSite(t *testing.T) {
	assert.Equal(t, handlers.FreeMatchSubLimit, freeMatchLimit)
	assert.Equal(t, handlers.FreeTournamentSubLimit, freeTournamentLimit)
}

func TestPremiumState(t *testing.T) {
	now := time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)
	in := func(d time.Duration) *time.Time { at := now.Add(d); return &at }
	day := 24 * time.Hour

	cases := []struct {
		name      string
		facts     premiumFacts
		active    bool
		source    string
		expiring  bool
		willRenew *bool
	}{
		{name: "free account", facts: premiumFacts{}},
		{name: "lapsed subscriber is not premium", facts: premiumFacts{IAPPlatform: usersStr("ios"), IAPExpiresAt: in(-30 * day)}},
		{name: "App Store subscription", facts: premiumFacts{Premium: true, IAPPlatform: usersStr("ios"), IAPExpiresAt: in(20 * day)},
			active: true, source: sourceAppStore},
		{name: "Google Play subscription ending in two days", facts: premiumFacts{Premium: true, IAPPlatform: usersStr("android"), IAPExpiresAt: in(2 * day)},
			active: true, source: sourceGooglePlay, expiring: true},
		{name: "store subscription without an expiry on record", facts: premiumFacts{Premium: true, IAPPlatform: usersStr("android")},
			active: true, source: sourceGooglePlay},
		{name: "store subscription in billing retry", facts: premiumFacts{Premium: true, IAPPlatform: usersStr("ios"), IAPExpiresAt: in(-day)},
			active: true, source: sourceAppStore},
		{name: "Stripe subscription that renews", facts: premiumFacts{Premium: true, HasStripe: true, StripeStatus: usersStr("active"), StripePeriodEnd: in(2 * day)},
			active: true, source: sourceStripe, willRenew: usersBool(true)},
		{name: "Stripe subscription cancelled, ending soon", facts: premiumFacts{Premium: true, HasStripe: true, StripeStatus: usersStr("active"),
			StripePeriodEnd: in(2 * day), StripeCanceledAt: in(-day)}, active: true, source: sourceStripe, expiring: true, willRenew: usersBool(false)},
		{name: "Stripe checkout paid, subscription not synced yet", facts: premiumFacts{Premium: true, HasStripe: true},
			active: true, source: sourceStripe},
		{name: "gift alone", facts: premiumFacts{Premium: true, Gifted: true}, active: true, source: sourceGift},
		{name: "gift over a lapsed store subscription", facts: premiumFacts{Premium: true, Gifted: true, IAPPlatform: usersStr("ios"), IAPExpiresAt: in(-day)},
			active: true, source: sourceGift},
		{name: "gift beside a running store subscription", facts: premiumFacts{Premium: true, Gifted: true, IAPPlatform: usersStr("ios"), IAPExpiresAt: in(10 * day)},
			active: true, source: sourceAppStore},
		{name: "gift whose premium flag was lost", facts: premiumFacts{Gifted: true}, active: true, source: sourceGift},
		{name: "premium with no trace of a purchase", facts: premiumFacts{Premium: true}, active: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			st := tc.facts.state(now)
			assert.Equal(t, tc.active, st.Active)
			if tc.source == "" {
				assert.Nil(t, st.Source)
			} else if assert.NotNil(t, st.Source) {
				assert.Equal(t, tc.source, *st.Source)
			}
			assert.Equal(t, tc.expiring, st.Expiring)
			assert.Equal(t, tc.willRenew, st.WillRenew)
			assert.Equal(t, tc.facts.Gifted, st.Gifted)
		})
	}
}

func usersBool(b bool) *bool { return &b }

func TestMaskReference(t *testing.T) {
	assert.Equal(t, "•••••••4417", maskReference("2000000912344417"))
	assert.Equal(t, "•••••••wXyZ", maskReference("  kpmnbvcxzlkjhgfdsa.AO-J1OwXyZ "))
	assert.Equal(t, "••••", maskReference("4417"), "a short reference shows nothing")
	assert.Equal(t, "", maskReference(""))
}

func TestCachedTeamName(t *testing.T) {
	assert.Equal(t, "Équipe Exemple", cachedTeamName(`{"result":[{"pageid":12,"name":" Équipe Exemple "}]}`))
	assert.Equal(t, "", cachedTeamName(`{"result":[]}`))
	assert.Equal(t, "", cachedTeamName(`<html>Just a moment...</html>`))
}

func TestParseUserQuery(t *testing.T) {
	parse := func(raw string) (userQuery, bool) {
		req := httptest.NewRequest(http.MethodGet, "/?"+raw, nil)
		return parseUserQuery(req.URL.Query().Get)
	}

	q, ok := parse("")
	require.True(t, ok)
	assert.Equal(t, "all", q.View)
	assert.Empty(t, q.filter().conds)

	q, ok = parse("view=premium&q=+42+&role=editor&premium=expiring&platform=ios&since=28")
	require.True(t, ok)
	assert.Equal(t, userQuery{View: "premium", Search: "42", Role: "editor", Premium: "expiring", Platform: "ios", Since: 28}, q)
	f := q.filter()
	assert.Len(t, f.conds, 6)
	assert.Contains(t, f.args, int64(42), "a number is also tried as an identifier")
	assert.Equal(t, "12 lignes, vue Premium, recherche, rôle Rédacteur, premium expiring, plateforme ios, inscrits depuis 28 j", q.describe(12))

	q, ok = parse("q=100%25_")
	require.True(t, ok)
	assert.Equal(t, []interface{}{`%100\%\_%`}, q.filter().args, "LIKE wildcards are taken literally")

	for _, bad := range []string{"view=admins", "role=owner", "premium=yes", "platform=web", "since=30", "since=abc"} {
		_, ok := parse(bad)
		assert.False(t, ok, bad)
	}
}

// ---- with a database ----

const usersTestDomain = "@users-test.local"

type usersTestEnv struct {
	m    *Module
	db   *gorm.DB
	auth *services.AuthService
	seq  int
}

// usersTestEnv only touches the rows it creates: accounts under usersTestDomain
// and what hangs off them.
func newUsersTestEnv(t *testing.T) *usersTestEnv {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(
		&models.User{}, &models.Game{}, &models.Article{}, &models.PageView{}, &models.Notification{},
		&models.PushToken{}, &models.MatchSubscription{}, &models.TournamentSubscription{}))
	require.NoError(t, EnsureSchema(db))

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	auth := services.NewAuthServiceWithGORM(&database.Database{DB: db}, rc, "test-secret")
	m, err := New(Deps{DB: db, Cache: rc, Auth: auth, Logger: logger, Config: Config{Secret: "test-secret"}})
	require.NoError(t, err)

	env := &usersTestEnv{m: m, db: db, auth: auth}
	env.clean(t)
	t.Cleanup(func() { env.clean(t) })
	return env
}

func (e *usersTestEnv) clean(t *testing.T) {
	var ids []int64
	require.NoError(t, e.db.Raw("SELECT id FROM users WHERE email LIKE ?", "%"+usersTestDomain).Scan(&ids).Error)
	var gone []int64
	e.db.Raw("SELECT user_id FROM bo_deleted_account WHERE reason LIKE 'users-test%'").Scan(&gone)
	ids = append(ids, gone...)
	if len(ids) == 0 {
		return
	}
	targets := make([]string, len(ids))
	for i, id := range ids {
		targets[i] = strconv.FormatInt(id, 10)
	}
	for _, table := range []string{"push_token", "match_subscription", "tournament_subscription", "notifications", "bo_deleted_account"} {
		require.NoError(t, e.db.Exec("DELETE FROM "+table+" WHERE user_id IN ?", ids).Error)
	}
	require.NoError(t, e.db.Exec("DELETE FROM bo_audit_log WHERE actor_id IN ? OR (target_type = 'user' AND target_id IN ?)", ids, targets).Error)
	require.NoError(t, e.db.Exec("DELETE FROM users WHERE id IN ?", ids).Error)
}

// user creates an account and applies column values on top (raw SQL: several
// of these columns are not on models.User).
func (e *usersTestEnv) user(t *testing.T, role Role, set map[string]interface{}) *teamUser {
	t.Helper()
	e.seq++
	email := fmt.Sprintf("compte-%d-%d%s", e.seq, time.Now().UnixNano(), usersTestDomain)
	require.NoError(t, e.db.Exec(
		"INSERT INTO users (created_at, name, email, password, admin, role) VALUES (now(), ?, ?, 'x', ?, ?)",
		fmt.Sprintf("Compte %d", e.seq), email, role == RoleAdmin, string(role)).Error)
	u, err := e.m.userByEmail(context.Background(), email)
	require.NoError(t, err)
	if len(set) > 0 {
		require.NoError(t, e.db.Table("users").Where("id = ?", u.ID).Updates(set).Error)
	}
	return u
}

func (e *usersTestEnv) server(actor *teamUser, sudo bool) *echo.Echo {
	srv := echo.New()
	g := srv.Group("/api/bo", func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			s := &Session{UserID: actor.ID, User: actor, Device: "Mac", City: "Lyon"}
			if sudo {
				s.SudoUntil = time.Now().Add(time.Minute)
			}
			c.Set(ctxSession, s)
			return next(c)
		}
	})
	e.m.registerUserRoutes(g)
	return srv
}

func usersCall(srv *echo.Echo, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, "/api/bo"+path, reader)
	if body != nil {
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func usersErrorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var e apiError
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &e), rec.Body.String())
	return e.Code
}

type usersAuditEntry struct {
	Action      string
	ActorID     int64
	TargetLabel string
	Detail      string
}

func (e *usersTestEnv) audit(t *testing.T, targetID int64) []usersAuditEntry {
	t.Helper()
	rows := []usersAuditEntry{}
	require.NoError(t, e.db.Raw(
		"SELECT action, actor_id, target_label, detail FROM bo_audit_log WHERE target_type = 'user' AND target_id = ? ORDER BY id",
		strconv.FormatInt(targetID, 10)).Scan(&rows).Error)
	return rows
}

type usersListPage struct {
	Users   []userListItem   `json:"users"`
	Deleted []deletedAccount `json:"deleted"`
	Total   int64            `json:"total"`
}

func (e *usersTestEnv) list(t *testing.T, srv *echo.Echo, query string) usersListPage {
	t.Helper()
	rec := usersCall(srv, http.MethodGet, "/users?limit=100&q="+strings.TrimPrefix(usersTestDomain, "@")+"&"+query, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var page usersListPage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	return page
}

func usersIDs(users []userListItem) []int64 {
	ids := make([]int64, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	sort.Slice(ids, func(a, b int) bool { return ids[a] < ids[b] })
	return ids
}

// The SQL behind the filters and premiumFacts.state must sort every account
// the same way: the row shows what state says, the filter must agree.
func TestUserListFiltersAgreeWithPremiumState(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	now := time.Now()
	in := func(d time.Duration) time.Time { return now.Add(d) }
	day := 24 * time.Hour

	accounts := []map[string]interface{}{
		nil,
		{"iap_platform": "ios", "iap_expires_at": in(-30 * day)},
		{"premium": true, "iap_platform": "ios", "iap_expires_at": in(20 * day)},
		{"premium": true, "iap_platform": "android", "iap_expires_at": in(2 * day)},
		{"premium": true, "iap_platform": "android"},
		{"premium": true, "iap_platform": "ios", "iap_expires_at": in(-day)},
		{"premium": true, "stripe_customer_id": "cus_test_a", "stripe_subscription_id": "sub_test_a", "subscription_status": "active",
			"subscription_current_period_end": in(2 * day)},
		{"premium": true, "stripe_customer_id": "cus_test_b", "stripe_subscription_id": "sub_test_b", "subscription_status": "active",
			"subscription_current_period_end": in(2 * day), "subscription_canceled_at": in(-day)},
		{"premium": true, "stripe_customer_id": "cus_test_c"},
		{"premium": true, "premium_gifted": true},
		{"premium": true, "premium_gifted": true, "iap_platform": "ios", "iap_expires_at": in(-day)},
		{"premium": true, "premium_gifted": true, "iap_platform": "ios", "iap_expires_at": in(10 * day)},
		{"premium": true, "premium_gifted": true, "stripe_customer_id": "cus_test_d", "subscription_status": "canceled"},
		{"premium": true},
	}
	for _, set := range accounts {
		env.user(t, RoleUser, set)
	}
	srv := env.server(admin, false)
	all := env.list(t, srv, "")
	require.Len(t, all.Users, len(accounts)+1)
	assert.Equal(t, int64(len(accounts)+1), all.Total)

	paid := func(st premiumState) bool {
		return st.Source != nil && *st.Source != sourceGift
	}
	predicates := map[string]func(premiumState) bool{
		"view=premium":     func(st premiumState) bool { return st.Active },
		"premium=none":     func(st premiumState) bool { return !st.Active },
		"premium=store":    paid,
		"premium=gifted":   func(st premiumState) bool { return st.Gifted },
		"premium=expiring": func(st premiumState) bool { return st.Expiring },
	}
	for query, want := range predicates {
		t.Run(query, func(t *testing.T) {
			var expected []userListItem
			for _, u := range all.Users {
				if want(u.Premium) {
					expected = append(expected, u)
				}
			}
			require.NotEmpty(t, expected, "the matrix must exercise this filter")
			got := env.list(t, srv, query)
			assert.Equal(t, usersIDs(expected), usersIDs(got.Users))
			assert.Equal(t, int64(len(expected)), got.Total)
		})
	}
}

func TestUserListCountsDevicesAndFollows(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	fan := env.user(t, RoleUser, nil)
	quiet := env.user(t, RoleUser, nil)
	tournament := int64(42)

	stamp := time.Now().UnixNano()
	require.NoError(t, env.db.Create(&[]models.PushToken{
		{UserID: fan.ID, Token: fmt.Sprintf("ExponentPushToken[users-test-%d-a]", stamp), Platform: "ios", Active: true},
		{UserID: fan.ID, Token: fmt.Sprintf("ExponentPushToken[users-test-%d-b]", stamp), Platform: "android", Active: true},
		{UserID: fan.ID, Token: fmt.Sprintf("ExponentPushToken[users-test-%d-c]", stamp), Platform: "ios", Active: true},
	}).Error)
	// GORM skips a false bool that has a default: the retired token is set apart.
	require.NoError(t, env.db.Exec("UPDATE push_token SET active = false WHERE token = ?", fmt.Sprintf("ExponentPushToken[users-test-%d-c]", stamp)).Error)
	require.NoError(t, env.db.Create(&[]models.MatchSubscription{
		{UserID: fan.ID, MatchID: 1, Match2ID: "usersTestA_0001", Status: "upcoming"},
		{UserID: fan.ID, MatchID: 1, Match2ID: "usersTestA_0002", Status: "running"},
		{UserID: fan.ID, MatchID: 1, Match2ID: "usersTestA_0003", Status: "finished"},
		{UserID: fan.ID, MatchID: 1, Match2ID: "usersTestA_0004", Status: "upcoming", FromTournament: &tournament},
		{UserID: fan.ID, MatchID: 77, Status: "upcoming"},
	}).Error)
	require.NoError(t, env.db.Create(&[]models.TournamentSubscription{
		{UserID: fan.ID, TournamentID: 880001, Status: "running"},
		{UserID: fan.ID, TournamentID: 880002, Status: "finished"},
	}).Error)

	srv := env.server(admin, false)
	byID := map[int64]userListItem{}
	for _, u := range env.list(t, srv, "").Users {
		byID[u.ID] = u
	}
	assert.Equal(t, int64(2), byID[fan.ID].Devices, "active tokens only")
	assert.Equal(t, int64(2), byID[fan.ID].MatchesFollowed, "likes still to come, like the free limit counts them")
	assert.Equal(t, int64(1), byID[fan.ID].TournamentsFollowed)
	assert.Zero(t, byID[quiet.ID].Devices)

	assert.Equal(t, []int64{fan.ID}, usersIDs(env.list(t, srv, "platform=android").Users))
	assert.Equal(t, []int64{fan.ID}, usersIDs(env.list(t, srv, "platform=ios").Users))
	assert.ElementsMatch(t, []int64{admin.ID, quiet.ID}, usersIDs(env.list(t, srv, "platform=none").Users))
	assert.Equal(t, []int64{admin.ID}, usersIDs(env.list(t, srv, "view=team").Users))
	assert.Equal(t, []int64{admin.ID}, usersIDs(env.list(t, srv, "role=admin").Users))

	// By identifier.
	rec := usersCall(srv, http.MethodGet, "/users?q="+strconv.FormatInt(fan.ID, 10), nil)
	var page usersListPage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	assert.Contains(t, usersIDs(page.Users), fan.ID)

	assert.Equal(t, http.StatusBadRequest, usersCall(srv, http.MethodGet, "/users?premium=maybe", nil).Code)

	// The user page reads the same numbers.
	rec = usersCall(srv, http.MethodGet, "/users/"+strconv.FormatInt(fan.ID, 10), nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var detail struct {
		User    accountView  `json:"user"`
		Premium premiumView  `json:"premium"`
		Devices []deviceView `json:"devices"`
		Follows followsView  `json:"follows"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	assert.Equal(t, fan.Email, detail.User.Email)
	require.NotNil(t, detail.User.Sessions)
	assert.Zero(t, *detail.User.Sessions)
	require.Len(t, detail.Devices, 3)
	assert.True(t, detail.Devices[0].Active)
	assert.False(t, detail.Devices[2].Active, "retired tokens come last")
	assert.Equal(t, followLimit{Used: 2, Limit: freeMatchLimit}, detail.Follows.MatchLimit)
	assert.Equal(t, followLimit{Used: 1, Limit: freeTournamentLimit}, detail.Follows.TournamentLimit)
	assert.Equal(t, int64(5), detail.Follows.MatchesTotal)
	assert.Len(t, detail.Follows.Matches, 4, "the overview keeps the first few")
	assert.NotEqual(t, "finished", detail.Follows.Matches[0].Status, "what is over goes last")
	assert.False(t, detail.Follows.Unlimited)

	rec = usersCall(srv, http.MethodGet, "/users/"+strconv.FormatInt(fan.ID, 10)+"/follows", nil)
	var follows followsView
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &follows))
	assert.Len(t, follows.Matches, 5)
	origins := map[string]int{}
	for _, match := range follows.Matches {
		origins[match.Origin]++
	}
	assert.Equal(t, map[string]int{"like": 4, "tournament": 1}, origins)

	assert.Equal(t, http.StatusNotFound, usersCall(srv, http.MethodGet, "/users/999999999", nil).Code)
	assert.Equal(t, http.StatusNotFound, usersCall(srv, http.MethodGet, "/users/abc", nil).Code)
}

func TestUserDetailMasksTheStoreReference(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	buyer := env.user(t, RoleUser, map[string]interface{}{
		"premium": true, "iap_platform": "ios", "iap_product_id": "premium_monthly",
		"iap_original_transaction_id": "2000000912344417", "iap_transaction_id": "2000000912349999",
		"iap_expires_at": time.Now().Add(240 * time.Hour),
	})

	rec := usersCall(env.server(admin, false), http.MethodGet, "/users/"+strconv.FormatInt(buyer.ID, 10), nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotContains(t, rec.Body.String(), "2000000912344417")
	assert.NotContains(t, rec.Body.String(), "2000000912349999")
	var detail struct {
		Premium premiumView `json:"premium"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.NotNil(t, detail.Premium.Transaction)
	assert.Equal(t, "•••••••4417", *detail.Premium.Transaction)
	assert.Equal(t, "original_transaction", *detail.Premium.TransactionKind)
	assert.Equal(t, "premium_monthly", *detail.Premium.Product)
	assert.Nil(t, detail.Premium.LastVerifiedAt)
}

func TestPremiumGiftOnAndOff(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	free := env.user(t, RoleUser, nil)
	subscriber := env.user(t, RoleUser, map[string]interface{}{
		"premium": true, "iap_platform": "ios", "iap_expires_at": time.Now().Add(240 * time.Hour),
	})
	srv := env.server(admin, false)
	path := func(u *teamUser) string { return "/users/" + strconv.FormatInt(u.ID, 10) + "/premium-gift" }
	flags := func(u *teamUser) (premium, gifted bool, note *string) {
		var row struct {
			Premium         bool
			PremiumGifted   bool
			PremiumGiftNote *string
		}
		require.NoError(t, env.db.Raw("SELECT COALESCE(premium, false) AS premium, premium_gifted, premium_gift_note FROM users WHERE id = ?", u.ID).Scan(&row).Error)
		return row.Premium, row.PremiumGifted, row.PremiumGiftNote
	}

	rec := usersCall(srv, http.MethodPut, path(free), giftInput{Gifted: true})
	assert.Equal(t, http.StatusBadRequest, rec.Code, "a gift needs its reason")

	require.Equal(t, http.StatusNoContent, usersCall(srv, http.MethodPut, path(free), giftInput{Gifted: true, Note: "Partenaire du site"}).Code)
	premium, gifted, note := flags(free)
	assert.True(t, premium)
	assert.True(t, gifted)
	require.NotNil(t, note)
	assert.Equal(t, "Partenaire du site", *note)

	// The daily check of purchases comes back empty-handed for this account.
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	iap := services.NewIAPService(env.db, logger, &services.IAPConfig{})
	require.NoError(t, iap.UpdateUserIAPStatus(context.Background(), free.ID, &services.IAPValidationResult{IsValid: false, Platform: "ios", TransactionID: "users-test-tx"}))
	premium, _, _ = flags(free)
	assert.True(t, premium, "a gifted Premium survives a failed purchase check")

	require.Equal(t, http.StatusNoContent, usersCall(srv, http.MethodPut, path(free), giftInput{Gifted: false, Note: "Fin du partenariat"}).Code)
	premium, gifted, note = flags(free)
	assert.False(t, premium, "nothing else gives this account Premium")
	assert.False(t, gifted)
	assert.Nil(t, note)

	require.Equal(t, http.StatusNoContent, usersCall(srv, http.MethodPut, path(subscriber), giftInput{Gifted: true, Note: "Geste commercial"}).Code)
	require.Equal(t, http.StatusNoContent, usersCall(srv, http.MethodPut, path(subscriber), giftInput{Gifted: false}).Code)
	premium, gifted, _ = flags(subscriber)
	assert.True(t, premium, "the store subscription is still running")
	assert.False(t, gifted)

	entries := env.audit(t, free.ID)
	require.Len(t, entries, 2)
	assert.Equal(t, usersAuditEntry{"user.premium_gifted", admin.ID, free.Email, "Partenaire du site"}, entries[0])
	assert.Equal(t, usersAuditEntry{"user.premium_gift_removed", admin.ID, free.Email, "Fin du partenariat"}, entries[1])

	assert.Equal(t, http.StatusNotFound, usersCall(srv, http.MethodPut, "/users/999999999/premium-gift", giftInput{Gifted: true, Note: "x"}).Code)
}

func TestLogoutAllEndsTheSiteSessions(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	target := env.user(t, RoleUser, nil)
	ctx := context.Background()
	account, err := env.auth.GetUser(ctx, target.ID)
	require.NoError(t, err)
	phone, err := env.auth.LoginAfterSignup(ctx, account)
	require.NoError(t, err)
	laptop, err := env.auth.LoginAfterSignup(ctx, account)
	require.NoError(t, err)
	_, err = env.auth.VerifyToken(phone.AccessToken)
	require.NoError(t, err)
	// Tokens are compared to the millisecond with the revocation mark.
	time.Sleep(5 * time.Millisecond)

	srv := env.server(admin, false)
	rec := usersCall(srv, http.MethodPost, "/users/"+strconv.FormatInt(target.ID, 10)+"/logout-all", reasonInput{Reason: "téléphone perdu"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, `{"sessions": 2}`, rec.Body.String())

	for _, session := range []*models.AuthResponse{phone, laptop} {
		_, err = env.auth.VerifyToken(session.AccessToken)
		assert.ErrorIs(t, err, services.ErrSessionRevoked)
		_, err = env.auth.RefreshSession(ctx, session.RefreshToken)
		assert.ErrorIs(t, err, services.ErrRefreshTokenRevoked)
	}
	entries := env.audit(t, target.ID)
	require.Len(t, entries, 1)
	assert.Equal(t, usersAuditEntry{"user.logout_forced", admin.ID, target.Email, "2 appareils · téléphone perdu"}, entries[0])

	// A body is optional.
	rec = usersCall(srv, http.MethodPost, "/users/"+strconv.FormatInt(target.ID, 10)+"/logout-all", nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "0 appareil", env.audit(t, target.ID)[1].Detail)
}

func TestUserDeletion(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	target := env.user(t, RoleUser, nil)
	require.NoError(t, env.db.Create(&models.PushToken{
		UserID: target.ID, Token: fmt.Sprintf("ExponentPushToken[users-test-del-%d]", time.Now().UnixNano()), Platform: "ios", Active: true,
	}).Error)
	path := "/users/" + strconv.FormatInt(target.ID, 10)

	rec := usersCall(env.server(admin, false), http.MethodDelete, path, reasonInput{Reason: "users-test demande"})
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "reauth_required", usersErrorCode(t, rec))

	srv := env.server(admin, true)
	rec = usersCall(srv, http.MethodDelete, path, reasonInput{Reason: "  "})
	assert.Equal(t, http.StatusBadRequest, rec.Code, "a deletion needs its reason")

	rec = usersCall(srv, http.MethodDelete, "/users/"+strconv.FormatInt(admin.ID, 10), reasonInput{Reason: "users-test moi"})
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "self_delete", usersErrorCode(t, rec))

	rec = usersCall(srv, http.MethodDelete, path, reasonInput{Reason: "users-test demande de la personne"})
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	_, err := env.m.userByID(context.Background(), target.ID)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	var tokens int64
	require.NoError(t, env.db.Raw("SELECT count(*) FROM push_token WHERE user_id = ?", target.ID).Scan(&tokens).Error)
	assert.Zero(t, tokens)

	entries := env.audit(t, target.ID)
	require.Len(t, entries, 1)
	assert.Equal(t, usersAuditEntry{"user.deleted", admin.ID, fmt.Sprintf("Compte n° %d", target.ID), "users-test demande de la personne"}, entries[0])
	assert.NotContains(t, entries[0].TargetLabel, "@", "the journal keeps no address of a deleted account")

	rec = usersCall(srv, http.MethodGet, "/users?view=deleted&q="+strconv.FormatInt(target.ID, 10), nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var page usersListPage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	require.Len(t, page.Deleted, 1)
	assert.Equal(t, int64(1), page.Total)
	assert.Equal(t, target.ID, page.Deleted[0].UserID)
	assert.Equal(t, admin.Name, page.Deleted[0].DeletedBy)
	assert.Equal(t, "users-test demande de la personne", page.Deleted[0].Reason)
	assert.NotNil(t, page.Deleted[0].RegisteredAt)
	assert.NotContains(t, rec.Body.String(), target.Email)

	assert.Equal(t, http.StatusNotFound, usersCall(srv, http.MethodDelete, path, reasonInput{Reason: "users-test encore"}).Code)
}

// The guard counts every admin of the table: the test runs in a transaction it
// rolls back, so it can make its own admin the only one.
func TestUserDeletionRefusesTheLastAdmin(t *testing.T) {
	env := newUsersTestEnv(t)
	whole := env.db
	tx := whole.Begin()
	require.NoError(t, tx.Error)
	env.db, env.m.db = tx, tx
	defer func() {
		tx.Rollback()
		env.db, env.m.db = whole, whole
	}()

	require.NoError(t, tx.Exec("UPDATE users SET role = 'editor' WHERE role = 'admin'").Error)
	lastAdmin := env.user(t, RoleAdmin, nil)
	// No role but admin manages users: the guard is reached with the routes'
	// own permission check left out.
	actor := &teamUser{ID: lastAdmin.ID + 1000000, Name: "Camille Test", Role: RoleAdmin}

	rec := usersCall(env.server(actor, true), http.MethodDelete, "/users/"+strconv.FormatInt(lastAdmin.ID, 10), reasonInput{Reason: "users-test dernier"})
	assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	assert.Equal(t, "last_admin", usersErrorCode(t, rec))
	_, err := env.m.userByID(context.Background(), lastAdmin.ID)
	assert.NoError(t, err)
}

func TestUserRoleChangeNeedsFreshCredentials(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	target := env.user(t, RoleUser, nil)
	path := "/users/" + strconv.FormatInt(target.ID, 10) + "/role"

	rec := usersCall(env.server(admin, false), http.MethodPatch, path, roleInput{Role: RoleEditor})
	assert.Equal(t, "reauth_required", usersErrorCode(t, rec))

	srv := env.server(admin, true)
	assert.Equal(t, http.StatusBadRequest, usersCall(srv, http.MethodPatch, path, roleInput{Role: "owner"}).Code)
	require.Equal(t, http.StatusNoContent, usersCall(srv, http.MethodPatch, path, roleInput{Role: RoleEditor}).Code)

	after, err := env.m.userByID(context.Background(), target.ID)
	require.NoError(t, err)
	assert.Equal(t, RoleEditor, after.Role)
	entries := env.audit(t, target.ID)
	require.Len(t, entries, 1)
	assert.Equal(t, "user.role_changed", entries[0].Action)
	assert.Equal(t, "Utilisateur → Rédacteur", entries[0].Detail)

	rec = usersCall(srv, http.MethodPatch, "/users/"+strconv.FormatInt(admin.ID, 10)+"/role", roleInput{Role: RoleUser})
	assert.Equal(t, "self_change", usersErrorCode(t, rec))

	// History of the account, newest first.
	rec = usersCall(srv, http.MethodGet, "/users/"+strconv.FormatInt(target.ID, 10)+"/history", nil)
	var history struct {
		Entries []auditRow `json:"entries"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &history))
	require.Len(t, history.Entries, 1)
	assert.Equal(t, "user.role_changed", history.Entries[0].Action)
	assert.Equal(t, "Lyon", history.Entries[0].City)
}

func TestUserExports(t *testing.T) {
	env := newUsersTestEnv(t)
	admin := env.user(t, RoleAdmin, nil)
	target := env.user(t, RoleUser, map[string]interface{}{"name": "=HYPERLINK(\"https://example.invalid\")", "premium": true, "premium_gifted": true})
	require.NoError(t, env.db.Create(&models.TournamentSubscription{UserID: target.ID, TournamentID: 880010, TournamentName: "Tournoi de test", Status: "running"}).Error)

	// One account, as JSON.
	rec := usersCall(env.server(admin, false), http.MethodGet, "/users/"+strconv.FormatInt(target.ID, 10)+"/export", nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, rec.Header().Get(echo.HeaderContentDisposition), fmt.Sprintf(`filename="compte-%d.json"`, target.ID))
	var export map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &export))
	for _, section := range []string{"exported_at", "account", "push_tokens", "match_subscriptions", "tournament_subscriptions",
		"notification_preferences", "page_views", "articles", "two_factor", "backup_codes", "trusted_devices",
		"back_office_actions", "back_office_history"} {
		assert.Contains(t, export, section)
	}
	var account map[string]interface{}
	require.NoError(t, json.Unmarshal(export["account"], &account))
	assert.Equal(t, target.Email, account["email"])
	assert.NotContains(t, account, "password")
	assert.Contains(t, string(export["tournament_subscriptions"]), "Tournoi de test")
	entries := env.audit(t, target.ID)
	require.Len(t, entries, 1)
	assert.Equal(t, "user.exported", entries[0].Action)

	// The list, as CSV, behind fresh credentials.
	query := "/users/export?q=" + strings.TrimPrefix(usersTestDomain, "@") + "&premium=gifted"
	rec = usersCall(env.server(admin, false), http.MethodGet, query, nil)
	assert.Equal(t, "reauth_required", usersErrorCode(t, rec))

	rec = usersCall(env.server(admin, true), http.MethodGet, query, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	lines, err := csv.NewReader(rec.Body).ReadAll()
	require.NoError(t, err)
	require.Len(t, lines, 2)
	assert.Equal(t, "identifiant", lines[0][0])
	assert.Equal(t, []string{strconv.FormatInt(target.ID, 10), target.Email, `'=HYPERLINK("https://example.invalid")`, "Utilisateur", "oui", "Offert", "", "oui"}, lines[1][:8])

	var detail string
	require.NoError(t, env.db.Raw("SELECT detail FROM bo_audit_log WHERE action = 'users.exported' AND actor_id = ? ORDER BY id DESC LIMIT 1", admin.ID).Scan(&detail).Error)
	assert.Equal(t, "1 lignes, recherche, premium gifted", detail)
}

func TestFavoriteTeamsAreNamedFromTheCacheOnly(t *testing.T) {
	env := newUsersTestEnv(t)
	ctx := context.Background()
	key := cache.LiqTeamPageIDKey("valorant", "4321")
	require.NoError(t, env.m.cache.Set(ctx, cache.LiqWikiHintKey("4321"), "valorant", time.Hour))
	require.NoError(t, env.m.cache.Set(ctx, cache.StaleKey(key), `{"result":[{"pageid":4321,"name":"Équipe en cache"}]}`, time.Hour))
	// Known wiki, page no longer cached; and a team never resolved.
	require.NoError(t, env.m.cache.Set(ctx, cache.LiqWikiHintKey("777"), "dota2", time.Hour))

	teams := env.m.favoriteTeams(ctx, []int64{4321, 777, 99})

	require.Len(t, teams, 3)
	require.NotNil(t, teams[0].Name)
	assert.Equal(t, "Équipe en cache", *teams[0].Name)
	assert.Nil(t, teams[1].Name)
	assert.Nil(t, teams[2].Name)
	assert.Empty(t, env.m.favoriteTeams(ctx, nil))
}
