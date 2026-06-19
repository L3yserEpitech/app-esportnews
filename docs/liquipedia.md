# Intégration Liquipedia API v3 — Référence technique avancée

> **Statut du document** : à jour avec le code de la branche `liquipedia` (vérifié contre `backend-go/` le 2026-06-18).
> **Portée** : référence technique profonde de tout le pipeline Liquipedia (service HTTP central, poller, webhooks, cache, handlers, normalisation, proxy d'images, scheduler de notifications).
> **Complément** : `CLAUDE.md` §10 (Intégration) et §11 (Webhooks) donnent la vue d'ensemble — ce document descend au niveau fichier/fonction/constante. Les références de champs bruts de l'API externe sont dans `docs/liquipedia_match.md`, `docs/liquipedia_tournois.md`, `docs/liquipedia_team.md`, `docs/liquipedia_player.md`, `docs/liquipedia_squadplayer.md`.

---

## 1) État des lieux (ce qui est réellement implémenté)

| Composant | Fichier | État |
|-----------|---------|------|
| Service HTTP central | `internal/services/liquipedia_service.go` | ✅ Implémenté + câblé (`main.go:147`) |
| Poller background (10 jeux) | `internal/services/liquipedia_poller.go` | ✅ Implémenté + démarré (`main.go:259`) |
| Couche lecture cache | `internal/services/liquipedia_reader.go` | ✅ Implémenté |
| Webhook handler + dirty flags | `internal/handlers/webhooks.go` + poller | ✅ Implémenté ; **OFF par défaut** (`LIQUIPEDIA_WEBHOOKS_ENABLED=false`) |
| Modèles + normalisation | `internal/models/liquipedia*.go`, `team.go` | ✅ Implémenté |
| Clés de cache Redis | `internal/cache/patterns.go` | ✅ Implémenté |
| Handlers HTTP (matchs/tournois/équipes) | `internal/handlers/{matches,tournaments,teams}.go` | ✅ Implémenté + câblé |
| Proxy d'images | `internal/handlers/image_proxy.go` | ✅ Implémenté |
| Monitoring budget | `GET /api/admin/api-budget` | ✅ Implémenté (`main.go:252`) |
| Notification scheduler (consommateur) | `internal/services/notification_scheduler.go` | ✅ Implémenté |
| Tests | `internal/services/liquipedia_service_test.go` | ✅ Présents (singleflight, cache, cap taille, dirty gate) |

**Sources de données** : Liquipedia API v3 est la **source unique** pour matchs, tournois, équipes, joueurs, rosters, streams. PandaScore et SportDevs sont **retirés** (voir `CLAUDE.md` §17 — historique de migration). Aucune persistance en base de ces données : tout vit dans Redis (volatile).

**Quota** : la prémisse historique « 60 req/wiki/h » est **obsolète**. Le quota réel publié par Liquipedia est **1000 req/wiki/h depuis juin 2026** (`defaultBudgetLimitPerWiki = 1000`). Les intervalles du poller (~17 req/wiki/h) ont été calibrés pour 60 et **volontairement conservés** par prudence — il reste ~983 req/wiki/h pour les requêtes on-demand.

---

## 2) Architecture & flux de données

```
                  ┌────────────────────────────┐
                  │   Liquipedia API v3 (HTTP)  │
                  │   1000 req/wiki/h + burst    │
                  └──────────────┬──────────────┘
                                 │ Authorization: Apikey …
        ┌────────────────────────┼────────────────────────┐
        │ écritures               │ écritures (on-demand)   │
        ▼                         ▼                         ▼
┌───────────────┐        ┌─────────────────┐       ┌───────────────┐
│ LiquipediaPoller│ ───▶ │ LiquipediaService│ ◀──── │ Handlers HTTP │
│ (background)    │      │  .MakeRequest()  │       │ (on-demand)   │
└───────┬────────┘      └────────┬─────────┘       └───────┬───────┘
        │ écrit cache             │ cache + :stale          │ lit cache /
        ▼                         ▼                         ▼ cache-aside
                       ┌────────────────────┐
                       │   Redis (volatile)  │
                       │  liq:* + liq:*:stale│
                       └─────────┬───────────┘
                                 │ lecture seule
        ┌────────────────────────┼────────────────────────┐
        ▼                                                  ▼
┌──────────────────┐                          ┌───────────────────────┐
│ Handlers listes   │                          │ NotificationScheduler  │
│ (cache-only)      │                          │ (consommateur Redis)   │
└──────────────────┘                          └───────────────────────┘

   Webhook LiquipediaDB ──▶ WebhookHandler ──▶ DirtyTracker ──▶ poller.consumeDirtyFlags
```

**Deux chemins d'écriture du cache** :
1. **Poller** (proactif) : maintient chaud les listes running/upcoming/past (matchs) et running/upcoming/finished (tournois), par wiki.
2. **Cache-aside on-demand** (réactif) : détails de match/tournoi, recherche d'équipes, matchs/placements d'équipe, listes par date — peuplés à la première requête utilisateur via `MakeRequest`.

**Lecture** : les handlers de listes lisent Redis **uniquement** (jamais d'appel API synchrone). Les endpoints de détail / par-date / équipes passent par `MakeRequest` (cache-aside).

---

## 3) Connexion API

| Élément | Valeur | Source |
|---------|--------|--------|
| Base URL | `https://api.liquipedia.net/api/v3` | `liquipedia_service.go:26` |
| Auth | header `Authorization: Apikey <LIQUIPEDIA_API_KEY>` | `liquipedia_service.go:385` |
| User-Agent | `EsportNews/1.0 (contact@esportnews.fr)` (obligatoire) | `liquipedia_service.go:27` |
| Accept | `application/json` | `liquipedia_service.go:387` |
| Format requête | `GET /v3/{endpoint}?wiki={wiki}&conditions=…&query=…&limit=…&order=…` | `liquipedia_service.go:371-378` |
| Format réponse | `{ "result": [ …objets… ], "error"?: [], "warning"?: [] }` | `models/liquipedia.go:8` |

**Encodage des params** : les espaces sont encodés en `%20` (pas `+`) — `strings.ReplaceAll(encode, "+", "%20")` (`liquipedia_service.go:377`), car le langage de conditions Liquipedia n'accepte pas `+`.

**Triple limite de débit réelle** (à ne pas confondre) :
1. **Quota horaire** : 1000 req/wiki/h (suivi par `RequestBudget`).
2. **Burst court** : fanout simultané sur les 10 wikis renvoie 429 même avec quota frais → sérialisation globale via `maxConcurrentRequests = 1` (`liquipedia_service.go:39`).
3. **Limite par IP** : motive le forçage IPv4 (une seule IP de sortie maîtrisée).

---

## 4) Mapping jeux ↔ wikis

Source unique : `models.GameWikiMapping` (`models/liquipedia.go:26`). `models.WikiToAcronym` est l'inverse, généré à l'init.

| Acronyme interne | Wiki Liquipedia |
|------------------|-----------------|
| `csgo` | `counterstrike` |
| `valorant` | `valorant` |
| `lol` | `leagueoflegends` |
| `dota2` | `dota2` |
| `rl` | `rocketleague` |
| `codmw` | `callofduty` |
| `r6siege` | `rainbowsix` |
| `ow` | `overwatch` |
| `fifa` | `easportsfc` ⚠️ |
| `lol-wild-rift` | `wildrift` |

⚠️ **`fifa` → `easportsfc`** : le wiki FIFA a été renommé « EA Sports FC » par Liquipedia. L'acronyme interne reste `fifa` (compat frontend) mais le wiki appelé est `easportsfc`.

---

## 5) Service central — `LiquipediaService`

### `MakeRequest(ctx, wiki, endpoint, params, cacheKey, cacheTTL) ([]byte, error)`

Pipeline complet (`liquipedia_service.go:309`) :

1. **Fast-path cache** : `cache.Get(cacheKey)` → HIT renvoie immédiatement.
2. **Singleflight** (`sfGroup.Do(cacheKey, …)`) : N requêtes concurrentes pour la même clé ⇒ **1 seul** appel API ; les autres partagent le résultat. Le contexte est détaché (`context.WithoutCancel`) + timeout 35 s, pour qu'un appelant qui annule (déconnexion navigateur) ne fasse pas échouer les autres.
3. **Re-check cache** dans le singleflight (un autre goroutine a pu peupler entre-temps).
4. **Budget check** : `budget.CanMakeRequest()`. Si épuisé/bloqué → `getStaleOrError` (cache `:stale` ou erreur).
5. **Concurrence globale** : acquisition d'un slot dans `sem` (capacité `maxConcurrentRequests = 1`).
6. **Espacement optionnel** : si `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS > 0`, attend l'intervalle minimum depuis le dernier appel (utile cold-start / dev local).
7. **HTTP GET** avec auth + UA + Accept.
8. **Gestion réponse** :
   - `429` → `budget.Record429()` (backoff) + fallback stale.
   - autre non-200 → log + fallback stale.
   - body > `maxLiqResponseSize` (20 MB) → **refus de cacher** (évite un JSON tronqué corrompu) + fallback stale.
   - `200` OK → lecture body (cap 20 MB), `budget.RecordRequest()`, écriture cache **frais (`cacheTTL`)** + **copie `:stale` (TTL 6 h)**.

### Méthodes publiques principales

| Méthode | Rôle |
|---------|------|
| `MakeRequest(...)` | Requête générique cache-aside + budget |
| `MatchesByStatus(ctx, acronym, status)` | Lit le cache poller (running/upcoming/past) — **cache-only** (`liquipedia_reader.go`) |
| `TournamentMatches(ctx, acronym, tournamentID)` | Matchs d'un tournoi (résout pagename via pageid, puis `[[parent::pagename]]`) |
| `SearchTeams(ctx, query, pageSize)` | Recherche multi-wiki + filtre côté Go (Liquipedia ne fait pas de recherche partielle) |
| `GetTeamByPageID` / `GetTeamByTemplate` / `GetTeamsByPageIDs` | Détail équipe + roster |
| `GetTeamDetailByPageID` | Détail enrichi (page équipe) |
| `FetchTeamMatches(wiki, template, type)` | Matchs `recent`/`upcoming` d'une équipe |
| `FetchTeamPlacements(wiki, name, limit)` | Placements en tournoi (`/placement`) |
| `FetchBatchSquadPlayers(...)` | Rosters de plusieurs équipes en 1 appel (`[[pagename::A]] OR [[pagename::B]]…`) |
| `GetBudgetStatus()` | Snapshot budget tous wikis (endpoint admin) |
| `MapAcronymToWiki(acronym)` | Mapping acronyme → wiki |

### Détails réseau (constructeur `NewLiquipediaService`)

- **Timeout HTTP** : 30 s (payloads `matches_past` mesurés ~9-17 s ; 15 s brûlait la requête juste avant la fin).
- **Forçage IPv4** : `DialContext` force `tcp4` vers `api.liquipedia.net` (IPv6 injoignable sur Railway/Docker → 3 s perdues par requête sinon). Désactivable : `LIQUIPEDIA_DISABLE_IPV4=true`.
- **TLS skip** (dev only) : `LIQUIPEDIA_SKIP_TLS=true`.

---

## 6) Budget de requêtes — `RequestBudget`

Un `RequestBudget` par wiki (`liquipedia_service.go:71`).

- **Limite** : `LiquipediaBudgetPerWiki` (défaut **1000**, env `LIQUIPEDIA_BUDGET_PER_WIKI`).
- **Persistance Redis** : clé `liq:budget:<wiki>:<YYYYMMDDHH>`, rechargée au démarrage (`loadFromRedis`) → un redémarrage dans la même heure ne remet pas le compteur à zéro. Écriture best-effort async.
- **Reset** : à chaque heure pleine (`maybeReset`), efface aussi le backoff 429.
- **Backoff 429** (`Record429`) : 5 min au 1er 429, puis ×2 sur 429 consécutifs, **plafonné à 30 min**. Un 429 transitoire ≠ quota épuisé : il bloque brièvement la wiki puis expire seul (n'attend pas le reset horaire).
- **Fallback** (`getStaleOrError`) : renvoie `<cacheKey>:stale` (TTL 6 h) si dispo, sinon erreur `no data available`.

---

## 7) Poller background — `LiquipediaPoller`

Démarré pour les 10 jeux au boot (`main.go:259`). Deux phases par wiki (`pollGame`) :

**Phase 1 — Warmup** : décalage inter-wiki de `WarmupStaggerInterval = 20 s` (10 wikis × 20 s ≈ 3,3 min de warmup total), puis fetch des 6 types de données avec `WarmupIntraDelay = 2 s` entre appels (évite le burst).

**Phase 2 — Polling régulier** : 6 tickers, un par type.

| Type | Constante intervalle | Valeur | TTL cache associé |
|------|----------------------|--------|-------------------|
| Matchs running | `PollIntervalMatchesRunning` | **8 min** | `TTLMatchesRunning` = 10 min |
| Matchs upcoming | `PollIntervalMatchesUpcoming` | **20 min** | `TTLMatchesUpcoming` = 22 min |
| Matchs past | `PollIntervalMatchesPast` | **45 min** | `TTLMatchesPast` = 50 min |
| Tournois running | `PollIntervalTournamentsRunning` | **20 min** | `TTLTournamentsRunning` = 22 min |
| Tournois upcoming | `PollIntervalTournamentsUpcoming` | **30 min** | `TTLTournamentsUpcoming` = 35 min |
| Tournois finished | `PollIntervalTournamentsFinished` | **90 min** | `TTLTournamentsFinished` = 100 min |

> **Règle d'or** : `TTL cache > intervalle de polling`, pour qu'il n'y ait jamais de trou où le cache est vide entre deux polls.

**Restriction des champs** (`query`) : les requêtes match/tournoi restreignent les champs renvoyés à `LiqMatchQueryFields` / `LiqTournamentQueryFields` (`liquipedia_poller.go:46`) — tout le reste était jeté au parsing. Cela fait tomber `matches_past` de ~9 MB à une fraction (réseau, mémoire Redis, marge sous le cap 20 MB).

**Fenêtres temporelles** (pour borner la taille) : matchs past = 7 derniers jours ; tournois finished = 30 derniers jours.

**Mode webhooks activé** : les tickers passent en « filet de sécurité » — ils ne rafraîchissent que si le dernier refresh date de plus de `3 × intervalle` (`safetyMultiplier`). Le rafraîchissement régulier est alors piloté par les dirty flags.

---

## 8) Webhooks + dirty flags

### Ingestion — `WebhookHandler` (`handlers/webhooks.go`)

- **Route** : `POST /api/webhooks/liquipedia`.
- **Authentification** : `crypto/subtle.ConstantTimeCompare` sur le header `X-Webhook-Secret` (tests curl) **puis**, si absent, sur le query param `?secret=` (livraisons réelles — le dashboard LiquipediaDB ne permet ni header custom ni signature). Secret vide ⇒ contrôle désactivé (dev only).
- **Filtres** : type d'event dans `{edit, delete, move, purge}` ; namespace ∈ `{0, -10}` (sinon ignoré) ; `Main_Page` ignoré (purges automatiques) ; wiki inconnue ignorée.
- **Action** : `DirtyTracker.MarkDirty(event)` puis `HTTP 200` vide immédiat (refresh async).

### Suivi — `DirtyTracker` (`liquipedia_poller.go:62`)

- Namespace **-10** (teamtemplates) → flag `Teams`.
- Namespace **0** (contenu principal) → impossible de distinguer match/tournoi par le nom de page ⇒ marque tout (`MatchesRunning/Upcoming/Past + Tournaments`). Le coût est borné par les cooldowns.

### Consommation — `poller.consumeDirtyFlags` (tick `DirtyCheckInterval = 2 min`)

- Lit + reset atomique (`GetAndResetDirty`).
- **Cooldown par wiki+type** (`dirtyRefreshGate`) = moitié de l'intervalle de polling : running **4 min**, upcoming **10 min**, past **22,5 min**, tournaments **10 min**. Borne le coût webhook à ~2× le polling aveugle (au lieu de ~10× : avant correctif, chaque webhook ns0 refetchait 5 types toutes les 2 min ≈ 150 req/h/wiki actif — c'est ce qui brûlait le quota).
- Flag `Teams` : **invalide** `liq:teams:search:<wiki>:*` (DelPattern) au lieu de refetcher.

### Activation

`LIQUIPEDIA_WEBHOOKS_ENABLED=true` (prod cible) → consumer actif + tickers en filet de sécurité. `false` (défaut/dev) → polling aveugle aux intervalles fixes (Scenario B).

---

## 9) Cache Redis

Toutes les clés sont construites via `internal/cache/patterns.go`. Variante stale : `<clé>:stale` (`StaleKey`).

| Clé (builder) | Pattern | TTL | Peuplé par |
|---------------|---------|-----|------------|
| `LiqMatchesRunningKey` | `liq:matches:running:<wiki>` | 10 min | Poller |
| `LiqMatchesUpcomingKey` | `liq:matches:upcoming:<wiki>` | 22 min | Poller |
| `LiqMatchesPastKey` | `liq:matches:past:<wiki>` | 50 min | Poller |
| `LiqMatchesByDateKey` | `liq:matches:date:<wiki>:<YYYY-MM-DD>` | 6 h (date passée) / **10 min** (aujourd'hui + futur) | On-demand |
| `LiqMatchKey` | `liq:match:<wiki>:<id>` | 5 min / 24 h (finished) | On-demand |
| `LiqTournamentsRunningKey` | `liq:tournaments:running:<wiki>` | 22 min | Poller |
| `LiqTournamentsUpcomingKey` | `liq:tournaments:upcoming:<wiki>` | 35 min | Poller |
| `LiqTournamentsFinishedKey` | `liq:tournaments:finished:<wiki>` | 100 min | Poller |
| `LiqTournamentsByDateKey` | `liq:tournaments:date:<wiki>:<date>` | **10 min** | On-demand |
| `LiqTournamentKey` | `liq:tournament:<wiki>:<id>` | 10 min | On-demand |
| `LiqTournamentMatchesKey` | `liq:tournament:matches:<wiki>:<pagename>` | 10 min | On-demand |
| `LiqTournamentSquadsKey` | `liq:tournament:squads:<wiki>:<pagename>` | **10 min** (`TTLTournamentDetail`) | On-demand (enrichissement détail tournoi) |
| `LiqTeamSearchKey` | `liq:teams:search:<wiki>:<query>` | 30 min | On-demand |
| `LiqTeamKey` | `liq:team:<wiki>:<id\|template>` | 6 h | On-demand |
| `LiqTeamSquadKey` | `liq:team:squad:<wiki>:<pagename>` | 6 h | On-demand |
| `LiqTeamMatchesRecentKey` | `liq:team:matches:recent:<wiki>:<template>` | 15 min | On-demand |
| `LiqTeamMatchesUpcomingKey` | `liq:team:matches:upcoming:<wiki>:<template>` | 15 min | On-demand |
| `LiqTeamPlacementsKey` | `liq:team:placements:<wiki>:<name>` | 1 h | On-demand |
| `LiqWikiHintKey` | `liq:wikihint:<id>` | 24 h | Détail (évite le scan des 10 wikis) |
| budget | `liq:budget:<wiki>:<YYYYMMDDHH>` | ~1 h | `RequestBudget` |

---

## 10) Endpoints HTTP exposés (chemin de lecture)

Préfixe `/api`. **Cache-only** = lit Redis sans jamais appeler l'API (le poller garde chaud). **Cache-aside** = `MakeRequest` (peuple à la 1re requête).

### Matchs (`handlers/matches.go`)
| Endpoint | Méthode | Chemin de lecture |
|----------|---------|-------------------|
| `/live` | GET | Cache-only (alias de running) |
| `/matches/running` | GET | Cache-only (`MatchesByStatus` → `running`) |
| `/matches/upcoming` | GET | Cache-only (`not_started`) |
| `/matches/past` | GET | Cache-only (`finished`) |
| `/matches/by-date` | POST | **Aujourd'hui → cache poller (0 budget)** ; sinon cache-aside (`LiqMatchesByDateKey`) — body form `date=YYYY-MM-DD&game=acronyme` |
| `/matches/:id` | GET | Cache-aside + fanout multi-wiki + wiki hint |

**Nuances matchs** :
- `/matches/running` : après lecture du cache poller, applique un **filtre fenêtre temporelle** (date entre `now-12h` et `now+6h`) + tri ASC. Si le cache frais est vide, retombe sur le cache `:stale` au niveau handler.
- `/matches/by-date` : valide la date dans **±1 an** ; pour la **date du jour**, sert depuis les 3 caches poller (running+upcoming+past) → **zéro appel API** ; sinon fanout multi-wiki on-demand (TTL 6 h si date passée, 10 min sinon).
- `/matches/:id` : `?wiki=` optionnel pour cibler 1 wiki. Sans wiki → (1) wiki hint Redis, (2) scan des 3 caches poller, (3) fetch on-demand wiki par wiki. **Un ID purement numérique → 404 rapide** (ne peut être qu'un pageid déjà couvert par le scan, ou un ancien ID PandaScore — jamais un `match2id` alphanumérique), ce qui épargne le budget sur les vieilles URLs crawlées.

### Tournois (`handlers/tournaments.go`)
| Endpoint | Méthode | Chemin de lecture |
|----------|---------|-------------------|
| `/tournaments` | GET | Cache-only (running) |
| `/tournaments/all` | GET | Cache-only (running, sans filtre) |
| `/tournaments/upcoming` | GET | Cache-only (upcoming) |
| `/tournaments/finished` | GET | Cache-only (finished) |
| `/tournaments/filtered` | GET | Cache-only (choix du cache selon `status`) |
| `/tournaments/:id` | GET | Cache-aside (scan des 3 caches + `MakeRequest`) |
| `/tournaments/by-date` | POST | Cache-aside (`LiqTournamentsByDateKey`) — tournois chevauchant la date |

**Nuances tournois** :
- Listes (`/tournaments`, `/all`, `/upcoming`, `/finished`, `/filtered`) : pagination `limit`/`offset` (défaut limit **5000**), tri `sort` (`tier` ou `begin_at`, préfixe `-` = desc). `filter[tier]` filtre **en mémoire** sur le tier normalisé (`s,a,b,c,d` — voir §11).
- `/tournaments/:id` : 3 étapes (wiki hint → scan caches → on-demand `[[pagename::…]]` puis `[[pageid::…]]`). Le résultat est **enrichi** (`enrichTournamentWithMatches`) : matchs du tournoi via `[[parent::pagename]]`, extraction des équipes + rosters depuis les opponents, puis **batch squad fetch en 1 appel** (`FetchBatchSquadPlayers`). Filtre les matchs TBD obsolètes (sans opponents réels et date passée/invalide). Réponse = `EnrichedTournamentDetail`.

### Équipes & favoris (`handlers/teams.go`)
| Endpoint | Méthode | Chemin de lecture |
|----------|---------|-------------------|
| `/teams/search?query=&page_size=` | GET | On-demand multi-wiki + filtre Go (TTL 30 min) |
| `/teams/by-template?template=&wiki=` | GET | On-demand (TTL 6 h) |
| `/teams/:id` | GET | On-demand fanout + wiki hint (roster inclus) |
| `/teams/:id/detail` | GET | On-demand fanout + wiki hint (`EnrichedTeamDetail`) |
| `/teams/:id/matches?wiki=&template=&name=` | GET | **Cache-first** : lit les caches poller (past/upcoming/running) filtrés par template + `:stale` ; **fallback API** (`FetchTeamMatches`) si cache vide et `name` fourni. Max 10 recent / 10 upcoming |
| `/teams/:id/placements?wiki=&name=` | GET | On-demand (`/placement`, TTL 1 h) |
| `/users/favorite-teams/ids` | GET | DB (GORM) — IDs bruts |
| `/users/favorite-teams` | GET | DB + résolution Liquipedia parallèle (`GetTeamsByPageIDs`) |
| `/users/favorite-teams/:teamId` | POST / DELETE | DB — **max 3 favoris** (POST refuse au-delà) |

### Infra
| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/proxy/image?url=…` | GET | Proxy d'images Liquipedia (anti-hotlink) |
| `/webhooks/liquipedia` | POST | Ingestion webhooks LiquipediaDB |
| `/admin/api-budget` | GET | Monitoring budget (JWT admin) |

---

## 11) Modèles & normalisation

Le backend convertit les structures Liquipedia (`Liq*`) en structures **compatibles avec l'interface frontend `PandaMatch`/`PandaTournament`** (noms historiques conservés). Source : `models/liquipedia_match.go`, `liquipedia_tournament.go`, `team.go`.

### Matchs
- `LiqMatch` (brut API) → `NormalizeLiqMatch(m, wiki, statusHint)` → `NormalizedMatch` (forme PandaMatch exacte).
- Champs nested passés en `json.RawMessage` puis normalisés : `match2opponents` → opponents + results, `match2games` → games, `stream` → streams_list, `match2bracketdata` → bracket.
- **Filtrage** : `HasTwoNamedOpponents()` exige ≥ 2 opponents nommés non-TBD non-`literal` (cache les matchs incomplets). **Déduplication** : `UniqueKey()` = `objectname`.
- **Statut** (`computeMatchStatus`) : `statusHint` prioritaire (running/not_started/finished selon le cache source) ; sinon `finished==1` → finished, date passée → running, sinon not_started.
- **Date** : `"YYYY-MM-DD HH:MM:SS"` → ISO 8601 `…TZ`.
- **Streams** : avec `rawstreams=true&streamurls=true`, `stream` est une map plateforme→URL. Priorité twitch/youtube/twitch2/3/afreecatv pour le « main ». Embed URL construit pour twitch/youtube.
- **Logos** : si seul un filename `icon` existe, URL dérivée via `https://liquipedia.net/commons/Special:FilePath/<icon>` ; variante dark dérivée du pattern `lightmode→darkmode`.

### Tournois & équipes
- `LiqTournament` → `NormalizeLiqTournament` → `NormalizedTournament` (`liquipedia_tournament.go`).
  - **Statut** (`ComputeStatus`) : `status=="finished"` → finished ; sinon comparaison startdate/enddate vs aujourd'hui → upcoming / running / finished.
  - **Tier** (`mapLiquipediaTier`) : tier numérique Liquipedia → lettre — `1→s`, `2→a`, `3→b`, `4→c`, `5`/`-1→d` (défaut `d`).
  - **Prize pool** (`formatPrizePool`) : `json.Number` → `"$1,000,000"` (nil si 0).
  - **League** dérivée de `SeriesPage` (ID = hash, URL = `liquipedia.net/<wiki>/<SeriesPage>`). **HasBracket** = `Format != ""`. **WinnerID** extrait de `extradata.winner` (hashé).
- `LiqTeam` (+ `LiqSquadPlayer` via `/squadplayer`) → `NormalizeLiqTeam` / `NormalizeLiqTeamDetail` → `NormalizedTeam` / `EnrichedTeamDetail` avec roster (joueurs `type=player`, hors `former`).
- `LiqPlacement` → `NormalizeLiqPlacement` (placements non vides uniquement). Réponses : `TeamMatchesResponse {recent, upcoming}`, `TeamPlacementsResponse {placements}`.

### Videogame (mapping wiki → frontend)
`NormalizeLiqMatch`/`NormalizeLiqTournament` injectent un `videogame {id, name, slug}` dérivé du wiki via 3 maps (`liquipedia_tournament.go:172-211`). Ex. : `counterstrike → {3, "CS2", "cs2"}`, `valorant → {26, "Valorant", "valorant"}`, `leagueoflegends → {1, "League of Legends", "lol"}`, `easportsfc`*… Le `slug` videogame correspond à l'acronyme interne frontend (ex. `rl`, `r6siege`, `lol-wild-rift`).

> \* ⚠️ Les maps videogame sont encore keyées sur l'ancien nom de wiki **`fifa`** (pas `easportsfc`). Comme `GameWikiMapping` envoie `easportsfc`, le videogame d'un match EA Sports FC retombe sur le **défaut** (id `0`, name/slug = `easportsfc`). À corriger si l'affichage videogame FIFA importe (re-keyer `videogame*Map` sur `easportsfc`).

### IDs
Liquipedia n'a pas d'ID entier stable pour tout : les IDs frontend sont dérivés par hash de nom (`hashStringToInt`) ou par `pageid`. Les pageid servent de clé pour les détails.

---

## 12) Proxy d'images — `ImageProxyHandler`

`GET /api/proxy/image?url=https://liquipedia.net/commons/...` (`handlers/image_proxy.go`).

- **Pourquoi** : liquipedia.net bloque le hotlinking ; le backend refait la requête avec le bon User-Agent et stream l'image.
- **Sécurité** : `allowedHosts` limité à `liquipedia.net` / `www.liquipedia.net`.
- **Limites** : 5 MB max/image, cache navigateur 7 jours, cache mémoire 500 images, 50 fetches concurrents, throttle 10 s sur 429 upstream, pacing ~33 req/s (`fetchInterval = 30 ms`).
- **Réseau** : dialer IPv4 (IPv6 injoignable depuis Docker ; `Special:FilePath` fait 2 redirections).

---

## 13) Notification scheduler (consommateur)

`internal/services/notification_scheduler.go` — **pur consommateur** de la donnée Liquipedia :
- `liqService.MatchesByStatus(ctx, acronym, MatchStatusRunning)` pour détecter les matchs suivis qui passent live.
- `liqService.TournamentMatches(...)` pour les souscriptions de tournoi.
- Aucun appel API direct : tout passe par le cache fronté par `LiquipediaService`.

(Voir `CLAUDE.md` §12 et §20 pour la chaîne push Expo → APNs/FCM.)

---

## 14) Variables d'environnement

| Variable | Défaut | Rôle |
|----------|--------|------|
| `LIQUIPEDIA_API_KEY` | `""` | Clé API v3 (vide ⇒ poller désactivé) |
| `LIQUIPEDIA_BUDGET_PER_WIKI` | `1000` | Plafond req/wiki/h (`RequestBudget.Limit`) |
| `LIQUIPEDIA_WEBHOOKS_ENABLED` | `false` | `true` ⇒ mode dirty-flags + tickers filet de sécurité |
| `LIQUIPEDIA_WEBHOOK_SECRET` | `""` | Secret attendu (header `X-Webhook-Secret` ou query `?secret=`) ; vide ⇒ pas de contrôle |
| `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` | `0` (off) | Espacement min entre appels sortants (cold-start/dev) |
| `LIQUIPEDIA_DISABLE_IPV4` | `false` | `true` ⇒ ne pas forcer IPv4 (dev local avec IPv6 fonctionnel) |
| `LIQUIPEDIA_SKIP_TLS` | `false` | `true` ⇒ désactive la vérification TLS (dev only) |

Source : `internal/config/config.go:37-99`.

---

## 15) Monitoring — `GET /api/admin/api-budget`

JWT admin requis. Renvoie `GetBudgetStatus()` :

```json
{
  "budgets": {
    "valorant": { "wiki": "valorant", "used": 17, "limit": 1000, "remaining": 983, "resets_at": "2026-06-18T15:00:00Z" }
  },
  "total_used": 170,
  "total_limit": 10000
}
```

---

## 16) Runbook opérationnel

| Symptôme | Diagnostic | Action |
|----------|-----------|--------|
| Listes vides au boot | Warmup en cours (~3,3 min, stagger 20 s/wiki) | Attendre la fin du warmup ; vérifier les logs `Warmup complete for wiki` |
| `no data available` (503) | Budget épuisé **et** pas de `:stale` | Vérifier `/admin/api-budget` ; le `:stale` (6 h) couvre normalement ces trous |
| 429 répétés sur une wiki | Burst limit / IP | Backoff auto (5/10/20 min) ; envisager `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` |
| Quota qui se vide vite | Webhooks trop bavards | Vérifier les cooldowns `dirtyRefreshGate` ; `Main_Page` doit être ignoré |
| Activer les webhooks | — | `LIQUIPEDIA_WEBHOOKS_ENABLED=true` + secret + URL `?secret=` dans le dashboard LiquipediaDB |
| Images cassées | Hotlink bloqué / 429 proxy | Vérifier que le frontend passe par `/api/proxy/image?url=…` |
| Profiter du quota 1000 | Intervalles encore calibrés pour 60 | Resserrer les `PollInterval*` dans `liquipedia_poller.go` (et les TTL > intervalle) |

---

## 17) Pièges connus (gotchas)

1. **`fifa` → `easportsfc`** : ne pas « corriger » en `fifa`.
2. **Intervalles calibrés pour 60 req/h** : conservés volontairement malgré le quota à 1000 (marge de stabilisation). Les resserrer impose de remonter les TTL en cohérence.
3. **`maxConcurrentRequests = 1`** : sérialisation globale volontaire (burst limit). Ne pas augmenter sans tester le 429.
4. **Cap réponse 20 MB** : au-delà, refus de cacher (anti-JSON-tronqué). `matches_past` valorant ≈ 9,3 MB.
5. **Aucune persistance DB** : tout est dans Redis ; un flush Redis vide les listes jusqu'au prochain poll/warmup.
6. **Encodage `%20`** : les conditions ne supportent pas `+`.
7. **Webhooks : secret dans l'URL** : le dashboard ne supporte pas les headers custom. L'URL contient donc le secret en clair (query param).
8. **`LIQUIPEDIA_API_KEY` vide ⇒ poller désactivé** (log `poller disabled`), mais le service reste instancié (les endpoints renverront du vide/stale).

---

## 18) Annexes — références de champs de l'API externe

Ces documents reproduisent la doc officielle Liquipedia (data points par endpoint). Ils décrivent l'API **externe** (stable indépendamment de notre code) :

- `docs/liquipedia_match.md` — endpoint `/match` (table match2)
- `docs/liquipedia_tournois.md` — endpoint `/tournament`
- `docs/liquipedia_team.md` — endpoint `/team`
- `docs/liquipedia_player.md` — endpoint `/player`
- `docs/liquipedia_squadplayer.md` — endpoint `/squadplayer`
