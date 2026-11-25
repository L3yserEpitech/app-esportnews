package backoffice

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// The four hosted services the product depends on, each read through its
// official API. A missing credential gives « Non connecté », never a number.

const (
	healthExternalTimeout = 8 * time.Second
	healthMaxBody         = 8 << 20

	resendWindow   = 7 * 24 * time.Hour
	resendPageSize = 100
	// Five pages of 100 cover a week of transactional mail many times over;
	// beyond that the card says « plus de 500 » instead of paging on.
	resendMaxPages = 5
)

// healthHTTPError is a refusal of the remote API; status 0 when it came inside
// a 200 (GraphQL).
type healthHTTPError struct {
	status int
	detail string
}

func (e *healthHTTPError) Error() string {
	if e.status == 0 {
		return e.detail
	}
	if e.detail != "" {
		return fmt.Sprintf("HTTP %d (%s)", e.status, e.detail)
	}
	return fmt.Sprintf("HTTP %d", e.status)
}

// healthCallError words a failed call for the card, without the URL or anything secret.
func healthCallError(err error) string {
	var httpErr *healthHTTPError
	var netErr net.Error
	switch {
	case errors.As(err, &httpErr):
		return httpErr.Error()
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return "délai dépassé"
	case errors.Is(err, errUnreadableAnswer):
		return "réponse illisible"
	default:
		return "service injoignable"
	}
}

var errUnreadableAnswer = errors.New("unreadable answer")

// healthDoJSON sends req and decodes a 2xx JSON answer into out.
func (m *Module) healthDoJSON(req *http.Request, out interface{}) error {
	req.Header.Set("Accept", "application/json")
	res, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, healthMaxBody))
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		var named struct {
			Name string `json:"name"`
		}
		_ = json.Unmarshal(body, &named)
		return &healthHTTPError{status: res.StatusCode, detail: clip(named.Name, 40)}
	}
	if err := json.Unmarshal(body, out); err != nil {
		return errUnreadableAnswer
	}
	return nil
}

// ---- Vercel ----

type vercelDeployment struct {
	State        string                 `json:"state"`
	ReadyState   string                 `json:"readyState"`
	Created      float64                `json:"created"` // milliseconds
	Ready        float64                `json:"ready"`
	InspectorURL string                 `json:"inspectorUrl"`
	Meta         map[string]interface{} `json:"meta"`
}

var vercelStates = map[string]string{
	"READY":        "Prêt",
	"BUILDING":     "En construction",
	"INITIALIZING": "Initialisation",
	"QUEUED":       "En file d'attente",
	"ERROR":        "En erreur",
	"CANCELED":     "Annulé",
	"BLOCKED":      "Bloqué",
	"DELETED":      "Supprimé",
}

// healthVercel reads the latest production deployment (GET /v7/deployments).
func (m *Module) healthVercel(ctx context.Context) healthResult {
	const key, name = "vercel", "Vercel"
	if missing := missingEnv("VERCEL_API_TOKEN", m.cfg.VercelToken, "VERCEL_PROJECT_ID", m.cfg.VercelProjectID); len(missing) > 0 {
		return healthResult{svc: healthUnconfigured(key, name, missing...)}
	}
	svc := &HealthService{Key: key, Name: name, Status: HealthOK, Link: &HealthLink{Label: "Ouvrir Vercel", URL: "https://vercel.com/dashboard"}}

	q := url.Values{"projectId": {m.cfg.VercelProjectID}, "target": {"production"}, "limit": {"1"}}
	if m.cfg.VercelTeamID != "" {
		q.Set("teamId", m.cfg.VercelTeamID)
	}
	ctx, cancel := context.WithTimeout(ctx, healthExternalTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.health().endpoints.vercel+"/v7/deployments?"+q.Encode(), nil)
	if err != nil {
		return healthResult{svc: healthFailed(key, name, "Appel à l'API Vercel impossible")}
	}
	req.Header.Set("Authorization", "Bearer "+m.cfg.VercelToken)
	var out struct {
		Deployments []vercelDeployment `json:"deployments"`
	}
	if err := m.healthDoJSON(req, &out); err != nil {
		m.log.WithError(err).Warn("[BO] health: Vercel call failed")
		svc.Status = HealthDown
		svc.Note = "Appel à l'API Vercel impossible : " + healthCallError(err)
		return healthResult{svc: svc}
	}
	if len(out.Deployments) == 0 {
		svc.Status = HealthWarn
		svc.Note = "Aucun déploiement de production trouvé pour ce projet"
		return healthResult{svc: svc}
	}

	d := out.Deployments[0]
	state := d.ReadyState
	if state == "" {
		state = d.State
	}
	label, known := vercelStates[state]
	if !known {
		label = state
	}
	at := d.Ready
	if at == 0 {
		at = d.Created
	}
	value := label
	if at > 0 {
		value += " · " + frAgo(time.UnixMilli(int64(at)), time.Now())
	}
	svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Dernier déploiement", Value: value})
	for _, k := range []string{"githubCommitSha", "gitlabCommitSha", "bitbucketCommitSha"} {
		if sha, _ := d.Meta[k].(string); len(sha) >= 8 {
			svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Commit", Value: sha[:8], Mono: true})
			break
		}
	}
	if strings.HasPrefix(d.InspectorURL, "https://vercel.com/") {
		svc.Link.URL = d.InspectorURL
	}
	switch state {
	case "READY", "BUILDING", "INITIALIZING", "QUEUED":
	case "ERROR":
		// The previous deployment keeps serving the site: not an outage.
		svc.Status = HealthWarn
		svc.Note = "Le dernier déploiement de production a échoué"
	default:
		svc.Status = HealthWarn
		svc.Note = "Dernier déploiement de production : " + lowerFirst(label)
	}
	return healthResult{svc: svc}
}

// ---- Railway ----

// One request for the three things the card shows. CPU_LIMIT is asked so the
// CPU reads as a share of what the service may use.
const railwayHealthQuery = `query health($serviceId: String!, $environmentId: String!, $startDate: DateTime!) {
  service(id: $serviceId) { name }
  serviceInstance(serviceId: $serviceId, environmentId: $environmentId) { latestDeployment { status } }
  metrics(serviceId: $serviceId, environmentId: $environmentId, startDate: $startDate, sampleRateSeconds: 60, measurements: [CPU_USAGE, CPU_LIMIT, MEMORY_USAGE_GB]) {
    measurement
    values { ts value }
  }
}`

type railwayHealth struct {
	Service *struct {
		Name string `json:"name"`
	} `json:"service"`
	ServiceInstance *struct {
		LatestDeployment *struct {
			Status string `json:"status"`
		} `json:"latestDeployment"`
	} `json:"serviceInstance"`
	Metrics []struct {
		Measurement string `json:"measurement"`
		Values      []struct {
			Ts    int64   `json:"ts"`
			Value float64 `json:"value"`
		} `json:"values"`
	} `json:"metrics"`
}

type railwayAnswer struct {
	Data   *railwayHealth `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (a *railwayAnswer) unauthorized() bool {
	for _, e := range a.Errors {
		msg := strings.ToLower(e.Message)
		if strings.Contains(msg, "not authorized") || strings.Contains(msg, "unauthorized") || strings.Contains(msg, "unauthenticated") {
			return true
		}
	}
	return false
}

func (m *Module) railwayCall(ctx context.Context, projectToken bool) (*railwayAnswer, error) {
	payload, err := json.Marshal(map[string]interface{}{
		"query": railwayHealthQuery,
		"variables": map[string]string{
			"serviceId":     m.cfg.RailwayServiceID,
			"environmentId": m.cfg.RailwayEnvironmentID,
			"startDate":     time.Now().Add(-10 * time.Minute).UTC().Format(time.RFC3339),
		},
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.health().endpoints.railway, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if projectToken {
		req.Header.Set("Project-Access-Token", m.cfg.RailwayToken)
	} else {
		req.Header.Set("Authorization", "Bearer "+m.cfg.RailwayToken)
	}
	var out railwayAnswer
	if err := m.healthDoJSON(req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// railwayFetch tries the header that worked last time, then the other one.
func (m *Module) railwayFetch(ctx context.Context) (*railwayHealth, error) {
	h := m.health()
	h.mu.Lock()
	projectToken := h.railwayProjectToken
	h.mu.Unlock()

	var answer *railwayAnswer
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		answer, err = m.railwayCall(ctx, projectToken)
		var httpErr *healthHTTPError
		refused := err == nil && answer.unauthorized() ||
			errors.As(err, &httpErr) && (httpErr.status == http.StatusUnauthorized || httpErr.status == http.StatusForbidden)
		if !refused {
			break
		}
		if attempt == 0 {
			projectToken = !projectToken
		}
	}
	if err != nil {
		return nil, err
	}
	if answer.Data == nil || answer.unauthorized() {
		detail := "réponse sans données"
		if len(answer.Errors) > 0 {
			detail = clip(answer.Errors[0].Message, 80)
		}
		return nil, &healthHTTPError{detail: detail}
	}
	h.mu.Lock()
	h.railwayProjectToken = projectToken
	h.mu.Unlock()
	return answer.Data, nil
}

func (m *Module) healthRailway(ctx context.Context) healthResult {
	const key, name = "railway", "Railway"
	// Counted by this backend: the row is there whether or not Railway's API is connected.
	var errorsRow []HealthMetric
	if n, err := m.serverErrors24h(ctx); err == nil {
		errorsRow = []HealthMetric{{Label: "Réponses 5xx · 24 h", Value: frInt(n)}}
	} else if !errors.Is(err, errNoServerErrorCounter) {
		m.log.WithError(err).Warn("[BO] health: could not read the 5xx counter")
	}

	missing := missingEnv("RAILWAY_API_TOKEN", m.cfg.RailwayToken, "RAILWAY_SERVICE_ID", m.cfg.RailwayServiceID, "RAILWAY_ENVIRONMENT_ID", m.cfg.RailwayEnvironmentID)
	if len(missing) > 0 {
		svc := healthUnconfigured(key, name, missing...)
		svc.Metrics = append(svc.Metrics, errorsRow...)
		return healthResult{svc: svc}
	}
	link := "https://railway.com/dashboard"
	if m.cfg.RailwayProjectID != "" {
		link = "https://railway.com/project/" + url.PathEscape(m.cfg.RailwayProjectID)
	}
	svc := &HealthService{Key: key, Name: name, Status: HealthOK, Link: &HealthLink{Label: "Ouvrir Railway", URL: link}}

	callCtx, cancel := context.WithTimeout(ctx, healthExternalTimeout)
	defer cancel()
	data, err := m.railwayFetch(callCtx)
	if err != nil {
		m.log.WithError(err).Warn("[BO] health: Railway call failed")
		svc.Status = HealthDown
		svc.Note = "Appel à l'API Railway impossible : " + healthCallError(err)
		svc.Metrics = errorsRow
		return healthResult{svc: svc}
	}

	if data.Service != nil && data.Service.Name != "" {
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Service", Value: data.Service.Name, Mono: true})
	}
	last := map[string]float64{}
	for _, series := range data.Metrics {
		if n := len(series.Values); n > 0 {
			last[series.Measurement] = series.Values[n-1].Value
		}
	}
	memory, hasMemory := last["MEMORY_USAGE_GB"]
	cpu, hasCPU := last["CPU_USAGE"]
	limit := last["CPU_LIMIT"]
	switch {
	case hasCPU && limit > 0 && hasMemory:
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "CPU · mémoire", Value: frPercent(cpu/limit) + " · " + frBytes(memory*(1<<30))})
	case hasMemory:
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Mémoire", Value: frBytes(memory * (1 << 30))})
	}
	svc.Metrics = append(svc.Metrics, errorsRow...)

	if data.ServiceInstance != nil && data.ServiceInstance.LatestDeployment != nil {
		switch data.ServiceInstance.LatestDeployment.Status {
		case "CRASHED":
			svc.Status = HealthWarn
			svc.Note = "Le dernier déploiement a planté"
		case "FAILED":
			svc.Status = HealthWarn
			svc.Note = "Le dernier déploiement a échoué"
		case "SLEEPING":
			svc.Status = HealthWarn
			svc.Note = "Le service est en veille"
		case "BUILDING", "DEPLOYING", "INITIALIZING", "QUEUED", "WAITING":
			svc.Note = "Déploiement en cours"
		}
	}
	return healthResult{svc: svc}
}

// ---- Upstash ----

func (m *Module) upstashMissing() []string {
	return missingEnv("UPSTASH_EMAIL", m.cfg.UpstashEmail, "UPSTASH_API_KEY", m.cfg.UpstashAPIKey, "UPSTASH_DATABASE_ID", m.cfg.UpstashDatabaseID)
}

// upstashStats reads GET /v2/redis/stats/{id}: what the database did today
// and what the month costs so far.
func (m *Module) upstashStats(ctx context.Context) ([]HealthMetric, error) {
	ctx, cancel := context.WithTimeout(ctx, healthExternalTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.health().endpoints.upstash+"/v2/redis/stats/"+url.PathEscape(m.cfg.UpstashDatabaseID), nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(m.cfg.UpstashEmail, m.cfg.UpstashAPIKey)
	var stats struct {
		DailyNetCommands    *int64   `json:"daily_net_commands"`
		DailyBandwidth      *float64 `json:"dailybandwidth"`
		TotalMonthlyBilling *float64 `json:"total_monthly_billing"`
	}
	if err := m.healthDoJSON(req, &stats); err != nil {
		return nil, err
	}
	var rows []HealthMetric
	if stats.DailyNetCommands != nil {
		rows = append(rows, HealthMetric{Label: "Commandes · aujourd'hui", Value: frCompact(*stats.DailyNetCommands)})
	}
	if stats.DailyBandwidth != nil {
		rows = append(rows, HealthMetric{Label: "Bande passante · aujourd'hui", Value: frBytes(*stats.DailyBandwidth)})
	}
	if stats.TotalMonthlyBilling != nil {
		rows = append(rows, HealthMetric{Label: "Coût du mois", Value: frDecimal(*stats.TotalMonthlyBilling, 2) + " $"})
	}
	return rows, nil
}

// ---- Resend ----

type resendEmail struct {
	ID        string `json:"id"`
	CreatedAt string `json:"created_at"`
	LastEvent string `json:"last_event"`
}

// Resend dates its e-mails « 2026-04-03 22:13:42.674981+00 ».
func parseResendTime(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02 15:04:05.999999999Z07", "2006-01-02 15:04:05.999999999Z07:00", time.RFC3339Nano} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errUnreadableAnswer
}

type resendWeek struct {
	sent, bounced, failed int
	truncated             bool
}

// resendWeekStats pages through GET /emails, newest first, until it leaves the window.
func (m *Module) resendWeekStats(ctx context.Context, since time.Time) (resendWeek, error) {
	var week resendWeek
	after := ""
	for page := 0; ; page++ {
		if page == resendMaxPages {
			week.truncated = true
			return week, nil
		}
		q := url.Values{"limit": {fmt.Sprint(resendPageSize)}}
		if after != "" {
			q.Set("after", after)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.health().endpoints.resend+"/emails?"+q.Encode(), nil)
		if err != nil {
			return week, err
		}
		req.Header.Set("Authorization", "Bearer "+m.cfg.ResendAPIKey)
		var out struct {
			HasMore bool          `json:"has_more"`
			Data    []resendEmail `json:"data"`
		}
		if err := m.healthDoJSON(req, &out); err != nil {
			return week, err
		}
		for _, e := range out.Data {
			at, err := parseResendTime(e.CreatedAt)
			if err != nil {
				return week, err
			}
			if at.Before(since) {
				return week, nil
			}
			switch e.LastEvent {
			case "scheduled", "canceled":
				continue
			case "bounced":
				week.bounced++
			case "failed":
				week.failed++
			}
			week.sent++
		}
		if !out.HasMore || len(out.Data) == 0 {
			return week, nil
		}
		after = out.Data[len(out.Data)-1].ID
	}
}

func (m *Module) healthResend(ctx context.Context) healthResult {
	const key, name = "resend", "Resend"
	if m.cfg.ResendAPIKey == "" {
		return healthResult{svc: healthUnconfigured(key, name, "RESEND_API_KEY")}
	}
	svc := &HealthService{Key: key, Name: name, Status: HealthOK, Link: &HealthLink{Label: "Ouvrir Resend", URL: "https://resend.com/emails"}}
	ctx, cancel := context.WithTimeout(ctx, healthExternalTimeout)
	defer cancel()
	week, err := m.resendWeekStats(ctx, time.Now().Add(-resendWindow))
	var httpErr *healthHTTPError
	if errors.As(err, &httpErr) && httpErr.detail == "restricted_api_key" {
		// The key sends mail but may not list it: nothing is broken, the
		// numbers just aren't readable with it.
		svc = healthUnconfigured(key, name, "RESEND_API_KEY")
		svc.Note = "La clé actuelle ne permet que l'envoi : les statistiques demandent une clé « Full access »"
		return healthResult{svc: svc}
	}
	if err != nil {
		m.log.WithError(err).Warn("[BO] health: Resend call failed")
		svc.Status = HealthDown
		svc.Note = "Appel à l'API Resend impossible : " + healthCallError(err)
		return healthResult{svc: svc}
	}
	sent := frInt(int64(week.sent))
	if week.truncated {
		sent = "plus de " + sent
	}
	svc.Metrics = []HealthMetric{
		{Label: "E-mails envoyés · 7 j", Value: sent},
		{Label: "Rebonds", Value: frInt(int64(week.bounced))},
		{Label: "Échecs", Value: frInt(int64(week.failed))},
	}
	if week.failed > 0 {
		svc.Status = HealthWarn
		svc.Note = "1 envoi en échec sur 7 jours"
		if week.failed > 1 {
			svc.Note = fmt.Sprintf("%d envois en échec sur 7 jours", week.failed)
		}
	}
	return healthResult{svc: svc}
}
