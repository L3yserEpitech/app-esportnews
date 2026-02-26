# Phase 1 — Fondation Liquipedia (service de base)

> **Statut : A FAIRE**
> **Pre-requis : Phase 0 terminee, cle API Liquipedia v3 fournie**

## Objectif

Creer le client HTTP Go pour l'API Liquipedia v3 REST avec authentification, rate limiting, cache Redis et gestion d'erreurs. Aucun endpoint specifique — juste la plomberie technique.

## API Liquipedia v3 — Informations techniques

- **Base URL** : `https://api.liquipedia.net/api/v3`
- **Authentification** : Header `Authorization: Apikey <token>`
- **User-Agent** : Obligatoire — doit identifier l'application (ex: `EsportNews/1.0 (contact@esportnews.fr)`)
- **Rate limits** : **60 requetes par jeu (wiki) par heure** = 1 req/min/jeu. Avec 10 jeux = 600 req/heure total.
- **Webhooks** : LiquipediaDB envoie des webhooks (`edit`, `delete`, `move`, `purge`) — URL configuree dans le dashboard. Voir `docs/strategie-rate-limiting.md`
- **Format reponse** : JSON
- **Wikis** : Chaque jeu a son propre wiki (ex: `counterstrike`, `valorant`, `leagueoflegends`)

> **IMPORTANT** : La contrainte de 60 req/jeu/heure impacte toute l'architecture. Voir `docs/strategie-rate-limiting.md` pour la strategie complete (background polling + webhooks + budget tracking).

## Fichiers a creer

### 1. `backend-go/internal/services/liquipedia_service.go`

```go
type LiquipediaService struct {
    apiKey      string
    cache       *cache.RedisCache
    httpClient  *http.Client
    budgets     map[string]*RequestBudget  // par wiki
    mu          sync.RWMutex
}

type RequestBudget struct {
    wiki    string
    used    int
    limit   int       // 60
    resetAt time.Time // prochaine heure
    mu      sync.Mutex
}
```

**Methodes :**

| Methode | Description |
|---------|-------------|
| `NewLiquipediaService(apiKey, redisCache)` | Constructeur (initialise les budgets par wiki) |
| `makeRequest(ctx, wiki, endpoint, params, cacheKey, cacheTTL)` | Requete generique avec auth, cache, **budget check** |
| `mapAcronymToWiki(acronym)` | Mapping interne → wiki Liquipedia |
| `GetBudgetStatus()` | Retourne l'etat du budget par wiki (pour monitoring) |

### 1bis. `backend-go/internal/services/liquipedia_poller.go` (NOUVEAU)

```go
type LiquipediaPoller struct {
    service   *LiquipediaService
    cache     *cache.RedisCache
    gameWikis map[string]string
}
```

**Methodes :**

| Methode | Description |
|---------|-------------|
| `NewLiquipediaPoller(service, cache)` | Constructeur |
| `Start(ctx)` | Lance les goroutines de polling par jeu |
| `pollGame(ctx, acronym, wiki)` | Boucle de polling pour un jeu (tickers par endpoint) |
| `Stop()` | Arrete proprement toutes les goroutines |

**Budget par jeu (60 req/heure)** — voir `docs/strategie-rate-limiting.md` :

| Endpoint | Intervalle | Req/heure |
|----------|-----------|-----------|
| Matchs running | 2 min | 30 |
| Matchs upcoming | 10 min | 6 |
| Matchs past | 15 min | 4 |
| Tournois running | 10 min | 6 |
| Tournois upcoming | 15 min | 4 |
| Tournois finished | 30 min | 2 |
| **Total background** | | **52** |
| **Reserve on-demand** | | **8** |

**Mapping jeux → wikis Liquipedia :**

| Acronyme interne | Wiki Liquipedia |
|-----------------|----------------|
| `csgo` | `counterstrike` |
| `valorant` | `valorant` |
| `lol` | `leagueoflegends` |
| `dota2` | `dota2` |
| `rl` | `rocketleague` |
| `codmw` | `callofduty` |
| `r6siege` | `rainbowsix` |
| `ow` | `overwatch` |
| `fifa` | `fifa` |
| `lol-wild-rift` | `wildrift` |

> **Note** : Les noms de wikis exacts seront confirmes avec la doc. Certains peuvent differer.

### 1ter. `backend-go/internal/handlers/webhooks.go` (NOUVEAU)

```go
type WebhookHandler struct {
    liquipediaService *LiquipediaService
    cache             *cache.RedisCache
}

type LiquipediaWebhookEvent struct {
    Page          string `json:"page"`
    FromPage      string `json:"from_page,omitempty"`
    Namespace     int    `json:"namespace"`
    FromNamespace int    `json:"from_namespace,omitempty"`
    Wiki          string `json:"wiki"`
    Event         string `json:"event"` // "edit", "delete", "move", "purge"
}
```

**Methodes :**

| Methode | Description |
|---------|-------------|
| `HandleLiquipediaWebhook(c)` | Endpoint POST — recoit l'event, traite en background, retourne 200 |
| `processWebhookEvent(event)` | Goroutine — identifie le type de contenu, fetch la page mise a jour, update Redis |

**Logique du webhook handler :**

1. Parser le payload JSON (`LiquipediaWebhookEvent`)
2. Ignorer les namespaces non pertinents (garder `0` et `-10`)
3. Lancer `processWebhookEvent()` en goroutine (ne pas bloquer la reponse)
4. Retourner `200 OK` immediatement
5. Dans la goroutine : appeler l'API avec `[[pagename::Page Name]] AND [[namespace::0]]` (1 req)
6. Normaliser et stocker en Redis (meme cle que le poller pour coherence)

**Configuration** : L'URL webhook (`https://api.esportnews.fr/webhooks/liquipedia`) doit etre configuree dans le dashboard LiquipediaDB.

**Logique `makeRequest()` :**

1. Verifier le cache Redis (`cacheKey`)
2. Si cache HIT → retourner les donnees cachees
3. Si cache MISS :
   a. **Verifier le budget** (`budgets[wiki].CanMakeRequest()`) — si epuise, tenter le cache stale
   b. Construire l'URL : `https://api.liquipedia.net/api/v3/{wiki}/{endpoint}`
   c. Ajouter les headers : `Authorization: Apikey {token}`, `User-Agent`, `Accept: application/json`
   d. Envoyer la requete GET avec les query params
   e. Gerer les erreurs : 429 (rate limit) → retry avec backoff, 4xx/5xx → erreur
   f. Parser la reponse JSON
   g. **Enregistrer la requete dans le budget** (`budgets[wiki].RecordRequest()`)
   h. Stocker en cache Redis avec le TTL specifie + **copie stale** (TTL 1h)
   i. Retourner les donnees

**Stale-while-revalidate** : Si le budget est epuise mais qu'on a des donnees stale en cache (TTL plus long), retourner les donnees perimees plutot qu'une erreur.

**TTL cache par type de donnee (adaptes au polling)** :

| Type | TTL Redis | Rafraichi par |
|------|-----------|---------------|
| Matchs en cours (live) | 3 min | Poller (toutes les 2 min) |
| Matchs a venir | 15 min | Poller (toutes les 10 min) |
| Matchs termines | 20 min | Poller (toutes les 15 min) |
| Tournois running | 15 min | Poller (toutes les 10 min) |
| Tournois upcoming | 20 min | Poller (toutes les 15 min) |
| Tournois finished | 1 heure | Poller (toutes les 30 min) |
| Detail match (on-demand) | 5 min | Cache-aside + budget reserve |
| Detail tournoi (on-demand) | 10 min | Cache-aside + budget reserve |
| Equipes / Joueurs | 30 min | Cache-aside + budget reserve |
| Cache stale (backup) | 1 heure | Copie automatique a chaque ecriture |

> **Regle** : TTL Redis > intervalle de polling pour eviter les cache miss entre deux polls.

### 2. `backend-go/internal/models/liquipedia.go`

```go
// LiquipediaResponse est la structure generique de reponse de l'API v3
type LiquipediaResponse struct {
    Result []json.RawMessage `json:"result"`
    // Pagination fields TBD based on actual API docs
}
```

> Les structs specifiques (LiqMatch, LiqTournament, etc.) seront ajoutees dans les phases suivantes.

## Fichiers a modifier

### 3. `backend-go/internal/cache/patterns.go`

Ajouter les constantes et builders :

```go
const (
    LiquipediaMatch          = "liquipedia:match:%s"
    LiquipediaMatches        = "liquipedia:matches:%s:%s"
    LiquipediaMatchesByDate  = "liquipedia:matches:date:%s:%s"
    LiquipediaRunningMatches = "liquipedia:matches:running:%s"
    LiquipediaUpcomingMatches= "liquipedia:matches:upcoming:%s"
    LiquipediaPastMatches    = "liquipedia:matches:past:%s"
    LiquipediaTournament     = "liquipedia:tournament:%s"
    LiquipediaTournaments    = "liquipedia:tournaments:%s:%s"
    LiquipediaTeam           = "liquipedia:team:%s"
    LiquipediaTeamSearch     = "liquipedia:teams:search:%s"
)
```

+ Fonctions `LiquipediaMatchKey(id)`, `LiquipediaTournamentsKey(game, status)`, etc.

### 4. `backend-go/internal/config/config.go`

Deja fait en Phase 0 — `LiquipediaAPIKey` est declare et lu depuis `LIQUIPEDIA_API_KEY`.

### 5. `backend-go/cmd/server/main.go`

```go
// Apres la ligne "// Liquipedia service will be initialized here in Phase 1"
liquipediaService := services.NewLiquipediaService(cfg.LiquipediaAPIKey, redisClient)

// Demarrer le poller en background
poller := services.NewLiquipediaPoller(liquipediaService, redisClient)
go poller.Start(ctx)
defer poller.Stop()
```

> Le service et le poller sont instancies. Le poller commence a pre-fetcher les donnees. Les handlers (Phase 2+) liront depuis Redis.

### 5bis. Endpoint monitoring budget (optionnel)

```go
// Endpoint admin pour surveiller la consommation API
adminGroup.GET("/api-budget", func(c echo.Context) error {
    return c.JSON(http.StatusOK, liquipediaService.GetBudgetStatus())
})
```

### 6. `backend-go/.env`

L'utilisateur doit remplir :
```
LIQUIPEDIA_API_KEY=<sa-cle-api>
```

## Verification

- [ ] `go build ./...` compile avec le nouveau `LiquipediaService` + `LiquipediaPoller`
- [ ] Le backend demarre sans erreur
- [ ] Le poller se lance et log les premiers appels par jeu
- [ ] Un appel test retourne des donnees de Liquipedia
- [ ] Le cache Redis fonctionne : 1er appel = MISS + stockage, 2e appel = HIT
- [ ] Le budget tracker compte correctement les requetes par wiki
- [ ] Le budget ne depasse jamais 60 req/heure/wiki (verifiable via `/admin/api-budget`)
- [ ] Quand le budget est epuise, le service retourne les donnees stale (pas d'erreur)
- [ ] Le User-Agent est correctement envoye (verifiable dans les logs)
- [ ] `GET /admin/api-budget` retourne l'etat du budget par jeu

## Points d'attention

1. **Cle API** : L'utilisateur doit avoir un acces approuve a l'API v3 de Liquipedia
2. **60 req/jeu/heure** : Contrainte stricte. Le budget tracker est essentiel. Voir `docs/strategie-rate-limiting.md`
3. **Webhooks** : Investiguer en priorite — contacter Liquipedia Discord `#api-help` pour les details
4. **Wikis** : Les noms de wikis doivent correspondre exactement a ceux de Liquipedia
5. **Format reponse** : La structure exacte sera confirmee avec la doc fournie par l'utilisateur
6. **Polling conditionnel** : Si aucun match running pour un jeu, ne pas poller les matchs live (economiser le budget)

## Dependances

- Phase 0 terminee (pas de reference a PandaScore)
- Cle API Liquipedia v3 valide
- Redis operationnel
- Investigation webhooks Liquipedia (optionnel mais recommande)
