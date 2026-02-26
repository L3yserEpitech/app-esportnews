# Phase 3 — Tournois (donnees Liquipedia)

> **Statut : ✅ TERMINEE**
> **Pre-requis : Phase 2 terminee, doc API Liquipedia tournois fournie**

## Objectif

Remplacer les stubs tournoi (qui retournent `[]`) par de vraies donnees provenant de l'API Liquipedia v3. Le frontend doit afficher les tournois sans changement majeur grace a la normalisation backend.

> **RATE LIMITING** : 60 req/jeu/heure. Les tournois running/upcoming/finished sont pre-fetches par le **poller background** (Phase 1). Les handlers lisent depuis Redis. Seuls `/tournaments/:id` et `/tournaments/by-date` utilisent le cache-aside on-demand (budget reserve). Voir `docs/strategie-rate-limiting.md`.

## Endpoints a rebrancher

| Route | Methode | Description | Etat actuel |
|-------|---------|-------------|-------------|
| `/api/tournaments` | GET | Tournois en cours (running) | Retourne `[]` |
| `/api/tournaments/all` | GET | Tous les tournois en cours | Retourne `[]` |
| `/api/tournaments/upcoming` | GET | Tournois a venir | Retourne `[]` |
| `/api/tournaments/finished` | GET | Tournois termines | Retourne `[]` |
| `/api/tournaments/by-date` | POST | Tournois a une date precise | Retourne `[]` |
| `/api/tournaments/:id` | GET | Details d'un tournoi | Retourne `{}` |
| `/api/tournaments/filtered` | GET | Tournois avec filtres avances | Retourne `[]` |

**Parametres supportes :**
- `limit`, `offset` : pagination (defaut 20 / 0)
- `sort` : tri (`tier`, `-tier`, `begin_at`, `-begin_at`)
- `game` (query) : acronyme du jeu pour filtrer
- `status` : statut du tournoi (`running`, `upcoming`, `finished`)
- `filter[tier]` : rang du tournoi (`s`, `a`, `b`, `c`, `d`)
- `date` (form body, YYYY-MM-DD) : pour `/by-date`

## Backend — Fichiers a modifier

### 1. `backend-go/internal/models/liquipedia.go` — Ajouter les structs tournoi

```go
type LiqTournament struct {
    // Champs Liquipedia natifs (a definir avec la doc)
    // ...
}

type LiqLeague struct {
    // ...
}

type LiqSerie struct {
    // ...
}
```

**Normalisation** : Une fonction `normalizeLiqTournamentToPandaTournament(liqTournament) PandaTournament` transformera les donnees Liquipedia en un format compatible avec le frontend existant.

**Champs critiques que le frontend attend :**

| Champ frontend (PandaTournament) | Description | Utilise par |
|----------------------------------|-------------|-------------|
| `id` | Identifiant unique | URLs, navigation |
| `name` | Nom du tournoi | TournamentCard, TournamentDetail |
| `slug` | Slug URL | Recherche |
| `status` | `running`, `upcoming`, `finished` | Badges statut, filtrage, onglets |
| `type` | Format du tournoi | TournamentStats |
| `tier` | Rang (`s`, `a`, `b`, `c`, `d`) | Badge couleur (getTierColor), filtrage |
| `begin_at` | Date debut ISO 8601 | Dates, tri, badge LIVE |
| `end_at` | Date fin ISO 8601 | Dates, progression |
| `region` | Region (EMEA, NA, etc.) | Badge region |
| `prizepool` | Dotation (ex: "$1,000,000") | Formatage (1M€, 100K€) |
| `has_bracket` | Bracket disponible | Affichage optionnel |
| `videogame.id` | ID jeu | Filtrage |
| `videogame.name` | Nom du jeu | Badge jeu |
| `videogame.slug` | Slug du jeu | Filtrage |
| `league.id` | ID ligue | Navigation |
| `league.name` | Nom de la ligue | Sous-titre, recherche |
| `league.image_url` | Logo de la ligue | Image |
| `league.slug` | Slug ligue | |
| `teams[]` | Liste des equipes | Compteur equipes, TeamsRosters |
| `teams[].id` | ID equipe | Navigation |
| `teams[].name` | Nom equipe | Affichage |
| `teams[].acronym` | Sigle equipe | Badge |
| `teams[].image_url` | Logo equipe | Image |
| `matches[]` | Liste des matchs du tournoi | Compteur, section matchs |
| `matches[].id` | ID match | Navigation |
| `matches[].status` | Statut match | Compteur par statut |
| `matches[].number_of_games` | BO format | Stats (BO1/BO3/BO5) |
| `matches[].live.supported` | Live disponible | Compteur live |
| `expected_roster[]` | Rosters confirmes | TeamsRosters |
| `expected_roster[].team` | Equipe du roster | |
| `expected_roster[].players[]` | Joueurs du roster | |
| `winner_id` | ID equipe gagnante | Badge gagnant |

### 2. `backend-go/internal/services/liquipedia_service.go` — Ajouter les methodes tournoi

| Methode | Endpoint Liquipedia | Filtres |
|---------|-------------------|---------|
| `GetRunningTournaments(ctx, gameAcronym, sort, limit, offset)` | TBD avec doc | Status = en cours |
| `GetUpcomingTournaments(ctx, gameAcronym, sort, limit, offset)` | TBD avec doc | Status = a venir |
| `GetFinishedTournaments(ctx, gameAcronym, sort, limit, offset)` | TBD avec doc | Status = termine |
| `GetAllRunningTournaments(ctx, sort)` | TBD avec doc | Tous les jeux, en cours |
| `GetTournamentById(ctx, id)` | TBD avec doc | Par ID |
| `GetTournamentsByDate(ctx, date, game)` | TBD avec doc | Par date + jeu optionnel |
| `GetFilteredTournaments(ctx, game, status, tier)` | TBD avec doc | Filtres multiples |

**Mode de fonctionnement par endpoint :**

| Endpoint handler | Source de donnees | Mode |
|-----------------|-------------------|------|
| `ListTournaments` (running) | Redis (poller toutes les 10 min) | Lecture Redis uniquement |
| `ListAllTournaments` (running) | Redis (poller toutes les 10 min) | Lecture Redis uniquement |
| `ListAllUpcomingTournaments` | Redis (poller toutes les 15 min) | Lecture Redis uniquement |
| `ListAllFinishedTournaments` | Redis (poller toutes les 30 min) | Lecture Redis uniquement |
| `GetTournament` (par ID) | Cache-aside on-demand (budget reserve) | Appel API si cache miss |
| `ListTournamentsByDate` | Cache-aside on-demand (budget reserve) | Appel API si cache miss |
| `FilterTournaments` | Redis (donnees poller) + filtrage Go | Lecture Redis + filtre en memoire |

Chaque methode :
1. **Poller** : Appelle `makeRequest()`, parse en `[]LiqTournament`, normalise en `[]PandaTournament`, stocke en Redis
2. **Handlers** : Lisent depuis Redis. Pour les endpoints on-demand, appelle `makeRequest()` avec verification budget.
3. Applique pagination (`limit`, `offset`) et tri (`sort`) cote Go
4. Retourne le resultat

**Tri** : La fonction `sortByTierAndDate()` deja conservee dans `tournaments.go` sera reutilisee pour trier les resultats.

### 3. `backend-go/internal/handlers/tournaments.go` — Rebrancher les handlers

La struct `TournamentHandler` recoit un champ `liquipediaService *services.LiquipediaService`.

Chaque handler :
1. Lit les parametres de query/body
2. Appelle la methode correspondante du service
3. Retourne le resultat JSON normalise

**Pagination** : Les endpoints avec `limit`/`offset` doivent paginer les resultats. Si l'API Liquipedia supporte la pagination native, l'utiliser. Sinon, paginer cote Go.

### 4. `backend-go/internal/handlers/factory.go`

```go
func NewTournamentHandler(liquipediaService *services.LiquipediaService) *TournamentHandler {
    return &TournamentHandler{
        liquipediaService: liquipediaService,
    }
}
```

### 5. `backend-go/cmd/server/main.go`

```go
tournamentHandler := handlers.NewTournamentHandler(liquipediaService)
```

## Frontend — Fichiers a verifier/modifier

### 6. `frontend/app/types/index.ts`

Les types `PandaTournament`, `PandaLeague`, `PandaSerie`, `PandaRoster`, etc. sont deja definis. Si la normalisation backend est correcte, **aucun changement necessaire**.

### 7. `frontend/next.config.ts`

Deja fait en Phase 2 — domaine images Liquipedia ajoute.

### 8. Composants a verifier (pas de modification si normalisation OK)

| Composant | Ce qu'il utilise | Verifier |
|-----------|-----------------|---------|
| `frontend/app/components/tournaments/TournamentCard.tsx` | `id`, `name`, `tier`, `videogame`, `league`, `begin_at`, `end_at`, `prizepool`, `teams[]`, `matches[]`, `region`, `status` | Badge tier (getTierColor), prizepool format, badge LIVE, compteurs equipes/matchs |
| `frontend/app/components/tournaments/TournamentFilters.tsx` | Filtres tier (UI only) | Pas de changement attendu |
| `frontend/app/components/tournaments/RunningTournaments.tsx` | `tournamentService.getRunningTournaments()` → max 6 tournois | Carousel homepage |
| `frontend/app/components/tournaments/TournamentStats.tsx` | `matches[]` (par statut, format BO), `teams[]`, `expected_roster[]`, `tier`, `prizepool`, `winner_id`, `begin_at`/`end_at` | Progress bar, stats calculs |
| `frontend/app/components/tournaments/TeamsRosters.tsx` | `expected_roster[].team`, `expected_roster[].players[]` | Grille equipes, roles joueurs |
| `frontend/app/tournois/TournamentsPageClient.tsx` | Pagination, tri, filtres, recherche modale (⌘K) | Grille 3 colonnes, GameSelector, AdColumn |
| `frontend/app/tournois/[id]/TournamentDetailPageClient.tsx` | Tous les champs + enrichissement matchs + articles lies | Page detail complete, SEO schemas |

### 9. Services frontend (pas de modification)

| Service | Endpoints appeles | Changement |
|---------|------------------|-----------|
| `frontend/app/services/tournamentService.ts` | `/api/tournaments`, `/upcoming`, `/finished`, `/all`, `/by-date`, `/:id`, `/filtered` | Aucun — les URLs ne changent pas |

## Strategie de normalisation

```
Liquipedia API v3          Backend Go (normalizer)         Frontend (inchange)
─────────────────    →    ─────────────────────────    →    ──────────────────
LiqTournament struct      PandaTournament-shaped JSON       PandaTournament interface
(format Liquipedia)       (meme shape que avant)            (types existants)
```

**Points specifiques au normalizer tournois :**
- Reconstruire `teams[]` au format `PandaTeam[]` (id, name, slug, acronym, image_url)
- Reconstruire `matches[]` au format `PandaMatch[]` (id, name, status, number_of_games, live)
- Reconstruire `expected_roster[]` au format `PandaRoster[]` (team + players[])
- Mapper `tier` : Liquipedia utilise peut-etre des noms differents → mapper vers `s`/`a`/`b`/`c`/`d`
- Mapper `status` : Liquipedia → `running`/`upcoming`/`finished`
- Gerer `prizepool` : format string attendu (ex: "$1,000,000")
- Gerer `winner_id` : ID equipe gagnante

## Verification

- [ ] `GET /api/tournaments` retourne des tournois en cours
- [ ] `GET /api/tournaments?game=valorant&sort=tier` retourne des resultats filtres et tries
- [ ] `GET /api/tournaments/upcoming` retourne des tournois a venir
- [ ] `GET /api/tournaments/finished` retourne des tournois termines
- [ ] `GET /api/tournaments/all` retourne tous les tournois running (multi-jeux)
- [ ] `GET /api/tournaments/:id` retourne le detail complet d'un tournoi (avec teams, matches, rosters)
- [ ] `POST /api/tournaments/by-date` avec `date=YYYY-MM-DD` retourne les tournois du jour
- [ ] `GET /api/tournaments/filtered?game=lol&status=running&filter[tier]=s` retourne des resultats filtres
- [ ] Pagination fonctionne (`limit=12&offset=12` retourne page 2)
- [ ] Page `/tournois` affiche les tournois avec badges tier, logos ligue, dates, prizepool
- [ ] Recherche modale (⌘K) fonctionne sur nom, ligue, jeu, region
- [ ] Page `/tournois/[id]` affiche : hero, stats, matchs, rosters, articles lies
- [ ] `TournamentCard` affiche correctement : tier (couleur), prizepool (formate), badge LIVE, compteurs
- [ ] `TournamentStats` calcule correctement : progression, repartition matchs, participation rosters
- [ ] `TeamsRosters` affiche les equipes avec logos et joueurs avec roles
- [ ] Homepage `RunningTournaments` affiche max 6 tournois en cours

## Points d'attention

1. **Tier mapping** : Liquipedia a peut-etre un systeme de tiers different (S-tier, A-tier vs Premier, Major, etc.). Le normalizer doit mapper vers s/a/b/c/d.
2. **Pagination API** : Si l'API Liquipedia ne supporte pas `limit`/`offset` natifs, il faudra paginer cote Go.
3. **Matchs enrichis** : La page detail charge les matchs enrichis via `matchService.getMatchesByIds()`. Les IDs match doivent etre compatibles avec ceux retournes par Phase 2.
4. **Expected rosters** : Liquipedia structure les rosters differemment. Le normalizer doit reconstruire `PandaRoster[]` avec `team` + `players[]`.
5. **Prizepool** : Liquipedia peut stocker le prizepool dans un format different. Le normalizer doit retourner un string lisible.
6. **Region** : Mapping des regions Liquipedia vers celles attendues (EMEA, NA, SA, etc.).
7. **Tri** : La fonction `sortByTierAndDate()` est conservee et prete a l'emploi.

## Dependances

- Phase 2 terminee (matchs fonctionnels — les IDs match doivent etre coherents)
- Documentation API Liquipedia pour les endpoints tournoi
- Cle API fonctionnelle
