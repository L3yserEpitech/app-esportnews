# Strategie Rate Limiting — Liquipedia API v3

> **Contrainte** : 60 requetes par jeu (wiki) par heure
> **Jeux** : 10 wikis = 600 requetes/heure total
> **Impact** : Architecture "cache-aside on-demand" insuffisante → passer en **background polling + webhooks**

## Le probleme

60 requetes par jeu par heure, ca semble beaucoup mais ca couvre **tout** :

- **Matchs en direct** (running) — scores qui changent en temps reel
- **Matchs a venir** (upcoming) — nouveaux matchs annonces, horaires modifies
- **Matchs passes** (past) — resultats finaux
- **Tournois en cours / a venir / termines** — progressions, bracket updates
- **Equipes / joueurs** — recherche, detail equipe, rosters
- **Detail d'un match ou tournoi** (clic utilisateur) — requete on-demand

Avec un cache-aside classique (requete utilisateur → cache miss → appel API), on ne controle pas la consommation :

```
Utilisateur visite /match → cache miss → appel Liquipedia
Autre utilisateur visite /match 30s plus tard → cache expire → appel Liquipedia
10 visites en 1 minute → potentiellement 10 appels API (si cache 0s)
Avec cache 30s, matchs live → 120 req/heure/jeu → DEPASSE LA LIMITE (60)
```

Et ca c'est **juste pour les matchs live**. Si on ajoute les matchs upcoming (6 req), past (4 req), 3 types de tournois (~12 req), on explose le budget sans meme compter les clics utilisateur sur les details.

## La solution : 3 niveaux

### Niveau 1 — Webhooks LiquipediaDB (disponibles et documentes)

LiquipediaDB envoie des webhooks quand le contenu change. L'URL webhook se configure dans le **dashboard LiquipediaDB**.

**Events disponibles** :

| Event | Description | Payload |
|-------|-------------|---------|
| `edit` | Page creee ou modifiee (score MAJ, nouveau match, etc.) | `{ page, namespace, wiki, event }` |
| `delete` | Page supprimee | `{ page, namespace, wiki, event }` |
| `move` | Page renommee/deplacee | `{ from_page, page, from_namespace, namespace, wiki, event }` |
| `purge` | Cache de la page purge | `{ page, namespace, wiki, event }` |

**Payload type (edit/delete/purge)** :
```json
{
    "page": "Page Name",
    "namespace": 0,
    "wiki": "valorant",
    "event": "edit"
}
```

**Payload move** :
```json
{
    "from_page": "Old Page Name",
    "page": "New Page Name",
    "from_namespace": 0,
    "namespace": 0,
    "wiki": "valorant",
    "event": "move"
}
```

**Namespaces importants** :
- `0` = contenu principal (matchs, tournois, joueurs) — **c'est celui qu'on ecoute**
- `-10` = teamtemplates (logos, infos equipes)

**Utilisation du `page` et `namespace`** : Le nom de page et le namespace recus dans le webhook peuvent etre utilises directement dans les appels API avec les conditions : `[[pagename::Page Name]] AND [[namespace::0]]`. Cela permet de **fetch uniquement la page modifiee** (1 requete ciblee).

**Principe — Debounce par wiki (IMPORTANT)** :

Les webhooks arrivent **par page individuelle** (1 webhook par match edite, 1 par page tournoi, etc.). Si 10 matchs Valorant sont live et que les editeurs mettent a jour les scores + un tournoi progresse + un nouveau match est annonce, on pourrait recevoir 50+ webhooks/heure pour un seul jeu. Faire 1 appel API par webhook depasserait le budget.

**Solution : marquer "dirty" par type + batch fetch** :

```
Webhook match 1 Valorant (edit)      → marquer "valorant:matches_running:dirty = true"
Webhook match 3 Valorant (edit)      → deja marque dirty, on ignore
Webhook tournoi X Valorant (edit)    → marquer "valorant:tournaments:dirty = true"
Webhook nouveau match annonce (edit) → marquer "valorant:matches_upcoming:dirty = true"
Webhook resultats finalises (edit)   → marquer "valorant:matches_past:dirty = true"

Goroutine periodique verifie :
  Toutes les 2 min : Si "matches_running:dirty" → 1 requete GET matchs running (tous les matchs live)
  Toutes les 5 min : Si "matches_upcoming:dirty" → 1 requete GET matchs upcoming
  Toutes les 5 min : Si "tournaments:dirty" → 1 requete GET tournois running
  Toutes les 10 min : Si "matches_past:dirty" → 1 requete GET matchs past
  → Reset dirty flags apres fetch
```

**Cout reel** : Meme budget max que le polling mais avec l'avantage de **ne rien consommer quand aucun webhook n'arrive** (nuit calme = 0 req). Le debounce regroupe N webhooks en 1 seul batch fetch par type.

**Comparaison (TOUS types de donnees confondus)** :

| Situation | Polling aveugle | Webhooks + debounce |
|-----------|----------------|---------------------|
| Soiree calme (aucune activite) | 52 req/heure (gaspille) | **0 req/heure** |
| 0 match live mais tournois actifs | 52 req/heure | **~6 req/heure** (juste tournois dirty) |
| 3 matchs live, scores stables | 52 req/heure | **~6 req/heure** (upcoming/past seulement) |
| 10 matchs live, MAJ frequentes + tournois actifs | 52 req/heure | **~42 req/heure** (tout dirty) |
| Grosse soiree esport (tout bouge) | 52 req/heure (fixe) | **~51 req/heure** (mais reactive) |

**Avantages du debounce** :
- Budget quasi-nul quand rien ne change (economies massives sur les periodes calmes)
- Couvre **tous les types** : matchs running, upcoming, past, tournois, equipes
- Meme latence que le polling (2 min pour live, 5-10 min pour le reste) mais seulement quand necessaire
- Budget libere pour les requetes on-demand (detail match, recherche equipe, detail tournoi)

**Configuration** :
1. Dans le dashboard LiquipediaDB, configurer l'URL webhook : `https://api.esportnews.fr/webhooks/liquipedia`
2. Le backend doit etre accessible publiquement (pas de localhost)
3. Pas de signature documentee — valider par IP source ou secret custom dans l'URL

**Backend Go** :
```go
// handlers/webhooks.go
type WebhookHandler struct {
    dirtyFlags map[string]*DirtyFlag  // par wiki : "valorant" → { matches: true, tournaments: false }
    mu         sync.RWMutex
}

type DirtyFlag struct {
    MatchesRunning  bool      // Matchs en direct (scores qui changent)
    MatchesUpcoming bool      // Matchs a venir (nouveaux matchs, horaires)
    MatchesPast     bool      // Matchs termines (resultats finaux)
    Tournaments     bool      // Tournois (progressions, brackets)
    Teams           bool      // Equipes (rosters, logos)
    LastEvent       time.Time
}

type LiquipediaWebhookEvent struct {
    Page          string `json:"page"`
    FromPage      string `json:"from_page,omitempty"`
    Namespace     int    `json:"namespace"`
    FromNamespace int    `json:"from_namespace,omitempty"`
    Wiki          string `json:"wiki"`
    Event         string `json:"event"`
}

func (h *WebhookHandler) HandleLiquipediaWebhook(c echo.Context) error {
    var event LiquipediaWebhookEvent
    if err := c.Bind(&event); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
    }

    // Ignorer les events hors namespace principal
    if event.Namespace != 0 && event.Namespace != -10 {
        return c.NoContent(http.StatusOK)
    }

    // Marquer le wiki comme "dirty" (PAS de fetch immediat)
    h.markDirty(event)

    return c.NoContent(http.StatusOK)
}

func (h *WebhookHandler) markDirty(event LiquipediaWebhookEvent) {
    h.mu.Lock()
    defer h.mu.Unlock()

    flag, ok := h.dirtyFlags[event.Wiki]
    if !ok {
        flag = &DirtyFlag{}
        h.dirtyFlags[event.Wiki] = flag
    }

    // Identifier le type de contenu via heuristique sur le page name
    // Ex: une page match contient souvent "vs" ou le nom d'un tournoi parent
    // Le namespace -10 = teamtemplates → Teams
    if event.Namespace == -10 {
        flag.Teams = true
    } else {
        // Namespace 0 : contenu principal
        // Heuristique a affiner avec la structure reelle des pages Liquipedia
        // Par defaut, marquer matchs (running + upcoming) ET tournois comme dirty
        // Car un edit de page peut concerner un match en cours OU un match annonce
        flag.MatchesRunning = true
        flag.MatchesUpcoming = true
        flag.MatchesPast = true
        flag.Tournaments = true
    }
    flag.LastEvent = time.Now()
}

// Appelee par le poller toutes les 2 min
func (h *WebhookHandler) GetAndResetDirtyWikis() map[string]*DirtyFlag {
    h.mu.Lock()
    defer h.mu.Unlock()

    result := h.dirtyFlags
    h.dirtyFlags = make(map[string]*DirtyFlag)  // reset
    return result
}
```

**Integration avec le poller** :
```go
// Le poller a des tickers differents par type de donnees :
// - Toutes les 2 min : check dirty flags pour matchs running (live, prioritaire)
// - Toutes les 5 min : check dirty flags pour matchs upcoming + tournois
// - Toutes les 10 min : check dirty flags pour matchs past + tournois finished

// Exemple : ticker 2 min (matchs live)
dirtyWikis := webhookHandler.GetAndResetDirtyFlags("MatchesRunning")
for _, wiki := range dirtyWikis {
    go poller.refreshRunningMatches(wiki)  // 1 requete = TOUS les matchs live du jeu
}

// Exemple : ticker 5 min (matchs upcoming + tournois)
dirtyUpcoming := webhookHandler.GetAndResetDirtyFlags("MatchesUpcoming")
for _, wiki := range dirtyUpcoming {
    go poller.refreshUpcomingMatches(wiki)  // 1 requete
}

dirtyTournaments := webhookHandler.GetAndResetDirtyFlags("Tournaments")
for _, wiki := range dirtyTournaments {
    go poller.refreshRunningTournaments(wiki)   // 1 requete
    go poller.refreshUpcomingTournaments(wiki)   // 1 requete
}

// Exemple : ticker 10 min (matchs past + tournois finished)
dirtyPast := webhookHandler.GetAndResetDirtyFlags("MatchesPast")
for _, wiki := range dirtyPast {
    go poller.refreshPastMatches(wiki)  // 1 requete
}

// Pour les wikis NON dirty → AUCUNE requete (economie de budget)
```

**Note** : Chaque `refresh*()` fait 1 seule requete API qui retourne TOUS les elements de ce type pour le jeu (ex: tous les matchs running Valorant). C'est l'API qui fait le travail, pas nous. Donc 10 matchs live = 1 requete, pas 10.

---

### Niveau 2 — Background polling intelligent (complement des webhooks)

Le polling sert de **filet de securite** : decouvrir de nouveaux matchs/tournois que les webhooks n'auraient pas couverts, et s'assurer que le cache ne devienne pas trop stale.

**Avec webhooks actifs**, le polling peut etre **beaucoup moins frequent** :

**Principe** :
```
Goroutine background (par jeu) :
  → Toutes les X minutes, appelle Liquipedia
  → Stocke le resultat en Redis (TTL long)
  → Tous les utilisateurs lisent depuis Redis (0 appel API direct)
```

**Budget par jeu — Scenario A : Webhooks + debounce (recommande)** :

| Source | Debounce check | Req/heure (tout actif) | Req/heure (calme) | Note |
|--------|---------------|------------------------|-------------------|------|
| **Matchs running** | Toutes les 2 min si dirty | 30 | **0** | Priorite haute — scores live |
| **Matchs upcoming** | Toutes les 5 min si dirty | 12 | **0** | Nouveaux matchs annonces |
| **Matchs past** | Toutes les 10 min si dirty | 6 | **0** | Resultats finaux |
| **Tournois running** | Toutes les 5 min si dirty | 12 | **0** | Progression tournois |
| **Tournois upcoming** | Toutes les 10 min si dirty | 6 | **0** | Rarement dirty |
| **Tournois finished** | Toutes les 30 min si dirty | 2 | **0** | Tres rarement dirty |
| **Total max** | | **68** ⚠️ | **0** | Depasse ! Voir ajustement ↓ |

⚠️ **Probleme** : Si TOUT est dirty en permanence, on depasse 60. Mais en pratique :
- Les matchs past ne changent pas souvent (dirty quelques fois/heure, pas en continu)
- Les tournois upcoming/finished sont rarement dirty
- En realite, le pire cas realiste est une grosse soiree esport :

| Source | Realiste grosse soiree | Req/heure |
|--------|----------------------|-----------|
| Matchs running (dirty en continu) | 2 min | 30 |
| Matchs upcoming (dirty ~3 fois/heure) | 5 min si dirty | 3 |
| Matchs past (dirty ~2 fois/heure) | 10 min si dirty | 2 |
| Tournois running (dirty ~4 fois/heure) | 5 min si dirty | 4 |
| Tournois upcoming (dirty ~1 fois/heure) | 10 min si dirty | 1 |
| Tournois finished (pas dirty) | — | 0 |
| **Total** | | **40** |
| **Reserve on-demand** | | **20** |

**Soiree calme (aucun webhook)** → 0 req background → **60 req on-demand** disponibles !

**Clé** : Le dirty flag ne se rallume que quand un webhook arrive. Pas de webhook = pas de requete. C'est ca la difference fondamentale avec le polling aveugle.

**Budget par jeu — Scenario B : Sans webhooks (fallback polling aveugle)** :

| Endpoint | Intervalle | Req/heure | Priorite |
|----------|-----------|-----------|----------|
| Matchs running (live) | 2 min | 30 | HAUTE — scores en temps reel |
| Matchs upcoming | 10 min | 6 | MOYENNE — horaires, nouveaux matchs |
| Matchs past | 15 min | 4 | BASSE — resultats finaux, stable |
| Tournois running | 10 min | 6 | MOYENNE — progression brackets |
| Tournois upcoming | 15 min | 4 | BASSE — rarement modifie |
| Tournois finished | 30 min | 2 | TRES BASSE — archive |
| **Total background** | | **52** | **Fixe, meme si rien ne change** |
| **Reserve on-demand** | | **8** | Detail match, recherche equipe, detail tournoi |

**Reserve on-demand (8 req/heure)** : Pour les requetes declenchees par un clic utilisateur :
- Detail d'un match specifique (`/matches/:id`) → 1 req
- Detail d'un tournoi specifique (`/tournaments/:id`) → 1 req
- Recherche d'equipes → 1 req par recherche
- Detail d'une equipe → 1 req
- Matchs par date (`/matches/by-date`) → 1 req

⚠️ **8 req on-demand c'est tres peu** — si 8 utilisateurs cliquent sur des details differents dans la meme heure, le budget est epuise. C'est pourquoi le **Scenario A (webhooks)** est fortement recommande.

---

### Recapitulatif : qui consomme quoi dans les 60 req/jeu/heure

```
┌──────────────────────────────────────────────────────────┐
│                   60 REQUETES / JEU / HEURE              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  MATCHS (3 types)                                        │
│  ├── Running (live)   : 0-30 req  (scores en direct)     │
│  ├── Upcoming         : 0-12 req  (nouveaux matchs)      │
│  └── Past             : 0-6 req   (resultats)            │
│                                                          │
│  TOURNOIS (3 types)                                      │
│  ├── Running          : 0-12 req  (progression)          │
│  ├── Upcoming         : 0-6 req   (annonces)             │
│  └── Finished         : 0-2 req   (archives)             │
│                                                          │
│  ON-DEMAND (clics utilisateur)                           │
│  ├── Detail match     : 1 req/clic                       │
│  ├── Detail tournoi   : 1 req/clic                       │
│  ├── Recherche equipe : 1 req/recherche                  │
│  ├── Detail equipe    : 1 req/clic                       │
│  └── Matchs par date  : 1 req/date consultee             │
│                                                          │
│  Avec webhooks : 0-40 background + 20-60 on-demand       │
│  Sans webhooks : 52 background (fixe) + 8 on-demand      │
└──────────────────────────────────────────────────────────┘
```

> **Important** : 1 requete API retourne TOUS les elements d'un type pour un jeu. Donc "30 req/heure pour matchs running" = 30 appels qui retournent chacun la liste complete des matchs live, pas 30 matchs individuels.

---

**Optimisation : polling conditionnel** :
- Si **aucun match running** pour un jeu → ne pas poller les matchs running (economiser 12-30 req/heure)
- Si **aucun tournoi running** → ne pas poller les tournois running
- Redistribuer le budget economise vers d'autres endpoints

```go
// services/liquipedia_poller.go
type LiquipediaPoller struct {
    service     *LiquipediaService
    cache       *cache.RedisCache
    gameWikis   map[string]string  // acronym → wiki
    budgets     map[string]*RequestBudget
}

type RequestBudget struct {
    game        string
    used        int
    limit       int       // 60
    resetAt     time.Time // prochaine heure
    mu          sync.Mutex
}

func (p *LiquipediaPoller) Start(ctx context.Context) {
    for acronym, wiki := range p.gameWikis {
        go p.pollGame(ctx, acronym, wiki)
    }
}

func (p *LiquipediaPoller) pollGame(ctx context.Context, acronym, wiki string) {
    tickerLive := time.NewTicker(2 * time.Minute)
    tickerUpcoming := time.NewTicker(10 * time.Minute)
    tickerPast := time.NewTicker(15 * time.Minute)
    // ... select sur les tickers, appeler les methodes et stocker en Redis
}
```

**Cache TTLs (adaptes au polling)** :

| Donnee | TTL Redis | Raison |
|--------|-----------|--------|
| Matchs running | 3 min | Rafraichi toutes les 2 min par le poller |
| Matchs upcoming | 15 min | Rafraichi toutes les 10 min |
| Matchs past | 20 min | Rafraichi toutes les 15 min |
| Tournois running | 15 min | Rafraichi toutes les 10 min |
| Tournois upcoming | 20 min | Rafraichi toutes les 15 min |
| Tournois finished | 1 heure | Rafraichi toutes les 30 min |
| Detail match (on-demand) | 5 min | Cache + budget reserve |
| Detail tournoi (on-demand) | 10 min | Cache + budget reserve |
| Equipes/joueurs (on-demand) | 30 min | Rarement modifie |

> **Regle** : TTL Redis > intervalle de polling (pour eviter les cache miss entre deux polls)

---

### Niveau 3 — Cache-aside intelligent (complement)

Pour les requetes on-demand (detail match, recherche equipe), garder le cache-aside mais avec un **budget tracker** :

```go
func (s *LiquipediaService) makeRequest(ctx context.Context, wiki, endpoint string, params url.Values, cacheKey string, cacheTTL time.Duration) ([]byte, error) {
    // 1. Verifier le cache Redis
    cached, err := s.cache.Get(ctx, cacheKey)
    if err == nil {
        return cached, nil // Cache HIT → pas de requete API
    }

    // 2. Verifier le budget
    if !s.budget.CanMakeRequest(wiki) {
        return nil, ErrRateLimitExceeded // Budget epuise → retourner erreur ou donnees stale
    }

    // 3. Appel API + stocker en cache
    data, err := s.doHTTPRequest(ctx, wiki, endpoint, params)
    if err != nil {
        return nil, err
    }

    s.budget.RecordRequest(wiki)
    s.cache.Set(ctx, cacheKey, data, cacheTTL)
    return data, nil
}
```

**Gestion du budget epuise** :
- Si le budget est epuise et le cache est vide → retourner une erreur 503 avec `Retry-After`
- Si le budget est epuise mais le cache a des donnees expirees → retourner les **donnees stale** (mieux que rien)

```go
// Stale-while-revalidate : garder les donnees meme apres expiration du TTL
func (s *LiquipediaService) getWithStale(ctx context.Context, cacheKey string) (data []byte, fresh bool) {
    // Verifier cache "frais" (TTL normal)
    data, err := s.cache.Get(ctx, cacheKey)
    if err == nil {
        return data, true
    }
    // Verifier cache "stale" (TTL plus long, ex: 1h)
    data, err = s.cache.Get(ctx, cacheKey+":stale")
    if err == nil {
        return data, false
    }
    return nil, false
}
```

---

## Architecture globale

```
                          Liquipedia API v3
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               Webhooks    Poller    On-demand
               (push)    (background) (cache-aside)
                    │          │          │
                    └──────────┼──────────┘
                               │
                          Redis Cache
                        (source unique)
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               /matches   /tournaments  /teams
               handlers    handlers     handlers
                    │          │          │
                    └──────────┼──────────┘
                               │
                         Frontend Next.js
```

**Principe cle** : Les handlers HTTP ne font **jamais** d'appel direct a Liquipedia. Ils lisent **toujours** depuis Redis. Seuls le poller, les webhooks et les requetes on-demand ecrivent dans Redis.

---

## Monitoring du budget

Ajouter un endpoint admin pour surveiller la consommation :

```
GET /admin/api-budget
```

```json
{
  "budgets": {
    "valorant": { "used": 42, "limit": 60, "remaining": 18, "resets_at": "2026-02-21T15:00:00Z" },
    "counterstrike": { "used": 55, "limit": 60, "remaining": 5, "resets_at": "2026-02-21T15:00:00Z" },
    "leagueoflegends": { "used": 30, "limit": 60, "remaining": 30, "resets_at": "2026-02-21T15:00:00Z" }
  },
  "total_used": 320,
  "total_limit": 600
}
```

---

## Impact sur les phases

| Phase | Impact |
|-------|--------|
| **Phase 1** | `LiquipediaService` inclut `RequestBudget` + `LiquipediaPoller` + `WebhookHandler`. Configurer URL webhook dans dashboard LiquipediaDB. |
| **Phase 2** | Matchs : webhooks pour MAJ scores live + poller en filet de securite. Detail match on-demand avec budget reserve. |
| **Phase 3** | Tournois : webhooks pour MAJ tournois + poller en filet de securite. Detail on-demand. |
| **Phase 4** | Equipes/joueurs : on-demand uniquement (cache 30min). Webhooks namespace `-10` pour MAJ teamtemplates. |
| **Phase 5** | Live : donnees fraiches via webhooks (quasi-temps-reel) + poller backup (5min). |

---

## Recommandations

1. **Configurer les webhooks en Phase 1** — C'est la brique la plus importante. Configurer l'URL dans le dashboard LiquipediaDB des que le backend est deploy.
2. **Implementer le polling comme fallback** — Les webhooks peuvent avoir des retards ou des pertes. Le polling garantit que le cache reste frais.
3. **Budget tracking des le debut** — Integrer le compteur de requetes dans Phase 1 pour ne jamais depasser la limite.
4. **Donnees stale > pas de donnees** — Toujours retourner des donnees (meme perimees) plutot qu'une erreur.
5. **Monitorer les webhooks** — Logger chaque event recu, compter les events par wiki/type, alerter si aucun event depuis X minutes (webhook casse ?).
6. **Tester en staging** — Le backend doit etre accessible publiquement pour recevoir les webhooks. Utiliser ngrok ou un tunnel en dev.

## Sources

- [Liquipedia API](https://liquipedia.net/api) — Page principale API
- [Liquipedia API Terms of Use](https://liquipedia.net/api-terms-of-use)
- [Liquipedia API Usage Guidelines](https://liquipedia.net/commons/Liquipedia:API_Usage_Guidelines)
- [LiquipediaDB Documentation](https://liquipedia.net/commons/Help:LiquipediaDB) — Documentation webhooks
