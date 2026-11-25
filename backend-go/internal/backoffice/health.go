package backoffice

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

const (
	healthSnapshotTTL = time.Minute
	// « Actualiser » rebuilds, but two clicks in a row share one build: every
	// rebuild calls four third-party APIs.
	healthMinRebuild   = 10 * time.Second
	healthBuildTimeout = 20 * time.Second
	healthSourceWait   = 12 * time.Second
	// The sidebar counter never waits for a build: it shows the last picture
	// and asks for a new one, in the background, once this old.
	healthNavStaleAfter = 5 * time.Minute

	healthFlushEvery     = time.Minute
	healthErrorRetention = 30 * 24 * time.Hour

	settingLast429 = "health.liquipedia_last_429"
)

// PollerHealth is what the health screen reads from the Liquipedia poller.
type PollerHealth interface {
	ListRefreshTimes() map[string]map[string]time.Time
	StartedAt() time.Time
	WebhooksEnabled() bool
}

// WebhookHealth is what it reads from the Liquipedia webhook endpoint.
type WebhookHealth interface {
	LastReceived() map[string]time.Time
}

// HealthSources are the parts of the server the health screen observes but the
// back-office does not own. Any of them may be left out.
type HealthSources struct {
	Poller        PollerHealth
	PollerEnabled bool // LIQUIPEDIA_POLLER_ENABLED
	Webhooks      WebhookHealth
	ServerErrors  func() int64 // 5xx responses sent since the process started
}

type healthEndpoints struct {
	vercel, railway, upstash, resend string
}

type healthSource struct {
	key, name string
	fn        func(context.Context) healthResult
}

// healthResult is what one source contributes. Alerts left empty on a card in
// warn or down get a generic line built from its note.
type healthResult struct {
	svc    *HealthService
	alerts []HealthAlert
	wikis  []HealthWiki
}

type healthState struct {
	mu       sync.Mutex
	snapshot *HealthSnapshot
	sources  HealthSources
	extra    []healthSource
	last429  time.Time
	// Railway takes an account token in one header and a project token in
	// another, and nothing in a token tells them apart: remember what worked.
	railwayProjectToken bool

	// flushMu is held across the write of the 5xx counter, never mu: a slow
	// database must not hold up the readers of the snapshot.
	flushMu sync.Mutex
	flushed int64 // 5xx responses already written to bo_http_error

	group     singleflight.Group
	endpoints healthEndpoints
	// Tests replace the built-in cards and shorten the wait.
	builtin    []healthSource
	sourceWait time.Duration
}

func (h *healthState) serverErrorCount() (int64, bool) {
	h.mu.Lock()
	count := h.sources.ServerErrors
	h.mu.Unlock()
	if count == nil {
		return 0, false
	}
	return count(), true
}

// Module is declared in core.go, shared by every domain: the state of this one
// hangs off it here.
var healthStates sync.Map

func (m *Module) health() *healthState {
	if h, ok := healthStates.Load(m); ok {
		return h.(*healthState)
	}
	h, _ := healthStates.LoadOrStore(m, &healthState{
		endpoints: healthEndpoints{
			vercel:  "https://api.vercel.com",
			railway: "https://backboard.railway.com/graphql/v2",
			upstash: "https://api.upstash.com",
			resend:  "https://api.resend.com",
		},
		builtin: []healthSource{
			{"vercel", "Vercel", m.healthVercel},
			{"railway", "Railway", m.healthRailway},
			{"redis", "Redis", m.healthRedis},
			{"postgres", "PostgreSQL", m.healthPostgres},
			{"proxy", "Proxy OVH", m.healthProxy},
			{"liquipedia", "Liquipedia", m.healthLiquipedia},
			{"resend", "Resend", m.healthResend},
		},
		sourceWait: healthSourceWait,
	})
	return h.(*healthState)
}

// SetHealthSources is called once at boot, before Start.
func (m *Module) SetHealthSources(s HealthSources) {
	h := m.health()
	h.mu.Lock()
	h.sources = s
	h.mu.Unlock()
}

// addHealthSource appends a card to the health screen, after the built-in
// ones. fn runs at each rebuild, off the request; nil means « no card ».
func (m *Module) addHealthSource(key string, fn func(ctx context.Context) *HealthService) {
	h := m.health()
	h.mu.Lock()
	defer h.mu.Unlock()
	h.extra = append(h.extra, healthSource{key: key, name: key, fn: func(ctx context.Context) healthResult {
		return healthResult{svc: fn(ctx)}
	}})
}

func (m *Module) registerHealthRoutes(g *echo.Group) {
	g.GET("/health", m.handleHealth, m.require(PermHealthRead))
}

func (m *Module) handleHealth(c echo.Context) error {
	snap, err := m.healthSnapshot(c.Request().Context(), c.QueryParam("fresh") == "1")
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, snap)
}

func (h *healthState) cached(maxAge time.Duration) *HealthSnapshot {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.snapshot == nil || time.Since(h.snapshot.RefreshedAt) > maxAge {
		return nil
	}
	return h.snapshot
}

// healthSnapshot is the picture the health screen and the dashboard share,
// built at most once a minute. fresh asks for a new one. Every caller gets the
// same value: read it, never modify it.
func (m *Module) healthSnapshot(ctx context.Context, fresh bool) (*HealthSnapshot, error) {
	h := m.health()
	maxAge := healthSnapshotTTL
	if fresh {
		maxAge = healthMinRebuild
	}
	if snap := h.cached(maxAge); snap != nil {
		return snap, nil
	}
	built := h.group.DoChan("build", func() (interface{}, error) {
		// A caller that queued just as the previous build ended takes its result.
		if snap := h.cached(healthMinRebuild); snap != nil {
			return snap, nil
		}
		// Detached: the member who triggered the build may leave, the others wait for it.
		ctx, cancel := context.WithTimeout(context.Background(), healthBuildTimeout)
		defer cancel()
		snap := m.buildHealthSnapshot(ctx)
		h.mu.Lock()
		h.snapshot = snap
		h.mu.Unlock()
		return snap, nil
	})
	select {
	case res := <-built:
		return res.Val.(*HealthSnapshot), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (m *Module) buildHealthSnapshot(ctx context.Context) *HealthSnapshot {
	h := m.health()
	h.mu.Lock()
	sources := append(append([]healthSource{}, h.builtin...), h.extra...)
	wait := h.sourceWait
	h.mu.Unlock()

	results := make([]healthResult, len(sources))
	var wg sync.WaitGroup
	for i, src := range sources {
		wg.Add(1)
		go func(i int, src healthSource) {
			defer wg.Done()
			results[i] = m.runHealthSource(ctx, src, wait)
		}(i, src)
	}
	wg.Wait()

	snap := &HealthSnapshot{RefreshedAt: time.Now(), Services: []HealthService{}, Wikis: []HealthWiki{}, Alerts: []HealthAlert{}}
	for _, res := range results {
		if res.svc == nil {
			continue
		}
		svc := *res.svc
		if svc.Metrics == nil {
			svc.Metrics = []HealthMetric{}
		}
		snap.Services = append(snap.Services, svc)
		snap.Wikis = append(snap.Wikis, res.wikis...)
		switch svc.Status {
		case HealthOK:
			snap.Counts.OK++
		case HealthWarn:
			snap.Counts.Warn++
		case HealthDown:
			snap.Counts.Down++
		}
		alerts := res.alerts
		if len(alerts) == 0 && (svc.Status == HealthWarn || svc.Status == HealthDown) {
			alerts = []HealthAlert{genericHealthAlert(svc)}
		}
		snap.Alerts = append(snap.Alerts, alerts...)
	}
	return snap
}

// runHealthSource keeps one source from taking the others down with it: a
// panic or a source that never answers becomes its own card « En panne ».
func (m *Module) runHealthSource(ctx context.Context, src healthSource, wait time.Duration) healthResult {
	ctx, cancel := context.WithTimeout(ctx, wait)
	defer cancel()
	done := make(chan healthResult, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				m.log.WithField("source", src.key).Errorf("[BO] health source panicked: %v", r)
				done <- healthResult{svc: healthFailed(src.key, src.name, "Le contrôle a échoué (erreur interne)")}
			}
		}()
		done <- src.fn(ctx)
	}()
	select {
	case res := <-done:
		return res
	case <-ctx.Done():
		return healthResult{svc: healthFailed(src.key, src.name, fmt.Sprintf("Pas de réponse en %d s", int(wait.Seconds())))}
	}
}

func healthFailed(key, name, note string) *HealthService {
	return &HealthService{Key: key, Name: name, Status: HealthDown, Note: note, Metrics: []HealthMetric{}}
}

func healthUnconfigured(key, name string, missing ...string) *HealthService {
	return &HealthService{Key: key, Name: name, Status: HealthUnconfigured, Missing: missing, Metrics: []HealthMetric{}}
}

func genericHealthAlert(svc HealthService) HealthAlert {
	state := "à surveiller"
	if svc.Status == HealthDown {
		state = "en panne"
	}
	detail := lowerFirst(svc.Note)
	if detail == "" {
		detail = "voir la santé du système"
	}
	return HealthAlert{Level: "important", Title: svc.Name + " · " + state, Detail: detail, Href: "/sante"}
}

// navHealthAlerts is the amber counter next to « Santé du système ».
func (m *Module) navHealthAlerts(c echo.Context) *int {
	s := sessionOf(c)
	if s == nil || !s.User.Role.Can(PermHealthRead) {
		return nil
	}
	h := m.health()
	h.mu.Lock()
	snap := h.snapshot
	h.mu.Unlock()
	if snap == nil || time.Since(snap.RefreshedAt) > healthNavStaleAfter {
		go func() {
			_, _ = m.healthSnapshot(context.Background(), false)
		}()
	}
	if snap == nil {
		return nil
	}
	n := snap.Counts.Warn + snap.Counts.Down
	return &n
}

// ---- background: 5xx counter and last refusal of Liquipedia ----

func (m *Module) startHealthJobs(ctx context.Context) {
	h := m.health()
	if at := m.settingTime(ctx, settingLast429); at != nil {
		h.mu.Lock()
		h.last429 = *at
		h.mu.Unlock()
	}
	go func() {
		tick := time.NewTicker(healthFlushEvery)
		defer tick.Stop()
		purge := time.NewTicker(24 * time.Hour)
		defer purge.Stop()
		m.purgeServerErrors(ctx)
		for {
			select {
			case <-ctx.Done():
				// The last minute of the process, written on the way out.
				last, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				m.flushHealth(last)
				cancel()
				return
			case <-tick.C:
				m.flushHealth(ctx)
			case <-purge.C:
				m.purgeServerErrors(ctx)
			}
		}
	}()
}

func (m *Module) flushHealth(ctx context.Context) {
	if err := m.flushServerErrors(ctx); err != nil {
		m.log.WithError(err).Warn("[BO] could not write the 5xx counter")
	}
	m.persistLast429(ctx)
}

// flushServerErrors adds what the logging middleware counted since the last
// flush to the bucket of the current hour: one write a minute at most.
func (m *Module) flushServerErrors(ctx context.Context) error {
	h := m.health()
	h.flushMu.Lock()
	defer h.flushMu.Unlock()
	total, ok := h.serverErrorCount()
	delta := total - h.flushed
	if !ok || delta <= 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	err := m.db.WithContext(ctx).Exec(
		`INSERT INTO bo_http_error (hour, count) VALUES (date_trunc('hour', now()), ?)
		 ON CONFLICT (hour) DO UPDATE SET count = bo_http_error.count + EXCLUDED.count`, delta).Error
	if err != nil {
		return err
	}
	h.flushed = total
	return nil
}

func (m *Module) purgeServerErrors(ctx context.Context) {
	err := m.db.WithContext(ctx).Exec("DELETE FROM bo_http_error WHERE hour < ?", time.Now().Add(-healthErrorRetention)).Error
	if err != nil {
		m.log.WithError(err).Warn("[BO] could not purge the 5xx counter")
	}
}

var errNoServerErrorCounter = errors.New("5xx counter not wired")

// serverErrors24h is the flushed buckets of the last 24 hours plus what the
// current minute has not written yet.
func (m *Module) serverErrors24h(ctx context.Context) (int64, error) {
	h := m.health()
	h.flushMu.Lock()
	defer h.flushMu.Unlock()
	total, ok := h.serverErrorCount()
	if !ok {
		return 0, errNoServerErrorCounter
	}
	var stored int64
	err := m.db.WithContext(ctx).
		Raw("SELECT COALESCE(SUM(count), 0) FROM bo_http_error WHERE hour > ?", time.Now().Add(-24*time.Hour)).
		Scan(&stored).Error
	if err != nil {
		return 0, err
	}
	if total > h.flushed {
		stored += total - h.flushed
	}
	return stored, nil
}

// lastLiquipedia429 survives a restart: the service only knows the refusals of
// this process, the setting keeps the last one of the previous ones.
func (m *Module) lastLiquipedia429() time.Time {
	h := m.health()
	h.mu.Lock()
	at := h.last429
	h.mu.Unlock()
	if m.liquipedia != nil {
		if live := m.liquipedia.LastRateLimitedAt(); live.After(at) {
			at = live
		}
	}
	return at
}

func (m *Module) persistLast429(ctx context.Context) {
	if m.liquipedia == nil {
		return
	}
	live := m.liquipedia.LastRateLimitedAt()
	h := m.health()
	h.mu.Lock()
	known := h.last429
	h.mu.Unlock()
	if !live.After(known) {
		return
	}
	if err := m.setSetting(ctx, settingLast429, live.UTC().Format(time.RFC3339)); err != nil {
		m.log.WithError(err).Warn("[BO] could not record the last 429 from Liquipedia")
		return
	}
	h.mu.Lock()
	h.last429 = live
	h.mu.Unlock()
}
