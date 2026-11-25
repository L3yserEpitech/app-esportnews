package backoffice

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"gorm.io/driver/postgres"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

// What the backend can measure by itself: its database, its Redis, the route
// to the proxy and the state of the Liquipedia poller. None of this calls
// Liquipedia.

const healthProbeTimeout = 3 * time.Second

// ---- wording ----

// frInt groups thousands the French way (« 1 000 »), with a narrow no-break space.
func frInt(n int64) string {
	s := strconv.FormatInt(n, 10)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}
	if neg {
		return "-" + b.String()
	}
	return b.String()
}

func frDecimal(v float64, digits int) string {
	return strings.Replace(strconv.FormatFloat(v, 'f', digits, 64), ".", ",", 1)
}

// frBytes: « 412 Mo », « 4,2 Go ».
func frBytes(n float64) string {
	const kb, mb, gb = 1024.0, 1024.0 * 1024, 1024.0 * 1024 * 1024
	switch {
	case n >= gb:
		return frDecimal(n/gb, 1) + " Go"
	case n >= mb:
		return frInt(int64(n/mb+0.5)) + " Mo"
	case n >= kb:
		return frInt(int64(n/kb+0.5)) + " Ko"
	default:
		return frInt(int64(n)) + " o"
	}
}

// frCompact: « 1,9 M » from a million up, the grouped number below.
func frCompact(n int64) string {
	if n >= 1_000_000 {
		return frDecimal(float64(n)/1_000_000, 1) + " M"
	}
	return frInt(n)
}

func frPercent(ratio float64) string {
	p := ratio * 100
	if p > 0 && p < 10 {
		return frDecimal(p, 1) + " %"
	}
	return frInt(int64(p+0.5)) + " %"
}

// frAgo: « il y a 40 s », « il y a 12 min », « il y a 3 h », « il y a 9 j ».
func frAgo(t, now time.Time) string {
	d := now.Sub(t)
	switch {
	case d < time.Second:
		return "à l'instant"
	case d < time.Minute:
		return fmt.Sprintf("il y a %d s", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("il y a %d min", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("il y a %d h", int(d.Hours()))
	default:
		return fmt.Sprintf("il y a %d j", int(d.Hours()/24))
	}
}

func frMillis(d time.Duration) string {
	ms := d.Milliseconds()
	if ms < 1 {
		ms = 1
	}
	return frInt(ms) + " ms"
}

func lowerFirst(s string) string {
	r, size := utf8.DecodeRuneInString(s)
	if size == 0 {
		return s
	}
	return string(unicode.ToLower(r)) + s[size:]
}

func momentMetric(label string, at, now time.Time) HealthMetric {
	return HealthMetric{Label: label, Value: frAgo(at, now), At: &at}
}

// ---- PostgreSQL ----

// postgresHost reads the host and user of the DSN GORM was opened with.
func (m *Module) postgresHost() (host, user string) {
	if m.db == nil {
		return "", ""
	}
	dialector, ok := m.db.Dialector.(*postgres.Dialector)
	if !ok || dialector.Config == nil {
		return "", ""
	}
	if u, err := url.Parse(dialector.Config.DSN); err == nil && u.Host != "" {
		return u.Hostname(), u.User.Username()
	}
	for _, field := range strings.Fields(dialector.Config.DSN) {
		if v, ok := strings.CutPrefix(field, "host="); ok {
			host = v
		}
		if v, ok := strings.CutPrefix(field, "user="); ok {
			user = v
		}
	}
	return host, user
}

// supabaseProject finds the project reference in a direct host
// (db.<ref>.supabase.co) or in the user of a pooler DSN (postgres.<ref>).
func supabaseProject(host, user string) (ref string, isSupabase bool) {
	host = strings.ToLower(host)
	if !strings.HasSuffix(host, ".supabase.co") && !strings.HasSuffix(host, ".supabase.com") {
		return "", false
	}
	if rest, ok := strings.CutPrefix(host, "db."); ok && strings.HasSuffix(host, ".supabase.co") {
		return strings.TrimSuffix(rest, ".supabase.co"), true
	}
	if _, project, ok := strings.Cut(user, "."); ok {
		return project, true
	}
	return "", true
}

func (m *Module) healthPostgres(ctx context.Context) healthResult {
	host, user := m.postgresHost()
	svc := &HealthService{Key: "postgres", Name: "PostgreSQL", Status: HealthOK}
	if ref, ok := supabaseProject(host, user); ok {
		svc.Name = "Supabase"
		link := "https://supabase.com/dashboard"
		if ref != "" {
			link += "/project/" + ref
		}
		svc.Link = &HealthLink{Label: "Ouvrir Supabase", URL: link}
	}

	ctx, cancel := context.WithTimeout(ctx, healthProbeTimeout)
	defer cancel()
	var row struct {
		Size int64
		Used int64
		Max  int64
	}
	err := m.db.WithContext(ctx).Raw(
		`SELECT pg_database_size(current_database()) AS size,
		        (SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'client backend') AS used,
		        current_setting('max_connections')::bigint AS max`).Scan(&row).Error
	if err != nil {
		m.log.WithError(err).Warn("[BO] health: database probe failed")
		svc.Status = HealthDown
		svc.Note = "La base ne répond pas à la sonde du backend"
		return healthResult{svc: svc}
	}
	svc.Metrics = []HealthMetric{
		{Label: "Taille de la base", Value: frBytes(float64(row.Size))},
		{Label: "Connexions", Value: fmt.Sprintf("%s sur %s", frInt(row.Used), frInt(row.Max))},
	}
	if row.Max > 0 && row.Used*5 >= row.Max*4 {
		svc.Status = HealthWarn
		svc.Note = fmt.Sprintf("%s des connexions sont prises", frPercent(float64(row.Used)/float64(row.Max)))
	}
	return healthResult{svc: svc}
}

// ---- Redis ----

func redisInfoField(info, field string) (string, bool) {
	for _, line := range strings.Split(info, "\n") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(line), field+":"); ok {
			return v, true
		}
	}
	return "", false
}

func (m *Module) healthRedis(ctx context.Context) healthResult {
	rdb := m.cache.GetClient()
	host, _, _ := net.SplitHostPort(rdb.Options().Addr)
	upstash := strings.HasSuffix(strings.ToLower(host), ".upstash.io")
	svc := &HealthService{Key: "redis", Name: "Redis", Status: HealthOK}
	if upstash {
		svc.Name = "Upstash"
		link := "https://console.upstash.com"
		if m.cfg.UpstashDatabaseID != "" {
			link += "/redis/" + m.cfg.UpstashDatabaseID
		}
		svc.Link = &HealthLink{Label: "Ouvrir Upstash", URL: link}
	}

	probe, cancel := context.WithTimeout(ctx, healthProbeTimeout)
	defer cancel()
	start := time.Now()
	if err := rdb.Ping(probe).Err(); err != nil {
		m.log.WithError(err).Warn("[BO] health: Redis probe failed")
		svc.Status = HealthDown
		svc.Note = "Redis ne répond pas à la sonde du backend"
		return healthResult{svc: svc}
	}
	latency := time.Since(start)
	local := []HealthMetric{{Label: "Temps de réponse", Value: frMillis(latency)}}
	if latency >= time.Second {
		svc.Status = HealthWarn
		svc.Note = "Redis répond lentement"
	}
	// Some hosted Redis refuse INFO or trim it: the rows are then left out.
	if info, err := rdb.Info(probe).Result(); err == nil {
		if v, ok := redisInfoField(info, "used_memory"); ok {
			if n, err := strconv.ParseFloat(v, 64); err == nil {
				local = append(local, HealthMetric{Label: "Mémoire utilisée", Value: frBytes(n)})
			}
		}
		if v, ok := redisInfoField(info, "connected_clients"); ok {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil {
				local = append(local, HealthMetric{Label: "Clients connectés", Value: frInt(n)})
			}
		}
	}

	if upstash {
		if missing := m.upstashMissing(); len(missing) > 0 {
			svc.Note = "Commandes, bande passante et coût : définir " + strings.Join(missing, ", ")
		} else if stats, err := m.upstashStats(ctx); err != nil {
			m.log.WithError(err).Warn("[BO] health: Upstash stats failed")
			svc.Status = HealthWarn
			svc.Note = "Statistiques Upstash indisponibles : " + healthCallError(err)
		} else {
			svc.Metrics = append(svc.Metrics, stats...)
		}
	}
	svc.Metrics = append(svc.Metrics, local...)
	return healthResult{svc: svc}
}

// ---- outbound proxy ----

// proxyAddress is the host:port of LIQUIPEDIA_HTTP_PROXY, without its credentials.
func proxyAddress(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" {
		return "", fmt.Errorf("unreadable proxy URL")
	}
	port := u.Port()
	if port == "" {
		port = "80"
		if u.Scheme == "https" {
			port = "443"
		}
	}
	return net.JoinHostPort(u.Hostname(), port), nil
}

// healthProxy only opens a TCP connection to the proxy: a request through it
// would be a call to Liquipedia.
func (m *Module) healthProxy(ctx context.Context) healthResult {
	const key, name = "proxy", "Proxy OVH"
	if m.cfg.LiquipediaProxyURL == "" {
		return healthResult{svc: healthUnconfigured(key, name, "LIQUIPEDIA_HTTP_PROXY")}
	}
	svc := &HealthService{Key: key, Name: name, Status: HealthOK, Note: "Tous les appels vers Liquipedia passent par lui"}
	addr, err := proxyAddress(m.cfg.LiquipediaProxyURL)
	if err != nil {
		svc.Status = HealthDown
		svc.Note = "LIQUIPEDIA_HTTP_PROXY n'est pas une URL lisible"
		return healthResult{svc: svc}
	}
	now := time.Now()
	dialer := net.Dialer{Timeout: healthProbeTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		svc.Status = HealthDown
		svc.Note = "Le proxy ne répond pas : les appels vers Liquipedia échouent"
		svc.Metrics = []HealthMetric{{Label: "Sonde du backend", Value: "Injoignable"}}
	} else {
		latency := time.Since(now)
		_ = conn.Close()
		svc.Metrics = []HealthMetric{
			{Label: "Sonde du backend", Value: "Joignable"},
			{Label: "Temps de réponse", Value: frMillis(latency)},
		}
	}
	if refused := m.lastLiquipedia429(); !refused.IsZero() {
		svc.Metrics = append(svc.Metrics, momentMetric("Dernier refus de Liquipedia", refused, now))
		if svc.Status == HealthOK && now.Sub(refused) < time.Hour {
			svc.Status = HealthWarn
			svc.Note = "Liquipedia a refusé un appel dans la dernière heure (429)"
		}
	} else {
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Dernier refus de Liquipedia", Value: "Aucun enregistré"})
	}
	return healthResult{svc: svc}
}

// ---- Liquipedia ----

// healthGames are the supported games, in the order of the site's selector.
var healthGames = []struct{ wiki, name string }{
	{"counterstrike", "Counter-Strike 2"},
	{"valorant", "Valorant"},
	{"leagueoflegends", "League of Legends"},
	{"dota2", "Dota 2"},
	{"rocketleague", "Rocket League"},
	{"callofduty", "Call of Duty"},
	{"rainbowsix", "Rainbow Six Siege"},
	{"overwatch", "Overwatch"},
	{"easportsfc", "EA Sports FC"},
	{"mobilelegends", "Mobile Legends"},
}

// healthWikiOrder lists every wiki of GameWikiMapping: the named ones first,
// then any game added since, under its wiki name.
func healthWikiOrder() []struct{ wiki, name string } {
	out := make([]struct{ wiki, name string }, 0, len(models.WikiToAcronym))
	seen := map[string]bool{}
	for _, g := range healthGames {
		if _, ok := models.WikiToAcronym[g.wiki]; ok {
			out = append(out, g)
			seen[g.wiki] = true
		}
	}
	var rest []string
	for wiki := range models.WikiToAcronym {
		if !seen[wiki] {
			rest = append(rest, wiki)
		}
	}
	sort.Strings(rest)
	for _, wiki := range rest {
		out = append(out, struct{ wiki, name string }{wiki, wiki})
	}
	return out
}

// listLateAfter is how old a poller list may get before it is called late.
//
// A refresh only calls Liquipedia once the key has expired (MakeRequest serves
// a live key), so a list is legitimately absent for a while in every cycle:
//   - blind polling: the first tick that finds the key gone, floor(TTL/interval)+1 ticks;
//   - webhooks: at worst the safety net, which fires on the 4th tick (on the 3rd,
//     the previous refresh ended a moment less than 3 intervals ago).
//
// One more interval is allowed on top: late means a refresh that was due did
// not happen, not that the TTL has run out.
func listLateAfter(interval, ttl time.Duration, webhooks bool) time.Duration {
	cycle := (ttl/interval + 1) * interval
	if webhooks {
		cycle = 4 * interval
	}
	return cycle + interval
}

type budgetUse struct{ used, limit int }

type liquipediaPicture struct {
	now         time.Time
	configured  bool      // an API key is set
	pollerOn    bool      // enabled and started
	startedAt   time.Time // since when the tickers run
	webhooks    bool
	budgets     map[string]budgetUse
	refreshed   map[string]map[string]time.Time
	lastWebhook map[string]time.Time
}

func (m *Module) liquipediaPicture() liquipediaPicture {
	h := m.health()
	h.mu.Lock()
	src := h.sources
	h.mu.Unlock()

	p := liquipediaPicture{now: time.Now(), budgets: map[string]budgetUse{}}
	if m.liquipedia != nil {
		p.configured = m.liquipedia.Configured()
		if byWiki, ok := m.liquipedia.GetBudgetStatus()["budgets"].(map[string]interface{}); ok {
			for wiki, raw := range byWiki {
				status, _ := raw.(map[string]interface{})
				used, _ := status["used"].(int)
				limit, _ := status["limit"].(int)
				p.budgets[wiki] = budgetUse{used, limit}
			}
		}
	}
	if src.Poller != nil {
		p.startedAt = src.Poller.StartedAt()
		p.pollerOn = src.PollerEnabled && !p.startedAt.IsZero()
		p.webhooks = src.Poller.WebhooksEnabled()
		p.refreshed = src.Poller.ListRefreshTimes()
	}
	if src.Webhooks != nil {
		p.lastWebhook = src.Webhooks.LastReceived()
	}
	return p
}

func (m *Module) healthLiquipedia(_ context.Context) healthResult {
	return judgeLiquipedia(m.liquipediaPicture())
}

// judgeLiquipedia turns what the poller did into the card, the rows of the
// table and the alerts.
func judgeLiquipedia(p liquipediaPicture) healthResult {
	const key, name = "liquipedia", "Liquipedia"
	res := healthResult{svc: &HealthService{Key: key, Name: name, Status: HealthOK}}
	svc := res.svc

	runningLate := listLateAfter(services.PollIntervalMatchesRunning, services.TTLMatchesRunning, p.webhooks)
	upcomingLate := listLateAfter(services.PollIntervalMatchesUpcoming, services.TTLMatchesUpcoming, p.webhooks)
	// A list not fetched since the restart is given the same delay, counted
	// from the start of the poller.
	late := func(at *time.Time, limit time.Duration) bool {
		if !p.pollerOn {
			return false
		}
		since := p.startedAt
		if at != nil {
			since = *at
		}
		return p.now.Sub(since) > limit
	}
	timeOf := func(wiki, list string) *time.Time {
		if at, ok := p.refreshed[wiki][list]; ok {
			return &at
		}
		return nil
	}

	var busiest *HealthWiki
	var newestWebhook time.Time
	var budgetAlerts, lateAlerts []HealthAlert
	var lateGames []string
	upToDate, runningOnTime := 0, 0
	games := healthWikiOrder()
	for _, g := range games {
		row := HealthWiki{
			Game:                g.name,
			Wiki:                g.wiki,
			BudgetUsed:          p.budgets[g.wiki].used,
			BudgetLimit:         p.budgets[g.wiki].limit,
			RunningRefreshedAt:  timeOf(g.wiki, services.ListMatchesRunning),
			UpcomingRefreshedAt: timeOf(g.wiki, services.ListMatchesUpcoming),
		}
		row.RunningExpired = late(row.RunningRefreshedAt, runningLate)
		row.UpcomingExpired = late(row.UpcomingRefreshedAt, upcomingLate)
		if at, ok := p.lastWebhook[g.wiki]; ok {
			row.LastWebhookAt = &at
			if at.After(newestWebhook) {
				newestWebhook = at
			}
		}
		if !row.RunningExpired {
			runningOnTime++
			if !row.UpcomingExpired {
				upToDate++
			}
		}
		res.wikis = append(res.wikis, row)
		if busiest == nil || row.BudgetUsed > busiest.BudgetUsed {
			busiest = &res.wikis[len(res.wikis)-1]
		}

		if services.BudgetWarnReached(row.BudgetUsed, row.BudgetLimit) {
			svc.Status = HealthWarn
			budgetAlerts = append(budgetAlerts, HealthAlert{
				Level:  "important",
				Title:  fmt.Sprintf("Liquipedia · %s à %s du budget", row.Game, frPercent(float64(row.BudgetUsed)/float64(row.BudgetLimit))),
				Detail: fmt.Sprintf("%s appels sur %s cette heure", frInt(int64(row.BudgetUsed)), frInt(int64(row.BudgetLimit))),
				Href:   "/sante",
			})
		}
		for _, l := range []struct {
			expired bool
			at      *time.Time
			label   string
		}{
			{row.RunningExpired, row.RunningRefreshedAt, "matchs en direct"},
			{row.UpcomingExpired, row.UpcomingRefreshedAt, "matchs à venir"},
		} {
			if !l.expired {
				continue
			}
			svc.Status = HealthWarn
			detail := "aucun rafraîchissement depuis le redémarrage du backend"
			if l.at != nil {
				detail = "dernier rafraîchissement " + frAgo(*l.at, p.now)
			}
			lateAlerts = append(lateAlerts, HealthAlert{
				Level:  "important",
				Title:  fmt.Sprintf("Liquipedia · %s, liste des %s en retard", row.Game, l.label),
				Detail: detail,
				Href:   "/sante",
			})
		}
		if row.RunningExpired || row.UpcomingExpired {
			lateGames = append(lateGames, row.Game)
		}
	}
	// Past a few lines the dashboard gets one sentence, not a line per list.
	if len(lateAlerts) > 3 {
		lateAlerts = []HealthAlert{{
			Level:  "important",
			Title:  fmt.Sprintf("Liquipedia · %d wikis ont une liste en retard", len(lateGames)),
			Detail: strings.Join(lateGames, ", "),
			Href:   "/sante",
		}}
	}
	res.alerts = append(budgetAlerts, lateAlerts...)

	if busiest != nil && busiest.BudgetUsed > 0 {
		svc.Metrics = append(svc.Metrics, HealthMetric{
			Label: "Wiki le plus chargé",
			Value: fmt.Sprintf("%s · %s / %s", busiest.Game, frInt(int64(busiest.BudgetUsed)), frInt(int64(busiest.BudgetLimit))),
		})
	} else {
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Wiki le plus chargé", Value: "Aucun appel cette heure"})
	}
	switch {
	case !newestWebhook.IsZero():
		svc.Metrics = append(svc.Metrics, momentMetric("Dernier webhook reçu", newestWebhook, p.now))
	case p.webhooks:
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Dernier webhook reçu", Value: "Aucun depuis le redémarrage"})
	default:
		svc.Metrics = append(svc.Metrics, HealthMetric{Label: "Dernier webhook reçu", Value: "Webhooks désactivés"})
	}
	svc.Link = &HealthLink{Label: "Détail par wiki", URL: "#wikis"}

	switch {
	case !p.configured:
		// Without a key nothing is ever fetched: the card says what to set, the
		// table keeps its rows so the screen shows the ten wikis and their budget.
		res.svc = healthUnconfigured(key, name, "LIQUIPEDIA_API_KEY")
		res.svc.Note = "Sans clé, le poller ne démarre pas : aucune liste n'est rafraîchie"
		res.alerts = nil
	case !p.pollerOn:
		svc.Note = "Poller arrêté sur cette instance (LIQUIPEDIA_POLLER_ENABLED=false) : les listes ne sont pas rafraîchies ici"
	default:
		svc.Metrics = append(svc.Metrics, HealthMetric{
			Label: "Listes du poller à jour",
			Value: fmt.Sprintf("%d sur %d", upToDate, len(games)),
		})
		if runningOnTime == 0 && len(games) > 0 {
			svc.Status = HealthDown
			svc.Note = "Aucune liste de matchs en direct n'a été rafraîchie depuis plus de " + frMinutes(runningLate)
			res.alerts = append([]HealthAlert{{
				Level:  "important",
				Title:  "Liquipedia · le poller ne rafraîchit plus rien",
				Detail: lowerFirst(svc.Note),
				Href:   "/sante",
			}}, budgetAlerts...)
		}
	}
	return res
}

func frMinutes(d time.Duration) string {
	return fmt.Sprintf("%d min", int(d.Minutes()))
}
