package backoffice

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/testdb"
)

func healthTestLogger() *logrus.Logger {
	l := logrus.New()
	l.SetLevel(logrus.PanicLevel)
	return l
}

// healthModule has no built-in card: tests add the sources they need.
func healthModule(t *testing.T, cfg Config) *Module {
	t.Helper()
	m := &Module{cfg: cfg, http: &http.Client{Timeout: 5 * time.Second}, log: healthTestLogger()}
	m.health().builtin = nil
	t.Cleanup(func() { healthStates.Delete(m) })
	return m
}

func healthStaticSource(svc HealthService) func(context.Context) *HealthService {
	return func(context.Context) *HealthService { return &svc }
}

func TestFrenchWording(t *testing.T) {
	now := time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)
	cases := map[string]string{
		frInt(1000):                          "1 000",
		frInt(812):                           "812",
		frInt(1234567):                       "1 234 567",
		frBytes(412 * 1024 * 1024):           "412 Mo",
		frBytes(4.2 * 1024 * 1024 * 1024):    "4,2 Go",
		frCompact(1_900_000):                 "1,9 M",
		frCompact(4200):                      "4 200",
		frPercent(0.812):                     "81 %",
		frPercent(0.003):                     "0,3 %",
		frAgo(now.Add(-40*time.Second), now): "il y a 40 s",
		frAgo(now.Add(-12*time.Minute), now): "il y a 12 min",
		frAgo(now.Add(-3*time.Hour), now):    "il y a 3 h",
		frAgo(now.Add(-9*24*time.Hour), now): "il y a 9 j",
		frMillis(142 * time.Millisecond):     "142 ms",
		lowerFirst("État inconnu"):           "état inconnu",
	}
	for got, want := range cases {
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
}

func TestListLateAfterFollowsTheRealRefreshCycle(t *testing.T) {
	cases := []struct {
		name          string
		interval, ttl time.Duration
		webhooks      bool
		want          time.Duration
	}{
		// Polling: tick at 8 min finds the key alive (TTL 13), tick at 16 fetches; one more tick allowed.
		{"running, polling", services.PollIntervalMatchesRunning, services.TTLMatchesRunning, false, 24 * time.Minute},
		// Webhooks: the safety net fires on the 4th tick (32 min); one more tick allowed.
		{"running, webhooks", services.PollIntervalMatchesRunning, services.TTLMatchesRunning, true, 40 * time.Minute},
		{"upcoming, polling", services.PollIntervalMatchesUpcoming, services.TTLMatchesUpcoming, false, 60 * time.Minute},
		{"upcoming, webhooks", services.PollIntervalMatchesUpcoming, services.TTLMatchesUpcoming, true, 100 * time.Minute},
	}
	for _, tc := range cases {
		if got := listLateAfter(tc.interval, tc.ttl, tc.webhooks); got != tc.want {
			t.Errorf("%s: late after %s, want %s", tc.name, got, tc.want)
		}
	}
}

// pollerPicture is a poller in webhooks mode, started two hours ago, with
// every list fetched `age` ago and a quiet budget.
func pollerPicture(now time.Time, age time.Duration) liquipediaPicture {
	p := liquipediaPicture{
		now: now, configured: true, pollerOn: true, startedAt: now.Add(-2 * time.Hour), webhooks: true,
		budgets: map[string]budgetUse{}, refreshed: map[string]map[string]time.Time{}, lastWebhook: map[string]time.Time{},
	}
	for _, g := range healthWikiOrder() {
		p.budgets[g.wiki] = budgetUse{100, 1000}
		p.refreshed[g.wiki] = map[string]time.Time{
			services.ListMatchesRunning:  now.Add(-age),
			services.ListMatchesUpcoming: now.Add(-age),
		}
	}
	return p
}

func healthMetricValue(svc *HealthService, label string) string {
	for _, m := range svc.Metrics {
		if m.Label == label {
			return m.Value
		}
	}
	return ""
}

func healthWikiRow(t *testing.T, res healthResult, wiki string) HealthWiki {
	t.Helper()
	for _, w := range res.wikis {
		if w.Wiki == wiki {
			return w
		}
	}
	t.Fatalf("no row for %s", wiki)
	return HealthWiki{}
}

func TestLiquipediaHealthyPoller(t *testing.T) {
	now := time.Now()
	p := pollerPicture(now, 5*time.Minute)
	p.lastWebhook["valorant"] = now.Add(-40 * time.Second)
	res := judgeLiquipedia(p)

	if res.svc.Status != HealthOK || len(res.alerts) != 0 {
		t.Fatalf("status = %s, alerts = %+v", res.svc.Status, res.alerts)
	}
	if len(res.wikis) != 10 || res.wikis[0].Wiki != "counterstrike" || res.wikis[9].Game != "Mobile Legends" {
		t.Errorf("wikis = %+v", res.wikis)
	}
	if got := healthMetricValue(res.svc, "Listes du poller à jour"); got != "10 sur 10" {
		t.Errorf("lists = %q", got)
	}
	if got := healthMetricValue(res.svc, "Dernier webhook reçu"); got != "il y a 40 s" {
		t.Errorf("last webhook = %q", got)
	}
	if res.svc.Link == nil || res.svc.Link.URL != "#wikis" {
		t.Errorf("link = %+v", res.svc.Link)
	}
}

func TestLiquipediaBudgetWarnsFromEightyPercent(t *testing.T) {
	now := time.Now()
	p := pollerPicture(now, 5*time.Minute)
	p.budgets["rainbowsix"] = budgetUse{799, 1000}
	if res := judgeLiquipedia(p); res.svc.Status != HealthOK {
		t.Fatalf("799/1000 gave %s", res.svc.Status)
	}

	p.budgets["rainbowsix"] = budgetUse{812, 1000}
	res := judgeLiquipedia(p)
	if res.svc.Status != HealthWarn {
		t.Fatalf("812/1000 gave %s", res.svc.Status)
	}
	if got := healthMetricValue(res.svc, "Wiki le plus chargé"); got != "Rainbow Six Siege · 812 / 1 000" {
		t.Errorf("busiest = %q", got)
	}
	if len(res.alerts) != 1 {
		t.Fatalf("alerts = %+v", res.alerts)
	}
	a := res.alerts[0]
	if a.Level != "important" || a.Href != "/sante" ||
		a.Title != "Liquipedia · Rainbow Six Siege à 81 % du budget" || a.Detail != "812 appels sur 1 000 cette heure" {
		t.Errorf("alert = %+v", a)
	}
}

func TestLiquipediaAnElapsedTTLIsNotLate(t *testing.T) {
	now := time.Now()
	// 30 min: the running key (13 min) and the upcoming key (28 min) are both
	// gone, yet in webhooks mode the safety net is not due before 32 min.
	res := judgeLiquipedia(pollerPicture(now, 30*time.Minute))
	if res.svc.Status != HealthOK {
		t.Fatalf("status = %s, alerts = %+v", res.svc.Status, res.alerts)
	}
	if row := healthWikiRow(t, res, "valorant"); row.RunningExpired || row.UpcomingExpired {
		t.Errorf("row = %+v", row)
	}

	// The same age without webhooks is two missed ticks: late.
	p := pollerPicture(now, 30*time.Minute)
	p.webhooks = false
	if row := healthWikiRow(t, judgeLiquipedia(p), "valorant"); !row.RunningExpired || row.UpcomingExpired {
		t.Errorf("polling row = %+v", row)
	}
}

func TestLiquipediaLateListWarns(t *testing.T) {
	now := time.Now()
	p := pollerPicture(now, 5*time.Minute)
	p.refreshed["mobilelegends"][services.ListMatchesRunning] = now.Add(-47 * time.Minute)
	res := judgeLiquipedia(p)

	if res.svc.Status != HealthWarn {
		t.Fatalf("status = %s", res.svc.Status)
	}
	row := healthWikiRow(t, res, "mobilelegends")
	if !row.RunningExpired || row.UpcomingExpired {
		t.Errorf("row = %+v", row)
	}
	if got := healthMetricValue(res.svc, "Listes du poller à jour"); got != "9 sur 10" {
		t.Errorf("lists = %q", got)
	}
	if len(res.alerts) != 1 || res.alerts[0].Title != "Liquipedia · Mobile Legends, liste des matchs en direct en retard" ||
		res.alerts[0].Detail != "dernier rafraîchissement il y a 47 min" {
		t.Errorf("alerts = %+v", res.alerts)
	}
}

func TestLiquipediaNothingRefreshedIsDown(t *testing.T) {
	now := time.Now()
	res := judgeLiquipedia(pollerPicture(now, 3*time.Hour))
	if res.svc.Status != HealthDown {
		t.Fatalf("status = %s", res.svc.Status)
	}
	if got := healthMetricValue(res.svc, "Listes du poller à jour"); got != "0 sur 10" {
		t.Errorf("lists = %q", got)
	}
	// One sentence for the dashboard, not twenty lines.
	if len(res.alerts) != 1 || res.alerts[0].Title != "Liquipedia · le poller ne rafraîchit plus rien" {
		t.Errorf("alerts = %+v", res.alerts)
	}
}

func TestLiquipediaRestartGetsTheSameDelay(t *testing.T) {
	now := time.Now()
	p := pollerPicture(now, 0)
	p.refreshed = nil
	p.startedAt = now.Add(-10 * time.Minute)
	res := judgeLiquipedia(p)
	if res.svc.Status != HealthOK {
		t.Fatalf("10 min after a restart: %s", res.svc.Status)
	}
	if row := healthWikiRow(t, res, "dota2"); row.RunningRefreshedAt != nil || row.RunningExpired {
		t.Errorf("row = %+v", row)
	}

	p.startedAt = now.Add(-2 * time.Hour)
	if res := judgeLiquipedia(p); res.svc.Status != HealthDown {
		t.Fatalf("2 h after a restart with nothing fetched: %s", res.svc.Status)
	}
}

func TestLiquipediaPollerOff(t *testing.T) {
	now := time.Now()
	p := pollerPicture(now, 3*time.Hour)
	p.pollerOn = false
	p.startedAt = time.Time{}
	res := judgeLiquipedia(p)

	if res.svc.Status != HealthOK || len(res.alerts) != 0 {
		t.Fatalf("status = %s, alerts = %+v", res.svc.Status, res.alerts)
	}
	if !strings.Contains(res.svc.Note, "Poller arrêté") {
		t.Errorf("note = %q", res.svc.Note)
	}
	if got := healthMetricValue(res.svc, "Listes du poller à jour"); got != "" {
		t.Errorf("a stopped poller has no list count, got %q", got)
	}
	if row := healthWikiRow(t, res, "valorant"); row.RunningExpired || row.UpcomingExpired {
		t.Errorf("row = %+v", row)
	}

	// The budget still counts: on-demand calls go on without the poller.
	p.budgets["valorant"] = budgetUse{900, 1000}
	if res := judgeLiquipedia(p); res.svc.Status != HealthWarn {
		t.Errorf("900/1000 with the poller off gave %s", res.svc.Status)
	}
}

func TestLiquipediaWithoutKeyIsUnconfigured(t *testing.T) {
	p := pollerPicture(time.Now(), 3*time.Hour)
	p.configured, p.pollerOn = false, false
	res := judgeLiquipedia(p)
	if res.svc.Status != HealthUnconfigured || len(res.svc.Missing) != 1 || res.svc.Missing[0] != "LIQUIPEDIA_API_KEY" {
		t.Fatalf("svc = %+v", res.svc)
	}
	if len(res.svc.Metrics) != 0 || len(res.alerts) != 0 || len(res.wikis) != 10 {
		t.Errorf("metrics = %+v, alerts = %+v, wikis = %d", res.svc.Metrics, res.alerts, len(res.wikis))
	}
}

// ---- snapshot ----

func TestSnapshotIsBuiltOncePerMinute(t *testing.T) {
	m := healthModule(t, Config{})
	var builds atomic.Int32
	m.addHealthSource("a", func(context.Context) *HealthService {
		builds.Add(1)
		return &HealthService{Key: "a", Name: "A", Status: HealthOK}
	})
	ctx := context.Background()

	first, err := m.healthSnapshot(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	second, _ := m.healthSnapshot(ctx, false)
	// « Actualiser » right after a build shares it.
	third, _ := m.healthSnapshot(ctx, true)
	if builds.Load() != 1 || first != second || first != third {
		t.Fatalf("builds = %d", builds.Load())
	}

	h := m.health()
	h.mu.Lock()
	h.snapshot.RefreshedAt = time.Now().Add(-30 * time.Second)
	h.mu.Unlock()
	if _, _ = m.healthSnapshot(ctx, false); builds.Load() != 1 {
		t.Fatalf("a 30 s old snapshot was rebuilt")
	}
	if _, _ = m.healthSnapshot(ctx, true); builds.Load() != 2 {
		t.Fatalf("fresh did not rebuild a 30 s old snapshot (builds = %d)", builds.Load())
	}

	h.mu.Lock()
	h.snapshot.RefreshedAt = time.Now().Add(-61 * time.Second)
	h.mu.Unlock()
	if _, _ = m.healthSnapshot(ctx, false); builds.Load() != 3 {
		t.Fatalf("a 61 s old snapshot was served (builds = %d)", builds.Load())
	}
}

func TestSnapshotConcurrentCallersShareOneBuild(t *testing.T) {
	m := healthModule(t, Config{})
	var builds atomic.Int32
	release := make(chan struct{})
	m.addHealthSource("slow", func(context.Context) *HealthService {
		builds.Add(1)
		<-release
		return &HealthService{Key: "slow", Name: "Slow", Status: HealthOK}
	})
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := m.healthSnapshot(context.Background(), true); err != nil {
				t.Error(err)
			}
		}()
	}
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()
	if builds.Load() != 1 {
		t.Fatalf("builds = %d", builds.Load())
	}
}

func TestSnapshotAFailingSourceOnlyBreaksItsOwnCard(t *testing.T) {
	m := healthModule(t, Config{})
	m.health().sourceWait = 100 * time.Millisecond
	m.addHealthSource("ok", healthStaticSource(HealthService{Key: "ok", Name: "Sain", Status: HealthOK}))
	m.addHealthSource("panic", func(context.Context) *HealthService { panic("boom") })
	m.addHealthSource("stuck", func(ctx context.Context) *HealthService {
		time.Sleep(time.Second)
		return &HealthService{Key: "stuck", Status: HealthOK}
	})
	m.addHealthSource("warn", healthStaticSource(HealthService{Key: "warn", Name: "Lent", Status: HealthWarn, Note: "Répond lentement"}))
	m.addHealthSource("off", healthStaticSource(HealthService{Key: "off", Name: "Absent", Status: HealthUnconfigured, Missing: []string{"X_TOKEN"}}))
	m.addHealthSource("none", func(context.Context) *HealthService { return nil })

	snap, err := m.healthSnapshot(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Services) != 5 {
		t.Fatalf("services = %+v", snap.Services)
	}
	if snap.Services[1].Status != HealthDown || snap.Services[2].Status != HealthDown || snap.Services[2].Note != "Pas de réponse en 0 s" {
		t.Errorf("panic card = %+v, stuck card = %+v", snap.Services[1], snap.Services[2])
	}
	if snap.Counts != (HealthCounts{OK: 1, Warn: 1, Down: 2}) {
		t.Errorf("counts = %+v", snap.Counts)
	}
	// The order of the cards is the order of registration; alerts follow it.
	if len(snap.Alerts) != 3 || snap.Alerts[2].Title != "Lent · à surveiller" || snap.Alerts[2].Detail != "répond lentement" || snap.Alerts[0].Title != "panic · en panne" {
		t.Errorf("alerts = %+v", snap.Alerts)
	}
	if snap.Services[0].Metrics == nil || snap.Wikis == nil {
		t.Errorf("empty lists must serialize as [], not null")
	}
}

func healthNavContext(role Role) echo.Context {
	c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/api/bo/nav", nil), httptest.NewRecorder())
	c.Set(ctxSession, &Session{User: &teamUser{ID: 1, Role: role}})
	return c
}

func TestNavCounterReadsTheCacheAndNeverWaits(t *testing.T) {
	m := healthModule(t, Config{})
	var builds atomic.Int32
	release := make(chan struct{})
	m.addHealthSource("warn", func(context.Context) *HealthService {
		builds.Add(1)
		<-release
		return &HealthService{Key: "warn", Name: "Lent", Status: HealthWarn}
	})
	m.addHealthSource("down", healthStaticSource(HealthService{Key: "down", Name: "Cassé", Status: HealthDown}))

	if n := m.navHealthAlerts(healthNavContext(RoleEditor)); n != nil {
		t.Fatalf("an editor cannot read health, got %d", *n)
	}
	if builds.Load() != 0 {
		t.Fatalf("a member without the permission triggered a build")
	}
	// No picture yet: no badge, and a build starts behind the request.
	if n := m.navHealthAlerts(healthNavContext(RoleReader)); n != nil {
		t.Fatalf("first page view waited for a build")
	}
	close(release)
	deadline := time.Now().Add(2 * time.Second)
	for m.health().cached(time.Minute) == nil {
		if time.Now().After(deadline) {
			t.Fatal("background build never finished")
		}
		time.Sleep(10 * time.Millisecond)
	}
	for i := 0; i < 5; i++ {
		if n := m.navHealthAlerts(healthNavContext(RoleAdmin)); n == nil || *n != 2 {
			t.Fatalf("counter = %v", n)
		}
	}
	if builds.Load() != 1 {
		t.Fatalf("page views rebuilt the snapshot: %d builds", builds.Load())
	}
}

// ---- local probes ----

func TestRedisCardFromALocalServer(t *testing.T) {
	mr := miniredis.RunT(t)
	m := healthModule(t, Config{})
	m.cache = cache.NewRedisClient("redis://" + mr.Addr())
	res := m.healthRedis(context.Background())
	if res.svc.Name != "Redis" || res.svc.Status != HealthOK || res.svc.Link != nil {
		t.Fatalf("svc = %+v", res.svc)
	}
	if got := healthMetricValue(res.svc, "Temps de réponse"); !strings.HasSuffix(got, " ms") {
		t.Errorf("latency = %q", got)
	}

	mr.Close()
	if res := m.healthRedis(context.Background()); res.svc.Status != HealthDown || len(res.svc.Metrics) != 0 {
		t.Errorf("unreachable Redis gave %+v", res.svc)
	}
}

func TestRedisInfoField(t *testing.T) {
	info := "# Memory\r\nused_memory:1048576\r\nused_memory_human:1.00M\r\n# Clients\r\nconnected_clients:4\r\n"
	if v, ok := redisInfoField(info, "used_memory"); !ok || v != "1048576" {
		t.Errorf("used_memory = %q, %v", v, ok)
	}
	if v, ok := redisInfoField(info, "connected_clients"); !ok || v != "4" {
		t.Errorf("connected_clients = %q, %v", v, ok)
	}
	if _, ok := redisInfoField(info, "maxmemory"); ok {
		t.Errorf("found a field that is not there")
	}
}

func TestSupabaseProject(t *testing.T) {
	cases := []struct {
		host, user, ref string
		supabase        bool
	}{
		{"db.abcdefgh.supabase.co", "postgres", "abcdefgh", true},
		{"aws-0-eu-west-3.pooler.supabase.com", "postgres.abcdefgh", "abcdefgh", true},
		{"aws-0-eu-west-3.pooler.supabase.com", "postgres", "", true},
		{"127.0.0.1", "postgres", "", false},
		{"postgres.railway.internal", "postgres.x", "", false},
	}
	for _, tc := range cases {
		ref, ok := supabaseProject(tc.host, tc.user)
		if ref != tc.ref || ok != tc.supabase {
			t.Errorf("%s / %s: got %q, %v", tc.host, tc.user, ref, ok)
		}
	}
}

func TestProxyCard(t *testing.T) {
	m := healthModule(t, Config{})
	if res := m.healthProxy(context.Background()); res.svc.Status != HealthUnconfigured || res.svc.Missing[0] != "LIQUIPEDIA_HTTP_PROXY" {
		t.Fatalf("no proxy: %+v", res.svc)
	}

	// A listener that accepts and says nothing: the probe is a TCP connection,
	// never a request that the proxy would forward to Liquipedia.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	var received atomic.Int32
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				buf := make([]byte, 1)
				_ = conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
				if n, _ := conn.Read(buf); n > 0 {
					received.Add(1)
				}
				_ = conn.Close()
			}()
		}
	}()
	m.cfg.LiquipediaProxyURL = "http://user:secret@" + ln.Addr().String()
	res := m.healthProxy(context.Background())
	if res.svc.Status != HealthOK || healthMetricValue(res.svc, "Sonde du backend") != "Joignable" ||
		healthMetricValue(res.svc, "Dernier refus de Liquipedia") != "Aucun enregistré" {
		t.Fatalf("reachable proxy: %+v", res.svc)
	}
	for _, metric := range res.svc.Metrics {
		if strings.Contains(metric.Value, "secret") {
			t.Fatalf("credentials leaked in %+v", metric)
		}
	}
	time.Sleep(300 * time.Millisecond)
	if received.Load() != 0 {
		t.Fatalf("the probe sent bytes through the proxy")
	}

	// A refusal within the hour turns the card amber, an old one is only shown.
	h := m.health()
	h.last429 = time.Now().Add(-20 * time.Minute)
	if res := m.healthProxy(context.Background()); res.svc.Status != HealthWarn || healthMetricValue(res.svc, "Dernier refus de Liquipedia") != "il y a 20 min" {
		t.Errorf("recent refusal: %+v", res.svc)
	}
	h.last429 = time.Now().Add(-9 * 24 * time.Hour)
	if res := m.healthProxy(context.Background()); res.svc.Status != HealthOK || healthMetricValue(res.svc, "Dernier refus de Liquipedia") != "il y a 9 j" {
		t.Errorf("old refusal: %+v", res.svc)
	}

	_ = ln.Close()
	if res := m.healthProxy(context.Background()); res.svc.Status != HealthDown || healthMetricValue(res.svc, "Sonde du backend") != "Injoignable" {
		t.Errorf("closed proxy: %+v", res.svc)
	}
}

func TestProxyAddressDropsCredentials(t *testing.T) {
	cases := map[string]string{
		"http://esportnews:pass@164.132.194.8:8888": "164.132.194.8:8888",
		"http://proxy.example.net":                  "proxy.example.net:80",
		"https://proxy.example.net":                 "proxy.example.net:443",
	}
	for raw, want := range cases {
		if got, err := proxyAddress(raw); err != nil || got != want {
			t.Errorf("%s: got %q, %v", raw, got, err)
		}
	}
	if _, err := proxyAddress("://nope"); err == nil {
		t.Errorf("an unreadable URL was accepted")
	}
}

// ---- 5xx counter and database card (need Postgres) ----

// healthTestDB creates the two tables this domain writes, from the statements
// of the real schema (the whole schema needs the site's tables).
func healthTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testdb.Open(t)
	created := 0
	for _, stmt := range schemaStatements {
		if strings.HasPrefix(stmt, "CREATE TABLE IF NOT EXISTS bo_http_error") || strings.HasPrefix(stmt, "CREATE TABLE IF NOT EXISTS bo_setting") {
			if err := db.Exec(stmt).Error; err != nil {
				t.Fatal(err)
			}
			created++
		}
	}
	if created != 2 {
		t.Fatalf("schema.go no longer creates bo_http_error and bo_setting (%d found)", created)
	}
	return db
}

func TestServerErrorCounterIsFlushedByHour(t *testing.T) {
	db := healthTestDB(t)
	if err := db.Exec("DELETE FROM bo_http_error").Error; err != nil {
		t.Fatal(err)
	}
	m := healthModule(t, Config{})
	m.db = db
	ctx := context.Background()

	// Not wired: no row rather than a zero nobody counted.
	if _, err := m.serverErrors24h(ctx); err != errNoServerErrorCounter {
		t.Fatalf("unwired counter: %v", err)
	}
	if res := m.healthRailway(ctx); len(res.svc.Metrics) != 0 {
		t.Fatalf("unwired counter gave %+v", res.svc.Metrics)
	}

	var total atomic.Int64
	m.SetHealthSources(HealthSources{ServerErrors: total.Load})
	db.Exec("INSERT INTO bo_http_error (hour, count) VALUES (date_trunc('hour', now()) - interval '3 hours', 30), (date_trunc('hour', now()) - interval '30 hours', 500)")

	total.Store(5)
	// Before the flush, the pending 5 already count.
	if n, err := m.serverErrors24h(ctx); err != nil || n != 35 {
		t.Fatalf("before flush: %d, %v", n, err)
	}
	if err := m.flushServerErrors(ctx); err != nil {
		t.Fatal(err)
	}
	total.Store(7)
	if err := m.flushServerErrors(ctx); err != nil {
		t.Fatal(err)
	}
	// Nothing new: no write, and no double count.
	if err := m.flushServerErrors(ctx); err != nil {
		t.Fatal(err)
	}
	var rows, current int64
	db.Raw("SELECT count(*) FROM bo_http_error").Scan(&rows)
	db.Raw("SELECT count FROM bo_http_error WHERE hour = date_trunc('hour', now())").Scan(&current)
	if rows != 3 || current != 7 {
		t.Fatalf("rows = %d, current hour = %d", rows, current)
	}
	total.Store(9)
	if n, err := m.serverErrors24h(ctx); err != nil || n != 39 {
		t.Fatalf("after flush: %d, %v", n, err)
	}

	// The row is on the Railway card even when Railway is not connected.
	res := m.healthRailway(ctx)
	if res.svc.Status != HealthUnconfigured || healthMetricValue(res.svc, "Réponses 5xx · 24 h") != "39" {
		t.Fatalf("railway card = %+v", res.svc)
	}
	if strings.Join(res.svc.Missing, ",") != "RAILWAY_API_TOKEN,RAILWAY_SERVICE_ID,RAILWAY_ENVIRONMENT_ID" {
		t.Errorf("missing = %v", res.svc.Missing)
	}

	m.purgeServerErrors(ctx)
	db.Raw("SELECT count(*) FROM bo_http_error").Scan(&rows)
	if rows != 3 {
		t.Errorf("purge removed a bucket younger than 30 days")
	}
	db.Exec("INSERT INTO bo_http_error (hour, count) VALUES (date_trunc('hour', now()) - interval '40 days', 1)")
	m.purgeServerErrors(ctx)
	db.Raw("SELECT count(*) FROM bo_http_error").Scan(&rows)
	if rows != 3 {
		t.Errorf("purge kept a 40 days old bucket")
	}
}

func TestPostgresCardFromALocalServer(t *testing.T) {
	db := testdb.Open(t)
	m := healthModule(t, Config{})
	m.db = db
	res := m.healthPostgres(context.Background())
	if res.svc.Name != "PostgreSQL" || res.svc.Status != HealthOK || res.svc.Link != nil {
		t.Fatalf("svc = %+v", res.svc)
	}
	if size := healthMetricValue(res.svc, "Taille de la base"); !strings.HasSuffix(size, " Mo") && !strings.HasSuffix(size, " Ko") && !strings.HasSuffix(size, " Go") {
		t.Errorf("size = %q", size)
	}
	if conns := healthMetricValue(res.svc, "Connexions"); !strings.Contains(conns, " sur ") {
		t.Errorf("connections = %q", conns)
	}
}

func TestLast429SurvivesARestart(t *testing.T) {
	db := healthTestDB(t)
	db.Exec("DELETE FROM bo_setting WHERE key = ?", settingLast429)
	at := time.Now().Add(-9 * 24 * time.Hour).UTC().Truncate(time.Second)

	before := healthModule(t, Config{})
	before.db = db
	if err := before.setSetting(context.Background(), settingLast429, at.Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}

	after := healthModule(t, Config{})
	after.db = db
	ctx, cancel := context.WithCancel(context.Background())
	after.startHealthJobs(ctx)
	cancel()
	if got := after.lastLiquipedia429(); !got.Equal(at) {
		t.Fatalf("last 429 after restart = %s, want %s", got, at)
	}
}
