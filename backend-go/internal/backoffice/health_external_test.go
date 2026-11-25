package backoffice

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"

	"github.com/esportnews/backend/internal/cache"
)

// The fakes below answer with the shapes of the official references:
// Vercel « List deployments » (GET /v7/deployments), Railway's public GraphQL
// schema (service, serviceInstance, metrics), Upstash « Get database stats »
// (GET /v2/redis/stats/{id}) and Resend « List emails » (GET /emails).

func healthFakeAPI(t *testing.T, handler http.HandlerFunc) string {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv.URL
}

// ---- Vercel ----

func vercelModule(t *testing.T, handler http.HandlerFunc) *Module {
	m := healthModule(t, Config{VercelToken: "tok", VercelProjectID: "prj_1", VercelTeamID: "team_1"})
	m.health().endpoints.vercel = healthFakeAPI(t, handler)
	return m
}

func TestVercelUnconfiguredShowsNoNumber(t *testing.T) {
	m := healthModule(t, Config{VercelTeamID: "team_1"})
	m.health().endpoints.vercel = healthFakeAPI(t, func(http.ResponseWriter, *http.Request) {
		t.Error("an unconfigured source must not be called")
	})
	res := m.healthVercel(context.Background())
	if res.svc.Status != HealthUnconfigured || strings.Join(res.svc.Missing, ",") != "VERCEL_API_TOKEN,VERCEL_PROJECT_ID" || len(res.svc.Metrics) != 0 {
		t.Fatalf("svc = %+v", res.svc)
	}
}

func TestVercelLatestProductionDeployment(t *testing.T) {
	ready := time.Now().Add(-3 * time.Hour).UnixMilli()
	m := vercelModule(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.URL.Path != "/v7/deployments" || r.Header.Get("Authorization") != "Bearer tok" ||
			q.Get("projectId") != "prj_1" || q.Get("teamId") != "team_1" || q.Get("target") != "production" || q.Get("limit") != "1" {
			http.Error(w, `{"error":{"code":"forbidden"}}`, http.StatusForbidden)
			return
		}
		fmt.Fprintf(w, `{"deployments":[{"uid":"dpl_1","name":"esportnews","url":"esportnews-abc.vercel.app",
			"created":%d,"createdAt":%d,"ready":%d,"state":"READY","readyState":"READY","target":"production","type":"LAMBDAS",
			"inspectorUrl":"https://vercel.com/acme/esportnews/dpl1",
			"meta":{"githubCommitSha":"e5d94f4f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f","githubCommitRef":"main"}}],
			"pagination":{"count":1,"next":null,"prev":null}}`, ready-60000, ready-60000, ready)
	})
	res := m.healthVercel(context.Background())
	if res.svc.Status != HealthOK {
		t.Fatalf("svc = %+v", res.svc)
	}
	if got := healthMetricValue(res.svc, "Dernier déploiement"); got != "Prêt · il y a 3 h" {
		t.Errorf("deployment = %q", got)
	}
	if got := healthMetricValue(res.svc, "Commit"); got != "e5d94f4f" || !res.svc.Metrics[1].Mono {
		t.Errorf("commit = %q", got)
	}
	if res.svc.Link.URL != "https://vercel.com/acme/esportnews/dpl1" {
		t.Errorf("link = %+v", res.svc.Link)
	}
}

func TestVercelFailedDeploymentAndMissingCommit(t *testing.T) {
	m := vercelModule(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"deployments":[{"uid":"dpl_2","created":%d,"readyState":"ERROR","inspectorUrl":null,"meta":{}}],"pagination":{"count":1}}`,
			time.Now().Add(-10*time.Minute).UnixMilli())
	})
	res := m.healthVercel(context.Background())
	if res.svc.Status != HealthWarn || healthMetricValue(res.svc, "Dernier déploiement") != "En erreur · il y a 10 min" {
		t.Fatalf("svc = %+v", res.svc)
	}
	if len(res.svc.Metrics) != 1 || res.svc.Link.URL != "https://vercel.com/dashboard" {
		t.Errorf("no commit and no inspector URL expected: %+v, %+v", res.svc.Metrics, res.svc.Link)
	}
}

func TestVercelCallFailureDegradesOnlyTheCard(t *testing.T) {
	m := vercelModule(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"code":"forbidden","message":"Not authorized"}}`, http.StatusForbidden)
	})
	res := m.healthVercel(context.Background())
	if res.svc.Status != HealthDown || res.svc.Note != "Appel à l'API Vercel impossible : HTTP 403" || len(res.svc.Metrics) != 0 {
		t.Fatalf("svc = %+v", res.svc)
	}

	m = vercelModule(t, func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "<html>gateway</html>") })
	if res := m.healthVercel(context.Background()); res.svc.Status != HealthDown || !strings.HasSuffix(res.svc.Note, "réponse illisible") {
		t.Errorf("HTML answer: %+v", res.svc)
	}

	m = vercelModule(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"deployments":[],"pagination":{"count":0}}`)
	})
	if res := m.healthVercel(context.Background()); res.svc.Status != HealthWarn || len(res.svc.Metrics) != 0 {
		t.Errorf("no deployment: %+v", res.svc)
	}
}

// ---- Railway ----

type railwayRequest struct {
	Query     string            `json:"query"`
	Variables map[string]string `json:"variables"`
}

func railwayModule(t *testing.T, handler http.HandlerFunc) *Module {
	m := healthModule(t, Config{RailwayToken: "rw", RailwayProjectID: "proj-1", RailwayServiceID: "svc-1", RailwayEnvironmentID: "env-1"})
	m.health().endpoints.railway = healthFakeAPI(t, handler)
	return m
}

const railwayHealthy = `{"data":{
	"service":{"name":"app-esportnews"},
	"serviceInstance":{"latestDeployment":{"status":"SUCCESS"}},
	"metrics":[
		{"measurement":"CPU_USAGE","values":[{"ts":1764072000,"value":0.9},{"ts":1764072060,"value":1.44}]},
		{"measurement":"CPU_LIMIT","values":[{"ts":1764072000,"value":8},{"ts":1764072060,"value":8}]},
		{"measurement":"MEMORY_USAGE_GB","values":[{"ts":1764072000,"value":0.39},{"ts":1764072060,"value":0.40234375}]}
	]}}`

func TestRailwayServiceMetrics(t *testing.T) {
	m := railwayModule(t, func(w http.ResponseWriter, r *http.Request) {
		var req railwayRequest
		body, _ := io.ReadAll(r.Body)
		if r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer rw" || json.Unmarshal(body, &req) != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		start, err := time.Parse(time.RFC3339, req.Variables["startDate"])
		if req.Variables["serviceId"] != "svc-1" || req.Variables["environmentId"] != "env-1" || err != nil || time.Since(start) > 15*time.Minute ||
			!strings.Contains(req.Query, "measurements: [CPU_USAGE, CPU_LIMIT, MEMORY_USAGE_GB]") {
			http.Error(w, "bad variables", http.StatusBadRequest)
			return
		}
		fmt.Fprint(w, railwayHealthy)
	})
	res := m.healthRailway(context.Background())
	if res.svc.Status != HealthOK || res.svc.Note != "" {
		t.Fatalf("svc = %+v", res.svc)
	}
	if got := healthMetricValue(res.svc, "Service"); got != "app-esportnews" || !res.svc.Metrics[0].Mono {
		t.Errorf("service = %q", got)
	}
	// Last sample of each series: 1.44 of 8 vCPU, 0.40234375 GB.
	if got := healthMetricValue(res.svc, "CPU · mémoire"); got != "18 % · 412 Mo" {
		t.Errorf("cpu and memory = %q", got)
	}
	if res.svc.Link.URL != "https://railway.com/project/proj-1" {
		t.Errorf("link = %+v", res.svc.Link)
	}
}

func TestRailwayProjectTokenIsTriedAfterARefusal(t *testing.T) {
	var bearer, project int
	m := railwayModule(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Project-Access-Token") == "rw" {
			project++
			fmt.Fprint(w, railwayHealthy)
			return
		}
		bearer++
		fmt.Fprint(w, `{"errors":[{"message":"Not Authorized"}],"data":null}`)
	})
	if res := m.healthRailway(context.Background()); res.svc.Status != HealthOK {
		t.Fatalf("svc = %+v", res.svc)
	}
	// The header that worked is remembered: no second refusal.
	if res := m.healthRailway(context.Background()); res.svc.Status != HealthOK || bearer != 1 || project != 2 {
		t.Fatalf("bearer calls = %d, project calls = %d", bearer, project)
	}
}

func TestRailwayRefusalAndPartialAnswers(t *testing.T) {
	m := railwayModule(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"errors":[{"message":"Not Authorized"}]}`)
	})
	res := m.healthRailway(context.Background())
	if res.svc.Status != HealthDown || res.svc.Note != "Appel à l'API Railway impossible : Not Authorized" || len(res.svc.Metrics) != 0 {
		t.Fatalf("refused: %+v", res.svc)
	}

	// No sample and no CPU limit: the row is left out, nothing is made up.
	m = railwayModule(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"data":{"service":{"name":"app-esportnews"},"serviceInstance":{"latestDeployment":{"status":"CRASHED"}},
			"metrics":[{"measurement":"CPU_USAGE","values":[]},{"measurement":"MEMORY_USAGE_GB","values":[{"ts":1,"value":0.5}]}]}}`)
	})
	res = m.healthRailway(context.Background())
	if res.svc.Status != HealthWarn || res.svc.Note != "Le dernier déploiement a planté" {
		t.Fatalf("crashed: %+v", res.svc)
	}
	if healthMetricValue(res.svc, "CPU · mémoire") != "" || healthMetricValue(res.svc, "Mémoire") != "512 Mo" {
		t.Errorf("metrics = %+v", res.svc.Metrics)
	}

	m = railwayModule(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	})
	if res := m.healthRailway(context.Background()); res.svc.Status != HealthDown || !strings.HasSuffix(res.svc.Note, "HTTP 429") {
		t.Errorf("429: %+v", res.svc)
	}
}

// ---- Upstash ----

func TestUpstashStats(t *testing.T) {
	m := healthModule(t, Config{UpstashEmail: "ops@example.com", UpstashAPIKey: "key", UpstashDatabaseID: "db-1"})
	m.health().endpoints.upstash = healthFakeAPI(t, func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "ops@example.com" || pass != "key" || r.URL.Path != "/v2/redis/stats/db-1" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		fmt.Fprint(w, `{"daily_net_commands":1900000,"daily_read_requests":1500000,"daily_write_requests":400000,
			"dailybandwidth":4509715660,"total_monthly_bandwidth":50444740913,"total_monthly_requests":41000000,
			"total_monthly_billing":48.339,"current_storage":1048576,
			"dailyrequests":[{"x":"2026-11-24 00:00:00 +0000 UTC","y":1800000}],"days":["Monday","Tuesday"]}`)
	})
	rows, err := m.upstashStats(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := []HealthMetric{
		{Label: "Commandes · aujourd'hui", Value: "1,9 M"},
		{Label: "Bande passante · aujourd'hui", Value: "4,2 Go"},
		{Label: "Coût du mois", Value: "48,34 $"},
	}
	if len(rows) != len(want) {
		t.Fatalf("rows = %+v", rows)
	}
	for i := range want {
		if rows[i] != want[i] {
			t.Errorf("row %d = %+v, want %+v", i, rows[i], want[i])
		}
	}
}

func TestUpstashLeavesOutWhatTheAPIDoesNotGive(t *testing.T) {
	m := healthModule(t, Config{UpstashEmail: "ops@example.com", UpstashAPIKey: "key", UpstashDatabaseID: "db-1"})
	m.health().endpoints.upstash = healthFakeAPI(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"daily_net_commands":7}`)
	})
	rows, err := m.upstashStats(context.Background())
	if err != nil || len(rows) != 1 || rows[0].Value != "7" {
		t.Fatalf("rows = %+v, err = %v", rows, err)
	}

	m.health().endpoints.upstash = healthFakeAPI(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
	if _, err := m.upstashStats(context.Background()); err == nil || healthCallError(err) != "HTTP 401" {
		t.Fatalf("err = %v", err)
	}
}

// A Redis that is not Upstash never calls the Upstash API, whatever is configured.
func TestPlainRedisDoesNotCallUpstash(t *testing.T) {
	mr := miniredis.RunT(t)
	m := healthModule(t, Config{UpstashEmail: "ops@example.com", UpstashAPIKey: "key", UpstashDatabaseID: "db-1"})
	m.cache = cache.NewRedisClient("redis://" + mr.Addr())
	m.health().endpoints.upstash = healthFakeAPI(t, func(http.ResponseWriter, *http.Request) {
		t.Error("the Upstash API was called for a local Redis")
	})
	if res := m.healthRedis(context.Background()); res.svc.Name != "Redis" || res.svc.Status != HealthOK {
		t.Fatalf("svc = %+v", res.svc)
	}
}

// ---- Resend ----

func resendModule(t *testing.T, handler http.HandlerFunc) *Module {
	m := healthModule(t, Config{ResendAPIKey: "re_1"})
	m.health().endpoints.resend = healthFakeAPI(t, handler)
	return m
}

func resendRow(id string, at time.Time, event string) string {
	return fmt.Sprintf(`{"id":%q,"message_id":"<%s@example.com>","to":["user@example.com"],"from":"Esport News <noreply@example.com>",
		"created_at":%q,"subject":"Bienvenue","bcc":null,"cc":null,"reply_to":null,"last_event":%q,"scheduled_at":null}`,
		id, id, at.UTC().Format("2006-01-02 15:04:05.000000+00"), event)
}

func TestParseResendTime(t *testing.T) {
	want := time.Date(2026, 4, 3, 22, 13, 42, 674981000, time.UTC)
	for _, s := range []string{"2026-04-03 22:13:42.674981+00", "2026-04-03 22:13:42.674981+00:00", "2026-04-03T22:13:42.674981Z"} {
		if got, err := parseResendTime(s); err != nil || !got.Equal(want) {
			t.Errorf("%s: got %s, %v", s, got, err)
		}
	}
	if _, err := parseResendTime("yesterday"); err == nil {
		t.Errorf("an unreadable date was accepted")
	}
}

func TestResendWeekIsCountedAcrossPages(t *testing.T) {
	now := time.Now()
	var calls []string
	m := resendModule(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.URL.Path != "/emails" || r.Header.Get("Authorization") != "Bearer re_1" || q.Get("limit") != "100" {
			http.Error(w, `{"statusCode":401,"name":"missing_api_key","message":"Missing API Key"}`, http.StatusUnauthorized)
			return
		}
		calls = append(calls, q.Get("after"))
		switch q.Get("after") {
		case "":
			fmt.Fprintf(w, `{"object":"list","has_more":true,"data":[%s,%s,%s,%s]}`,
				resendRow("e1", now.Add(-time.Hour), "delivered"),
				resendRow("e2", now.Add(-2*time.Hour), "bounced"),
				resendRow("e3", now.Add(-3*time.Hour), "scheduled"),
				resendRow("e4", now.Add(-26*time.Hour), "opened"))
		case "e4":
			fmt.Fprintf(w, `{"object":"list","has_more":true,"data":[%s,%s,%s]}`,
				resendRow("e5", now.Add(-5*24*time.Hour), "failed"),
				resendRow("e6", now.Add(-8*24*time.Hour), "delivered"),
				resendRow("e7", now.Add(-9*24*time.Hour), "bounced"))
		default:
			t.Errorf("paged past the window: after=%s", q.Get("after"))
		}
	})
	res := m.healthResend(context.Background())
	if strings.Join(calls, "|") != "|e4" {
		t.Fatalf("calls = %v", calls)
	}
	// e3 is not sent yet; e6 and e7 are older than 7 days.
	if healthMetricValue(res.svc, "E-mails envoyés · 7 j") != "4" || healthMetricValue(res.svc, "Rebonds") != "1" || healthMetricValue(res.svc, "Échecs") != "1" {
		t.Fatalf("metrics = %+v", res.svc.Metrics)
	}
	if res.svc.Status != HealthWarn || res.svc.Note != "1 envoi en échec sur 7 jours" {
		t.Errorf("svc = %+v", res.svc)
	}
}

func TestResendQuietWeekAndBusyWeek(t *testing.T) {
	m := resendModule(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"object":"list","has_more":false,"data":[]}`)
	})
	res := m.healthResend(context.Background())
	if res.svc.Status != HealthOK || healthMetricValue(res.svc, "E-mails envoyés · 7 j") != "0" {
		t.Fatalf("quiet week: %+v", res.svc)
	}

	pages := 0
	now := time.Now()
	m = resendModule(t, func(w http.ResponseWriter, r *http.Request) {
		pages++
		rows := make([]string, 100)
		for i := range rows {
			rows[i] = resendRow(fmt.Sprintf("p%d-%d", pages, i), now.Add(-time.Minute), "delivered")
		}
		fmt.Fprintf(w, `{"object":"list","has_more":true,"data":[%s]}`, strings.Join(rows, ","))
	})
	res = m.healthResend(context.Background())
	if pages != resendMaxPages || healthMetricValue(res.svc, "E-mails envoyés · 7 j") != "plus de 500" {
		t.Fatalf("busy week: %d pages, %+v", pages, res.svc.Metrics)
	}
}

func TestResendSendingOnlyKeyAndFailure(t *testing.T) {
	m := resendModule(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{"statusCode":401,"name":"restricted_api_key","message":"This API key is restricted to only send emails."}`)
	})
	res := m.healthResend(context.Background())
	if res.svc.Status != HealthUnconfigured || len(res.svc.Metrics) != 0 || !strings.Contains(res.svc.Note, "Full access") {
		t.Fatalf("sending-only key: %+v", res.svc)
	}

	m = resendModule(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		fmt.Fprint(w, `{"statusCode":503,"name":"service_unavailable","message":"API is temporarily unavailable"}`)
	})
	res = m.healthResend(context.Background())
	if res.svc.Status != HealthDown || res.svc.Note != "Appel à l'API Resend impossible : HTTP 503 (service_unavailable)" {
		t.Fatalf("outage: %+v", res.svc)
	}

	m = healthModule(t, Config{})
	if res := m.healthResend(context.Background()); res.svc.Status != HealthUnconfigured || res.svc.Missing[0] != "RESEND_API_KEY" {
		t.Errorf("no key: %+v", res.svc)
	}
}
