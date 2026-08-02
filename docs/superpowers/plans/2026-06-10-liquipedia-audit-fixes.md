# Liquipedia Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 4 problèmes critiques + 4 améliorations P1 identifiés par l'audit du pipeline Liquipedia (calls API + cache Redis), dont la cause racine de l'épuisement du quota API.

**Architecture:** Tous les changements vivent dans `backend-go/internal/services/` (service HTTP central + poller) et `backend-go/internal/handlers/webhooks.go`. Aucun changement de schéma DB ni de contrat API frontend. Les comportements par défaut prod sont préservés ; les nouveaux garde-fous (cooldowns dirty-flags, cap de taille, ctx détaché) réduisent la consommation API sans changer les données servies.

**Tech Stack:** Go 1.25, Echo v4, go-redis v9, testify (déjà en go.mod), miniredis (à ajouter, dep de test), httptest (stdlib).

**Conventions repo (CLAUDE.md §19):** commentaires WHY only en anglais, gofmt avant commit, `go build ./...` obligatoire, commits `type(scope): description`. Pas de `--no-verify`.

**Contexte clé pour qui n'a pas lu l'audit :**
- Le rate-limit Liquipedia réel est triple : quota 1000 req/wiki/h + burst limit court + limite par IP. Un seul 429 déclenche un backoff 5/10/20min (`RequestBudget.Record429`).
- Les payloads `matches_past` font ~9.3MB (valorant) — à 93% du cap actuel de 10MB qui **tronque silencieusement**.
- Chaque webhook namespace 0 marque 5 types dirty → le consumer (tick 2 min) peut refetch jusqu'à 150 req/h/wiki actif. C'est ce qui a brûlé le quota.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `backend-go/internal/services/liquipedia_service.go` | Client HTTP central (MakeRequest, budget, stale, singleflight) | Modify |
| `backend-go/internal/services/liquipedia_service_test.go` | Tests MakeRequest (cache, cap taille, singleflight ctx) | **Create** |
| `backend-go/internal/services/liquipedia_poller.go` | Poller + DirtyTracker + refresh funcs | Modify |
| `backend-go/internal/services/liquipedia_poller_test.go` | Tests dirtyRefreshGate | **Create** |
| `backend-go/internal/handlers/webhooks.go` | Réception webhooks LiquipediaDB | Modify (filtre Main_Page) |
| `backend-go/internal/handlers/matches.go` | Handler by-date (query fields) | Modify |
| `backend-go/internal/handlers/tournaments.go` | Handler by-date (query fields) | Modify |
| `backend-go/internal/services/liquipedia_reader.go` | TournamentMatches (query fields) | Modify |
| `backend-go/go.mod` / `go.sum` | Ajout miniredis | Modify |
| `CLAUDE.md` | Doc env vars + comportements | Modify |

Toutes les commandes se lancent depuis `backend-go/` sauf mention contraire.

---

### Task 1: Test harness — baseURL injectable + miniredis

Le service hardcode `liquipediaBaseURL` (const, ligne ~26) : impossible de pointer un `httptest.Server`. On le rend injectable via un champ, défaut inchangé.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (struct ~185, constructeur ~266, MakeRequest ~361)
- Create: `backend-go/internal/services/liquipedia_service_test.go`
- Modify: `backend-go/go.mod`

- [ ] **Step 1: Ajouter la dépendance miniredis**

```bash
go get github.com/alicebob/miniredis/v2
```

- [ ] **Step 2: Rendre baseURL injectable**

Dans `liquipedia_service.go`, ajouter le champ à la struct `LiquipediaService` (après `httpClient *http.Client`) :

```go
	baseURL    string // overridable in tests; defaults to liquipediaBaseURL
```

Dans `NewLiquipediaService`, dans le literal `svc := &LiquipediaService{...}`, ajouter :

```go
		baseURL:     liquipediaBaseURL,
```

Dans `MakeRequest`, remplacer la ligne :

```go
		reqURL := fmt.Sprintf("%s/%s?%s", liquipediaBaseURL, endpoint, encoded)
```

par :

```go
		reqURL := fmt.Sprintf("%s/%s?%s", s.baseURL, endpoint, encoded)
```

- [ ] **Step 3: Écrire le harness + premier test (cache fresh + stale + dedup)**

Créer `liquipedia_service_test.go` :

```go
package services

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
)

// newTestService wires a LiquipediaService against an httptest server and a
// miniredis instance. The IPv4 dial override only triggers for
// api.liquipedia.net, so the 127.0.0.1 test server is unaffected.
func newTestService(t *testing.T, handler http.Handler) (*LiquipediaService, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := NewLiquipediaService("test-key", 1000, rc, logger)
	svc.baseURL = srv.URL
	return svc, mr
}

func TestMakeRequestCachesFreshAndStale(t *testing.T) {
	var calls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	ctx := context.Background()

	_, err := svc.MakeRequest(ctx, "valorant", "match", nil, "liq:test:key", time.Minute)
	require.NoError(t, err)
	// Second call must be served from cache: no extra HTTP call.
	_, err = svc.MakeRequest(ctx, "valorant", "match", nil, "liq:test:key", time.Minute)
	require.NoError(t, err)

	require.Equal(t, int32(1), calls.Load())
	require.True(t, mr.Exists("liq:test:key"))
	require.True(t, mr.Exists(cache.StaleKey("liq:test:key")))
}
```

- [ ] **Step 4: Lancer le test**

```bash
go test ./internal/services/ -run TestMakeRequestCachesFreshAndStale -v
```

Expected: PASS (et `go build ./...` OK).

- [ ] **Step 5: Commit**

```bash
gofmt -w internal/services/
git add internal/services/liquipedia_service.go internal/services/liquipedia_service_test.go go.mod go.sum
git commit -m "test(backend): add Liquipedia service test harness with injectable baseURL"
```

---

### Task 2: Cap de taille — ne jamais cacher un body tronqué (P0)

`io.LimitReader(resp.Body, 10MB)` tronque silencieusement → JSON corrompu écrit en fresh **et** stale (6h). Valorant `matches_past` = 9.3MB, déjà à 93% du cap.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (~ligne 441-446, bloc "Read body")
- Test: `backend-go/internal/services/liquipedia_service_test.go`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `liquipedia_service_test.go` :

```go
func TestMakeRequestRefusesOversizedBody(t *testing.T) {
	old := maxLiqResponseSize
	maxLiqResponseSize = 64
	t.Cleanup(func() { maxLiqResponseSize = old })

	big := make([]byte, 200)
	for i := range big {
		big[i] = 'x'
	}
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(big)
	}))

	_, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:big", time.Minute)
	require.Error(t, err) // no stale available → error
	// Critical: the truncated body must NOT be cached, neither fresh nor stale.
	require.False(t, mr.Exists("liq:test:big"))
	require.False(t, mr.Exists(cache.StaleKey("liq:test:big")))
}

func TestMakeRequestOversizedFallsBackToStale(t *testing.T) {
	old := maxLiqResponseSize
	maxLiqResponseSize = 64
	t.Cleanup(func() { maxLiqResponseSize = old })

	big := make([]byte, 200)
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(big)
	}))
	require.NoError(t, mr.Set(cache.StaleKey("liq:test:big2"), `{"result":["stale"]}`))

	data, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:big2", time.Minute)
	require.NoError(t, err)
	require.Equal(t, `{"result":["stale"]}`, string(data))
}
```

- [ ] **Step 2: Vérifier qu'ils échouent**

```bash
go test ./internal/services/ -run TestMakeRequestRefuses -v
go test ./internal/services/ -run TestMakeRequestOversized -v
```

Expected: FAIL — `maxLiqResponseSize` n'existe pas encore (erreur de compilation).

- [ ] **Step 3: Implémenter**

Dans `liquipedia_service.go`, ajouter au niveau package (près des consts du haut, après le bloc `const` ligne ~40) :

```go
// maxLiqResponseSize caps response bodies. A body at the cap was silently
// truncated by the old io.LimitReader approach and then cached as corrupt
// JSON for up to TTLStale (6h) — matches_past payloads already reach ~9.3MB,
// so the cap is 20MB with an explicit refuse-to-cache on overflow.
// var (not const) so tests can lower it.
var maxLiqResponseSize int64 = 20 * 1024 * 1024
```

Remplacer le bloc "Read body" actuel :

```go
		// Read body (limit to 10MB to prevent memory exhaustion)
		const maxResponseSize = 10 * 1024 * 1024
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxResponseSize))
		if readErr != nil {
			return nil, fmt.Errorf("reading response body: %w", readErr)
		}
```

par :

```go
		// Read one byte past the cap so truncation is detectable instead of silent.
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxLiqResponseSize+1))
		if readErr != nil {
			return nil, fmt.Errorf("reading response body: %w", readErr)
		}
		if int64(len(body)) > maxLiqResponseSize {
			s.log.WithFields(logrus.Fields{
				"wiki":     wiki,
				"endpoint": endpoint,
				"cap":      maxLiqResponseSize,
			}).Error("[MAKEREQ] Response exceeds size cap — refusing to cache truncated body")
			return s.getStaleOrError(ctx, cacheKey, wiki)
		}
```

- [ ] **Step 4: Vérifier que tout passe**

```bash
go test ./internal/services/ -v && go build ./...
```

Expected: PASS sur les 3 tests.

- [ ] **Step 5: Commit**

```bash
gofmt -w internal/services/
git add internal/services/
git commit -m "fix(backend): refuse to cache truncated Liquipedia responses

io.LimitReader silently truncated bodies at 10MB and the corrupt JSON was
then cached fresh + stale (6h). matches_past payloads already reach 9.3MB.
Raise the cap to 20MB and fall back to stale on overflow instead of caching."
```

---

### Task 3: Timeout HTTP 15s → 30s (P0)

Mesuré : `matches_past` valorant prend 17.3s en cold → timeout systématique à 15s, requête brûlée + fallback stale.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (~ligne 230)

- [ ] **Step 1: Changer le timeout**

Remplacer :

```go
	httpClient := &http.Client{
		Timeout: 15 * time.Second,
	}
```

par :

```go
	// 30s: cold matches_past payloads (~9MB) measured at 17s — 15s burned the
	// request right before completion and fell back to stale every time.
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}
```

- [ ] **Step 2: Build + tests**

```bash
go build ./... && go test ./internal/services/ -count=1
```

Expected: OK / PASS.

- [ ] **Step 3: Commit**

```bash
git add internal/services/liquipedia_service.go
git commit -m "fix(backend): raise Liquipedia HTTP timeout to 30s

Cold matches_past responses (~9MB) measured at 17s; the 15s timeout burned
the request systematically and served stale instead."
```

---

### Task 4: Singleflight — contexte détaché du premier caller (P0)

`sfGroup.Do` exécute le fetch avec le ctx du **premier** caller. S'il annule (fermeture d'onglet), tous les callers en attente reçoivent `context canceled` (observé en logs sur rocketleague).

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (closure singleflight, ~lignes 317-467)
- Test: `backend-go/internal/services/liquipedia_service_test.go`

- [ ] **Step 1: Écrire le test qui échoue**

```go
func TestSingleflightSurvivesFirstCallerCancel(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	ctx1, cancel := context.WithCancel(context.Background())
	done1 := make(chan struct{})
	go func() {
		defer close(done1)
		_, _ = svc.MakeRequest(ctx1, "valorant", "match", nil, "liq:test:sf", time.Minute)
	}()
	time.Sleep(30 * time.Millisecond) // let caller 1 own the flight

	done2 := make(chan error, 1)
	go func() {
		_, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:sf", time.Minute)
		done2 <- err
	}()
	time.Sleep(30 * time.Millisecond) // let caller 2 join the flight
	cancel()                          // first caller bails out mid-flight

	<-done1
	require.NoError(t, <-done2) // caller 2 must still get the data
}
```

- [ ] **Step 2: Vérifier qu'il échoue**

```bash
go test ./internal/services/ -run TestSingleflightSurvives -v
```

Expected: FAIL avec `context canceled` sur le second caller.

- [ ] **Step 3: Implémenter le ctx détaché**

Dans `MakeRequest`, en **première ligne de la closure** `s.sfGroup.Do(cacheKey, func() (interface{}, error) {` :

```go
		// Detach from the first caller's context: N callers share this single
		// fetch, so the first caller cancelling (browser disconnect) must not
		// fail the others. Bounded by its own timeout (> httpClient.Timeout).
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 35*time.Second)
		defer cancel()
```

Le shadowing de `ctx` suffit : tout le corps de la closure (cache re-check, `http.NewRequestWithContext`, gate de spacing `<-ctx.Done()`, `getStaleOrError`) utilise déjà `ctx` et bascule automatiquement sur la version détachée. Ne rien changer d'autre dans la closure.

- [ ] **Step 4: Vérifier que tout passe**

```bash
go test ./internal/services/ -count=1 -v && go build ./...
```

Expected: PASS (les 4 tests).

- [ ] **Step 5: Commit**

```bash
gofmt -w internal/services/
git add internal/services/
git commit -m "fix(backend): detach singleflight fetch from first caller's context

The shared fetch ran on the first caller's ctx: when that caller cancelled
(browser disconnect), every waiter got 'context canceled'. Run the fetch on
a detached ctx with its own 35s bound instead."
```

---

### Task 5: Dirty flags — cooldown par type + filtre Main_Page + consommation du flag Teams (P0, cause racine quota)

Chaque webhook ns 0 marque 5 types dirty ; le consumer (2 min) peut refetch jusqu'à 150 req/h/wiki actif. Trois fixes : (a) gate de cooldown par wiki+type, (b) ignorer les purges automatiques de `Main_Page`, (c) consommer le flag `Teams` (aujourd'hui mort) en invalidant le cache de recherche d'équipes.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_poller.go` (struct ~120, constructeur ~135, consumeDirtyFlags ~376)
- Modify: `backend-go/internal/handlers/webhooks.go` (~ligne 74, après le check namespace)
- Create: `backend-go/internal/services/liquipedia_poller_test.go`

- [ ] **Step 1: Écrire le test du gate (échoue : type inexistant)**

Créer `liquipedia_poller_test.go` :

```go
package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDirtyRefreshGate(t *testing.T) {
	g := newDirtyRefreshGate()
	now := time.Now()

	require.True(t, g.Allow("valorant", "matches_running", 4*time.Minute, now))
	// Within cooldown → blocked.
	require.False(t, g.Allow("valorant", "matches_running", 4*time.Minute, now.Add(2*time.Minute)))
	// Other type and other wiki are independent.
	require.True(t, g.Allow("valorant", "matches_past", 20*time.Minute, now))
	require.True(t, g.Allow("dota2", "matches_running", 4*time.Minute, now))
	// After cooldown → allowed again.
	require.True(t, g.Allow("valorant", "matches_running", 4*time.Minute, now.Add(5*time.Minute)))
}
```

- [ ] **Step 2: Vérifier qu'il échoue**

```bash
go test ./internal/services/ -run TestDirtyRefreshGate -v
```

Expected: FAIL (compilation : `newDirtyRefreshGate` non défini).

- [ ] **Step 3: Implémenter le gate**

Dans `liquipedia_poller.go`, après la struct `DirtyTracker` (~ligne 100) :

```go
// dirtyRefreshGate rate-limits webhook-driven refreshes per wiki+type. Active
// wikis emit edit/purge webhooks continuously; without a floor the consumer
// refetched 5 types every 2min (~150 req/h/wiki) — the main quota burner.
type dirtyRefreshGate struct {
	mu   sync.Mutex
	last map[string]time.Time
}

func newDirtyRefreshGate() *dirtyRefreshGate {
	return &dirtyRefreshGate{last: make(map[string]time.Time)}
}

// Allow reports whether (wiki, typ) may refresh now, recording the time when
// it does. cooldown is the minimum spacing between webhook-driven refreshes.
func (g *dirtyRefreshGate) Allow(wiki, typ string, cooldown time.Duration, now time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := wiki + ":" + typ
	if last, ok := g.last[key]; ok && now.Sub(last) < cooldown {
		return false
	}
	g.last[key] = now
	return true
}
```

Ajouter les cooldowns au bloc `const` du haut (~ligne 19), après `DirtyCheckInterval` :

```go
	// Webhook-driven refresh floors: half the blind-polling interval. Bounds
	// the worst case at ~2× polling cost instead of 10× on busy wikis.
	DirtyCooldownMatchesRunning  = PollIntervalMatchesRunning / 2      // 4 min
	DirtyCooldownMatchesUpcoming = PollIntervalMatchesUpcoming / 2     // 10 min
	DirtyCooldownMatchesPast     = PollIntervalMatchesPast / 2         // 22.5 min
	DirtyCooldownTournaments     = PollIntervalTournamentsRunning / 2  // 10 min
```

Ajouter le champ à `LiquipediaPoller` (struct ~ligne 120) :

```go
	dirtyGate *dirtyRefreshGate
```

et l'initialiser dans `NewLiquipediaPoller` :

```go
		dirtyGate:       newDirtyRefreshGate(),
```

- [ ] **Step 4: Brancher le gate + le flag Teams dans consumeDirtyFlags**

Remplacer le corps de la boucle `for wiki, flags := range dirtyWikis { ... }` (en gardant le log existant en tête de boucle) par :

```go
				now := time.Now()
				if flags.MatchesRunning && p.dirtyGate.Allow(wiki, "matches_running", DirtyCooldownMatchesRunning, now) {
					go p.refreshMatchesRunning(ctx, wiki)
				}
				if flags.MatchesUpcoming && p.dirtyGate.Allow(wiki, "matches_upcoming", DirtyCooldownMatchesUpcoming, now) {
					go p.refreshMatchesUpcoming(ctx, wiki)
				}
				if flags.MatchesPast && p.dirtyGate.Allow(wiki, "matches_past", DirtyCooldownMatchesPast, now) {
					go p.refreshMatchesPast(ctx, wiki)
				}
				if flags.Tournaments && p.dirtyGate.Allow(wiki, "tournaments", DirtyCooldownTournaments, now) {
					go p.refreshTournamentsRunning(ctx, wiki)
					go p.refreshTournamentsUpcoming(ctx, wiki)
				}
				if flags.Teams {
					// Team edits (namespace -10) don't need an API refetch — just
					// drop the cached searches so the next lookup is fresh.
					go func(w string) {
						delCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
						defer cancel()
						_ = p.service.GetCache().DelPattern(delCtx, fmt.Sprintf("liq:teams:search:%s:*", w))
					}(wiki)
				}
```

- [ ] **Step 5: Filtrer Main_Page dans le webhook handler**

Dans `backend-go/internal/handlers/webhooks.go`, juste **après** le bloc "Ignore events outside main content and teamtemplates namespaces" (~ligne 81) :

```go
	// Wikis purge Main_Page on automated schedules; those events carry no
	// match/tournament data and were dirtying every cache for nothing.
	if event.Page == "Main_Page" {
		return c.NoContent(http.StatusOK)
	}
```

- [ ] **Step 6: Tests + build**

```bash
go test ./internal/services/ -count=1 && go build ./...
```

Expected: PASS / OK.

- [ ] **Step 7: Commit**

```bash
gofmt -w internal/services/ internal/handlers/
git add internal/services/liquipedia_poller.go internal/services/liquipedia_poller_test.go internal/handlers/webhooks.go
git commit -m "fix(backend): rate-limit webhook-driven refreshes per wiki+type

Every namespace-0 webhook marked 5 cache types dirty and the consumer
refetched them all every 2min — up to 150 req/h on an active wiki, the
main cause of quota exhaustion. Add per-type cooldowns (half the polling
interval), drop automated Main_Page purges at the door, and consume the
previously-dead Teams flag by invalidating cached team searches."
```

---

### Task 6: Créditer le warmup dans lastRefresh (P1)

Après le warmup, `lastRefresh` est vide → le premier tick de chaque ticker re-fetch immédiatement ("never refreshed yet") même en mode webhooks. 6 requêtes/wiki gaspillées.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_poller.go` (`pollGame`, ~ligne 285)

- [ ] **Step 1: Initialiser lastRefresh après warmup**

Remplacer :

```go
	lastRefresh := make(map[string]time.Time)
```

par :

```go
	// Credit the warmup that just ran so the first ticker fire in webhook mode
	// doesn't immediately re-fetch what was fetched seconds ago.
	warmupDone := time.Now()
	lastRefresh := map[string]time.Time{
		"matches_running":      warmupDone,
		"matches_upcoming":     warmupDone,
		"matches_past":         warmupDone,
		"tournaments_running":  warmupDone,
		"tournaments_upcoming": warmupDone,
		"tournaments_finished": warmupDone,
	}
```

- [ ] **Step 2: Build + tests + commit**

```bash
go build ./... && go test ./internal/services/ -count=1
gofmt -w internal/services/
git add internal/services/liquipedia_poller.go
git commit -m "fix(backend): credit warmup fetches so first ticker fire doesn't refetch"
```

---

### Task 7: Sélection de champs `query=` sur les grosses requêtes (P1)

Le poller récupère le payload complet (~9MB pour matches_past) alors que les parsers ne lisent que les champs des structs `LiqMatch`/`LiqTournament`. Liquipedia supporte `query=` (déjà utilisé par `SearchTeams`). Réduction attendue : 3-10× sur la taille (réseau, Redis, et marge vs le cap 20MB).

**Files:**
- Modify: `backend-go/internal/services/liquipedia_poller.go` (6 fonctions refresh, lignes ~430-561)
- Modify: `backend-go/internal/handlers/matches.go` (`GetMatchesByDate`, params vers ~ligne 210-219)
- Modify: `backend-go/internal/handlers/tournaments.go` (`ListTournamentsByDate`, même motif)
- Modify: `backend-go/internal/services/liquipedia_reader.go` (`TournamentMatches`, ~ligne 81-84)

- [ ] **Step 1: Valider les listes de champs contre l'API réelle**

Les listes ci-dessous sont les json tags exacts des structs `models.LiqMatch` et `models.LiqTournament` (tout champ non listé est déjà jeté au parsing — aucune perte de données). Valider que l'API les accepte :

```bash
source ../.env 2>/dev/null
curl -s -o /dev/null -w "match: %{http_code} / %{size_download} bytes\n" \
  "https://api.liquipedia.net/api/v3/match?wiki=valorant&limit=5&query=pageid,pagename,namespace,objectname,match2id,match2bracketid,status,winner,walkover,resulttype,finished,mode,type,section,game,patch,bestof,date,dateexact,vod,tournament,parent,tickername,shortname,series,icon,iconurl,icondark,icondarkurl,liquipediatier,liquipediatiertype,publishertier,match2opponents,match2games,stream,links,extradata,match2bracketdata" \
  -H "Authorization: Apikey $LIQUIPEDIA_API_KEY" -H "User-Agent: EsportNews/1.0 (contact@esportnews.fr)"
curl -s -o /dev/null -w "tournament: %{http_code} / %{size_download} bytes\n" \
  "https://api.liquipedia.net/api/v3/tournament?wiki=valorant&limit=5&query=pageid,pagename,namespace,objectname,name,shortname,tickername,banner,bannerurl,bannerdark,bannerdarkurl,icon,iconurl,icondark,icondarkurl,seriespage,serieslist,previous,previous2,next,next2,game,mode,patch,endpatch,type,organizers,startdate,enddate,sortdate,locations,prizepool,participantsnumber,liquipediatier,liquipediatiertype,publishertier,status,maps,format,sponsors,extradata" \
  -H "Authorization: Apikey $LIQUIPEDIA_API_KEY" -H "User-Agent: EsportNews/1.0 (contact@esportnews.fr)"
```

Expected: `200` sur les deux. **Si un champ est rejeté (400)**, retirer le champ fautif de la liste ET noter qu'il restera absent du parsing (vérifier qu'aucun normalizer ne le lit).

- [ ] **Step 2: Ajouter les consts dans liquipedia_poller.go**

Au niveau package, après le bloc const existant :

```go
// liqMatchQueryFields / liqTournamentQueryFields restrict responses to the
// json tags of models.LiqMatch / models.LiqTournament — everything else was
// discarded at parse time anyway. Cuts matches_past payloads from ~9MB to a
// fraction (network, Redis memory, and headroom under maxLiqResponseSize).
const (
	liqMatchQueryFields      = "pageid,pagename,namespace,objectname,match2id,match2bracketid,status,winner,walkover,resulttype,finished,mode,type,section,game,patch,bestof,date,dateexact,vod,tournament,parent,tickername,shortname,series,icon,iconurl,icondark,icondarkurl,liquipediatier,liquipediatiertype,publishertier,match2opponents,match2games,stream,links,extradata,match2bracketdata"
	liqTournamentQueryFields = "pageid,pagename,namespace,objectname,name,shortname,tickername,banner,bannerurl,bannerdark,bannerdarkurl,icon,iconurl,icondark,icondarkurl,seriespage,serieslist,previous,previous2,next,next2,game,mode,patch,endpatch,type,organizers,startdate,enddate,sortdate,locations,prizepool,participantsnumber,liquipediatier,liquipediatiertype,publishertier,status,maps,format,sponsors,extradata"
)
```

- [ ] **Step 3: Appliquer aux 6 fonctions refresh du poller**

Dans chacune de `refreshMatchesRunning`, `refreshMatchesUpcoming`, `refreshMatchesPast` ajouter après `params.Set("limit", "5000")` :

```go
	params.Set("query", liqMatchQueryFields)
```

Dans `refreshTournamentsRunning`, `refreshTournamentsUpcoming`, `refreshTournamentsFinished` :

```go
	params.Set("query", liqTournamentQueryFields)
```

- [ ] **Step 4: Appliquer aux fetchs by-date et tournament-matches**

Localiser les sites (un par fichier) :

```bash
grep -n 'params.Set("limit", "5000")' internal/handlers/matches.go internal/handlers/tournaments.go internal/services/liquipedia_reader.go
```

- `internal/handlers/matches.go` (GetMatchesByDate) : ajouter `params.Set("query", services.LiqMatchQueryFields)` — **attention** : les consts sont dans le package `services`, les handlers sont dans `handlers`. Exporter les deux consts : renommer `liqMatchQueryFields` → `LiqMatchQueryFields` et `liqTournamentQueryFields` → `LiqTournamentQueryFields` partout (poller + reader + handlers).
- `internal/handlers/tournaments.go` (ListTournamentsByDate) : `params.Set("query", services.LiqTournamentQueryFields)`
- `internal/services/liquipedia_reader.go` (TournamentMatches, ~ligne 84) : `params.Set("query", LiqMatchQueryFields)`

- [ ] **Step 5: Build + tests + vérification fonctionnelle locale**

```bash
go build ./... && go test ./... -count=1
```

Puis si l'env local tourne (`make dev`), vider une clé et vérifier qu'une page se recharge avec données :

```bash
docker compose -f ../docker-compose.dev.yml exec redis redis-cli DEL liq:matches:running:valorant
curl -s "http://localhost:4000/api/matches/running?game=valorant" | head -c 200
```

Expected: JSON de matchs (ou `[]` si rien en live — pas une erreur 5xx).

- [ ] **Step 6: Commit**

```bash
gofmt -w internal/
git add internal/services/ internal/handlers/
git commit -m "perf(backend): request only parsed fields from Liquipedia

Add query= field selection (the exact json tags of LiqMatch/LiqTournament)
to the poller refreshes, by-date fetches and tournament-matches lookup.
Everything else was discarded at parse time; payloads shrink several-fold,
cutting network time, Redis memory and headroom under the size cap."
```

---

### Task 8: GetTeamByPageID / GetTeamDetailByPageID — wikihint d'abord (P1)

Chaque lookup fan-out sur 10 wikis (10 requêtes team + 1 squadplayer) alors que `liq:wikihint:<id>` existe déjà pour les tournois/matchs. Les favoris (`GetTeamsByPageIDs`) multiplient ce coût ×N équipes.

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (`GetTeamByPageID` ~642, `GetTeamDetailByPageID` ~889)
- Test: `backend-go/internal/services/liquipedia_service_test.go`

- [ ] **Step 1: Écrire le test qui échoue**

```go
func TestGetTeamByPageIDUsesWikiHint(t *testing.T) {
	var teamCalls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team":
			teamCalls.Add(1)
			if r.URL.Query().Get("wiki") == "valorant" {
				_, _ = w.Write([]byte(`{"result":[{"pageid":42,"pagename":"Test_Team","name":"Test Team","template":"testteam","status":"active"}]}`))
				return
			}
			_, _ = w.Write([]byte(`{"result":[]}`))
		default: // /squadplayer
			_, _ = w.Write([]byte(`{"result":[]}`))
		}
	}))

	// Cold lookup: fans out, finds the team, must store the hint.
	team, err := svc.GetTeamByPageID(context.Background(), 42)
	require.NoError(t, err)
	require.NotNil(t, team)
	hint, err := mr.Get("liq:wikihint:42")
	require.NoError(t, err)
	require.Equal(t, "valorant", hint)

	// Warm lookup: flush data caches but keep the hint → exactly 1 team call.
	for _, k := range mr.Keys() {
		if k != "liq:wikihint:42" {
			mr.Del(k)
		}
	}
	teamCalls.Store(0)
	_, err = svc.GetTeamByPageID(context.Background(), 42)
	require.NoError(t, err)
	require.Equal(t, int32(1), teamCalls.Load())
}
```

> Note : la clé `liq:wikihint:42` vient de `cache.LiqWikiHintKey("42")` — vérifier le format exact avec `grep -n "func LiqWikiHintKey" internal/cache/patterns.go` et ajuster la string du test si besoin.

- [ ] **Step 2: Vérifier qu'il échoue**

```bash
go test ./internal/services/ -run TestGetTeamByPageIDUsesWikiHint -v
```

Expected: FAIL (le hint n'est jamais écrit/lu pour les teams aujourd'hui).

- [ ] **Step 3: Refactorer GetTeamByPageID**

Remplacer intégralement `GetTeamByPageID` par :

```go
// GetTeamByPageID fetches a single team by its Liquipedia pageid.
// A wiki hint (stored on every successful lookup) usually skips the
// 10-wiki fan-out entirely — favorites re-look the same teams up daily.
func (s *LiquipediaService) GetTeamByPageID(ctx context.Context, pageID int64) (*models.NormalizedTeam, error) {
	pageIDStr := fmt.Sprintf("%d", pageID)
	hintKey := cache.LiqWikiHintKey(pageIDStr)

	if hint, err := s.cache.Get(ctx, hintKey); err == nil && hint != "" {
		if team := s.fetchTeamFromWiki(ctx, hint, pageID); team != nil {
			return team, nil
		}
		// Stale hint — fall through to the fan-out.
	}

	type teamResult struct {
		team *models.NormalizedTeam
		wiki string
	}
	allWikis := s.getAllWikis()
	results := make(chan teamResult, len(allWikis))
	for _, wiki := range allWikis {
		go func(w string) {
			results <- teamResult{s.fetchTeamFromWiki(ctx, w, pageID), w}
		}(wiki)
	}

	for i := 0; i < len(allWikis); i++ {
		select {
		case res := <-results:
			if res.team != nil {
				_ = s.cache.Set(ctx, hintKey, res.wiki, 24*time.Hour)
				return res.team, nil
			}
		case <-ctx.Done():
			return nil, fmt.Errorf("team search timeout for pageid %d", pageID)
		}
	}
	return nil, fmt.Errorf("team with pageid %d not found", pageID)
}

// fetchTeamFromWiki returns the team with roster from one wiki, or nil when
// the wiki doesn't have it.
func (s *LiquipediaService) fetchTeamFromWiki(ctx context.Context, wiki string, pageID int64) *models.NormalizedTeam {
	cacheKey := cache.LiqTeamKey(wiki, fmt.Sprintf("%d", pageID))
	params := url.Values{}
	params.Set("conditions", fmt.Sprintf("[[pageid::%d]]", pageID))
	params.Set("limit", "1")

	data, err := s.MakeRequest(ctx, wiki, "team", params, cacheKey, TTLTeam)
	if err != nil {
		return nil
	}
	resp, err := ParseResponse(data)
	if err != nil || len(resp.Result) == 0 {
		return nil
	}
	var team models.LiqTeam
	if err := json.Unmarshal(resp.Result[0], &team); err != nil {
		return nil
	}
	players := s.fetchSquadPlayers(ctx, wiki, team.PageName)
	normalized := models.NormalizeLiqTeam(team, wiki, players)
	return &normalized
}
```

(Le `params.Set("wiki", w)` de l'ancien code est redondant — `MakeRequest` le fait déjà — ne pas le réintroduire.)

- [ ] **Step 4: Même hint-first dans GetTeamDetailByPageID**

Dans `GetTeamDetailByPageID`, avant la boucle `for _, wiki := range s.getAllWikis() {`, insérer :

```go
	hintKey := cache.LiqWikiHintKey(pageIDStr)
	wikis := s.getAllWikis()
	if hint, err := s.cache.Get(ctx, hintKey); err == nil && hint != "" {
		// Try the hinted wiki first; keep the rest as fallback.
		ordered := make([]string, 0, len(wikis)+1)
		ordered = append(ordered, hint)
		for _, w := range wikis {
			if w != hint {
				ordered = append(ordered, w)
			}
		}
		wikis = ordered
	}
```

puis remplacer `for _, wiki := range s.getAllWikis() {` par `for _, wiki := range wikis {`, et juste avant le `return &detail, nil` ajouter :

```go
			_ = s.cache.Set(ctx, hintKey, wiki, 24*time.Hour)
```

- [ ] **Step 5: Tests + build**

```bash
go test ./internal/services/ -count=1 -v && go build ./...
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
gofmt -w internal/services/
git add internal/services/
git commit -m "perf(backend): use wiki hint to skip 10-wiki fan-out on team lookups

Team lookups fanned out to all 10 wikis on every call even though the same
teams (favorites) are re-looked-up constantly. Store/consume the same
liq:wikihint:<id> used for tournaments; warm lookups now cost 1-2 calls."
```

---

### Task 9: SearchTeams — limit 50 → 500 (P1)

`limit=50` par wiki en ordre alphabétique + filtre client-side : toute équipe active hors du top-50 alphabétique est introuvable. Le payload reste petit (la requête a déjà un `query=` réduit).

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go` (`SearchTeams`, ~ligne 587)

- [ ] **Step 1: Changer la limite**

Remplacer dans `SearchTeams` :

```go
			params.Set("limit", "50")
```

par :

```go
			// 500, not 50: results come back in alphabetical order and are
			// filtered client-side — an active team outside the first 50
			// alphabetically was simply unfindable.
			params.Set("limit", "500")
```

- [ ] **Step 2: Build + tests + commit**

```bash
go build ./... && go test ./internal/services/ -count=1
gofmt -w internal/services/
git add internal/services/liquipedia_service.go
git commit -m "fix(backend): raise team search page to 500 so matches aren't cut off

Results are alphabetical and filtered client-side; limit=50 made any active
team outside the first 50 alphabetically unfindable."
```

---

### Task 10: Hygiène des logs — chemins chauds en Debug (P2)

Chaque cache HIT log en Info → bruit massif en prod (1 ligne par requête HTTP servie du cache).

**Files:**
- Modify: `backend-go/internal/services/liquipedia_service.go`

- [ ] **Step 1: Passer les messages par-requête de Info à Debug**

Dans `MakeRequest` + `getStaleOrError`, changer `.Info(` en `.Debug(` pour **exactement** ces messages (et seulement ceux-là) :

- `"[MAKEREQ] Cache HIT — returning cached data"`
- `"[MAKEREQ] Cache MISS — entering singleflight"`
- `"[MAKEREQ] Cache HIT after singleflight wait"`
- `"[MAKEREQ] Budget OK — making API call"`
- `"[MAKEREQ] Sending HTTP request to Liquipedia"`
- `"[MAKEREQ] HTTP response received"`
- `"[MAKEREQ] Singleflight: shared result from concurrent request"`
- `"[STALE] ♻️ Returning stale data as fallback"`

**Garder en l'état** : `Budget EXHAUSTED` (Warn), `Rate limited (429)` (Warn), `API error` (Error), `Response exceeds size cap` (Error), `No stale data` (Error), `✅ API call success — data cached` (Info — 1 ligne par vrai appel API, c'est le signal utile).

- [ ] **Step 2: Build + tests + commit**

```bash
go build ./... && go test ./internal/services/ -count=1
gofmt -w internal/services/
git add internal/services/liquipedia_service.go
git commit -m "chore(backend): demote per-request cache logs to debug level

Cache hits logged one Info line per served request; only real API calls and
anomalies stay at Info/Warn/Error."
```

---

### Task 11: Documentation CLAUDE.md + validation finale

**Files:**
- Modify: `CLAUDE.md` (racine repo — sections 4, 5.1, 11)

- [ ] **Step 1: Documenter les 2 env vars manquantes (section 4, table Liquipedia)**

Ajouter ces lignes à la table Liquipedia (après `LIQUIPEDIA_SKIP_TLS`) :

```markdown
| `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` | int | `0` (désactivé) / `1500` (docker-compose.dev) | Espacement minimum entre appels HTTP sortants vers Liquipedia | L'API a une limite par IP en plus du quota horaire ; indispensable en local (cold cache = fetch massif). Recommandé en prod : `300` |
| `LIQUIPEDIA_DISABLE_IPV4` | bool | `false` | Désactive le forçage IPv4 vers api.liquipedia.net | Pour un host local avec IPv6 fonctionnel dont l'IPv4 est rate-limitée. **Ne jamais activer sur Railway** (pas d'IPv6) |
```

- [ ] **Step 2: Mettre à jour la section 5.1 (LiquipediaService)**

Dans la liste des fonctionnalités de la section 5.1, mettre à jour/ajouter :

```markdown
* **Client HTTP** : timeout 30 s, User-Agent obligatoire, header `Authorization: Apikey <key>`, IPv4 forcé sur `api.liquipedia.net` (désactivable via `LIQUIPEDIA_DISABLE_IPV4`).
* **Concurrence sortante** : 1 seul appel HTTP en vol à la fois (sémaphore global) + espacement optionnel `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` — l'API a un burst limit et une limite par IP en plus du quota horaire.
* **Cap de taille réponse** : 20 MB ; un dépassement n'est JAMAIS caché (fallback stale) pour éviter de servir du JSON tronqué.
* **Singleflight** : le fetch partagé tourne sur un contexte détaché (35 s) — l'annulation du premier caller ne fait pas échouer les autres.
* **Sélection de champs** : les requêtes match/tournament passent `query=<json tags des structs>` — divise la taille des payloads par 3-10×.
```

- [ ] **Step 3: Mettre à jour la section 11 (Webhooks) — consumer**

Dans la sous-section "Consumer", remplacer le contenu par :

```markdown
`LiquipediaPoller.consumeDirtyFlags` toutes les 2 min :
* Lit `dirtyTracker.GetAndResetDirty()` (atomique)
* **Cooldown par wiki+type** (`dirtyRefreshGate`) : un type ne se refetch pas plus souvent que la moitié de son intervalle de polling (running 4 min, upcoming 10 min, past 22.5 min, tournaments 10 min) — borne le coût webhook à ~2× le polling aveugle au lieu de 10×.
* Les events `Main_Page` (purges automatiques des wikis) sont ignorés dès le handler.
* Flag `Teams` (namespace -10) : invalide `liq:teams:search:<wiki>:*` au lieu de refetcher.
```

- [ ] **Step 4: Validation finale complète**

```bash
cd backend-go && gofmt -l internal/ && go build ./... && go test ./... -count=1
```

Expected: gofmt silencieux, build OK, tous les tests PASS.

- [ ] **Step 5: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document Liquipedia rate-limit knobs and audit fixes"
```

- [ ] **Step 6: Handoff utilisateur**

Le push est manuel (`git push origin liquipedia`) — le signaler à l'utilisateur, ainsi que la reco ops : setter `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS=300` sur Railway preview/prod.

---

## Self-Review

- **Couverture audit** : P0-1 dirty flags → Task 5 ; P0-2 troncature → Task 2 ; P0-3 timeout → Task 3 ; P0-4 singleflight ctx → Task 4 ; P1-5 query fields → Task 7 ; P1-6 team fan-out → Task 8 ; P1-7 SearchTeams → Task 9 ; P1-8 warmup credit → Task 6 ; P2 logs → Task 10 ; P2 spacing prod + doc → Task 11. ✅ (P2 "goroutine budget par requête" volontairement exclu — YAGNI, gain marginal.)
- **Placeholders** : un seul point d'incertitude assumé et borné — le format exact de `LiqWikiHintKey` (Task 8, note avec commande grep de vérification) et la validation curl des field lists (Task 7 Step 1, avec procédure de repli si 400).
- **Cohérence types** : `dirtyRefreshGate.Allow(wiki, typ, cooldown, now)` identique entre Task 5 test et impl ; `maxLiqResponseSize` (var int64) identique Tasks 2 ; consts exportées `LiqMatchQueryFields`/`LiqTournamentQueryFields` renommées en Step 4 de Task 7 et utilisées sous ce nom dans les 3 fichiers consommateurs. ✅
