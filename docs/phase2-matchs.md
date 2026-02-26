# Phase 2 — Matchs (donnees Liquipedia)

> **Statut : A FAIRE**
> **Pre-requis : Phase 1 terminee, doc API Liquipedia matchs fournie**

## Objectif

Remplacer les stubs match (qui retournent `[]`) par de vraies donnees provenant de l'API Liquipedia v3. Le frontend doit afficher les matchs sans changement majeur grace a la normalisation backend.

> **RATE LIMITING** : 60 req/jeu/heure. Les matchs running/upcoming/past sont pre-fetches par le **poller background** (Phase 1). Les handlers lisent depuis Redis. Seul `/matches/:id` utilise le cache-aside on-demand (budget reserve). Voir `docs/strategie-rate-limiting.md`.

## Endpoints a rebrancher

| Route | Methode | Description | Etat actuel |
|-------|---------|-------------|-------------|
| `/api/matches/running` | GET | Matchs en cours (live) | Retourne `[]` |
| `/api/matches/upcoming` | GET | Matchs a venir | Retourne `[]` |
| `/api/matches/past` | GET | Matchs termines | Retourne `[]` |
| `/api/matches/:id` | GET | Detail d'un match | Retourne `{}` |
| `/api/matches/by-date` | POST | Matchs par date | Retourne `[]` |
| `/api/live` | GET | Alias de `/matches/running` | Retourne `[]` |

**Parametres supportes :**
- `game` (query) : acronyme du jeu pour filtrer
- `date` (form body, YYYY-MM-DD) : pour `/by-date`

## Backend — Fichiers a modifier

### 1. `backend-go/internal/models/liquipedia.go` — Ajouter les structs match

Les structs exactes dependent de la doc API Liquipedia, mais voici la structure attendue :

```go
type LiqMatch struct {
    // Champs Liquipedia natifs (a definir avec la doc)
    // ...
}
```

**Normalisation** : Une fonction `normalizeLiqMatchToPandaMatch(liqMatch) PandaMatch` transformera les donnees Liquipedia en un format compatible avec le frontend existant.

**Champs critiques que le frontend attend :**

| Champ frontend (PandaMatch) | Description | Utilise par |
|------------------------------|-------------|-------------|
| `id` | Identifiant unique du match | URLs, navigation |
| `name` | Nom du match (ex: "Team A vs Team B") | LiveMatchCard, MatchDetail |
| `status` | `running`, `not_started`, `finished` | Badges statut, filtrage |
| `begin_at` | Date/heure de debut ISO 8601 | Affichage date, tri |
| `end_at` | Date/heure de fin | Duree |
| `match_type` | `best_of` | Affichage BO |
| `number_of_games` | Nombre de games (BO3, BO5) | Affichage "BO3" |
| `opponents[].opponent.id` | ID equipe | Navigation |
| `opponents[].opponent.name` | Nom equipe | LiveMatchCard |
| `opponents[].opponent.image_url` | Logo equipe | Images |
| `opponents[].opponent.acronym` | Sigle equipe | Badge |
| `results[].team_id` | ID equipe | Lien score ↔ equipe |
| `results[].score` | Score | Affichage score |
| `tournament.id` | ID tournoi | Navigation |
| `tournament.name` | Nom tournoi | En-tete match |
| `league.name` | Nom ligue | En-tete match |
| `league.image_url` | Logo ligue | Image |
| `videogame.name` | Nom du jeu | Filtrage, badge |
| `videogame.slug` | Slug du jeu | Filtrage |
| `streams_list[].raw_url` | URL du stream | Lien stream |
| `streams_list[].language` | Langue du stream | Filtrage |
| `streams_list[].main` | Stream principal | Selection auto |
| `games[]` | Sub-matchs/maps | Detail match |
| `live.supported` | Live disponible | Indicateur |
| `live.url` | URL live | Lien |
| `winner_id` | ID equipe gagnante | Badge gagnant |

### 2. `backend-go/internal/services/liquipedia_service.go` — Ajouter les methodes match

| Methode | Endpoint Liquipedia | Filtres |
|---------|-------------------|---------|
| `GetRunningMatches(ctx, gameAcronym)` | TBD avec doc | Status = en cours |
| `GetUpcomingMatches(ctx, gameAcronym)` | TBD avec doc | Status = a venir |
| `GetPastMatches(ctx, gameAcronym)` | TBD avec doc | Status = termine |
| `GetMatchById(ctx, id)` | TBD avec doc | Par ID |
| `GetMatchesByDate(ctx, date, game)` | TBD avec doc | Par date + jeu optionnel |

**Mode de fonctionnement par endpoint :**

| Endpoint handler | Source de donnees | Mode |
|-----------------|-------------------|------|
| `GetRunningMatches` | Redis (pre-fetche par poller toutes les 2 min) | Lecture Redis uniquement |
| `GetUpcomingMatches` | Redis (pre-fetche par poller toutes les 10 min) | Lecture Redis uniquement |
| `GetPastMatches` | Redis (pre-fetche par poller toutes les 15 min) | Lecture Redis uniquement |
| `GetMatchById` | Cache-aside on-demand (budget reserve) | Appel API si cache miss |
| `GetMatchesByDate` | Cache-aside on-demand (budget reserve) | Appel API si cache miss |

Chaque methode du service :
1. **Poller** : Appelle `makeRequest()`, parse en `[]LiqMatch`, normalise en `[]PandaMatch`, stocke en Redis
2. **Handlers** : Lisent depuis Redis et retournent directement. Pour les endpoints on-demand, appelle `makeRequest()` avec verification budget.

### 3. `backend-go/internal/handlers/matches.go` — Rebrancher les handlers

La struct `MatchHandler` recoit un champ `liquipediaService *services.LiquipediaService`.

Chaque handler appelle la methode correspondante du service et retourne le resultat JSON.

### 4. `backend-go/internal/handlers/factory.go`

```go
func NewMatchHandler(liquipediaService *services.LiquipediaService) *MatchHandler {
    return &MatchHandler{
        liquipediaService: liquipediaService,
    }
}
```

### 5. `backend-go/cmd/server/main.go`

```go
matchHandler := handlers.NewMatchHandler(liquipediaService)
```

## Frontend — Fichiers a verifier/modifier

### 6. `frontend/app/types/index.ts`

Les types `PandaMatch`, `PandaOpponent`, `PandaStream`, etc. sont deja definis. Si la normalisation backend est correcte, **aucun changement necessaire**.

Si des champs manquent ou different, adapter les types a ce stade.

### 7. `frontend/next.config.ts`

Ajouter le domaine d'images Liquipedia dans `remotePatterns` :

```typescript
{
  protocol: 'https',
  hostname: 'liquipedia.net',
  port: '',
  pathname: '/**',
},
```

> Le hostname exact depend de l'endroit ou Liquipedia heberge ses images (wiki, CDN, etc.)

### 8. Composants a verifier (pas de modification si normalisation OK)

| Composant | Ce qu'il utilise | Verifier |
|-----------|-----------------|---------|
| `frontend/app/components/matches/LiveMatchCard.tsx` | `opponents[].opponent.name/image_url`, `results[].score`, `status`, `tournament.name`, `number_of_games` | Affichage equipes, scores, badges |
| `frontend/app/match/MatchPageClient.tsx` | `matchService.getMatchesByDate()`, filtrage par jeu, regroupement par game | Calendrier + liste matchs |
| `frontend/app/match/[id]/MatchDetailPageClient.tsx` | `matchService.getMatchById()`, streams, games/maps | Detail complet |
| `frontend/app/components/matches/LiveMatchesCarousel.tsx` | Matchs running sur la homepage | Carousel live |
| `frontend/app/components/matches/PandaMatchCard.tsx` | Variante de carte match | Affichage |
| `frontend/app/components/matches/LiveMatchItem.tsx` | Item individuel | Affichage |

### 9. Services frontend (pas de modification)

| Service | Endpoints appeles | Changement |
|---------|------------------|-----------|
| `frontend/app/services/matchService.ts` | `/api/matches/running`, `/upcoming`, `/past`, `/by-date`, `/:id` | Aucun — les URLs ne changent pas |

## Strategie de normalisation

```
Liquipedia API v3          Backend Go (normalizer)         Frontend (inchange)
─────────────────    →    ─────────────────────────    →    ──────────────────
LiqMatch struct           PandaMatch-shaped JSON            PandaMatch interface
(format Liquipedia)       (meme shape que avant)            (types existants)
```

**Le normalizer est une fonction Go** dans `liquipedia_service.go` ou un fichier dedie `normalizers.go` qui :
- Map les champs Liquipedia vers les champs PandaMatch
- Reconstruit les `opponents[]` au format attendu
- Reconstruit les `results[]` au format attendu
- Gere les champs manquants avec des valeurs par defaut

## Verification

- [ ] `GET /api/matches/running` retourne des matchs reels depuis Liquipedia
- [ ] `GET /api/matches/running?game=valorant` retourne des matchs filtres par jeu
- [ ] `GET /api/matches/upcoming` retourne des matchs a venir
- [ ] `GET /api/matches/past` retourne des matchs termines
- [ ] `GET /api/matches/:id` retourne le detail d'un match
- [ ] `POST /api/matches/by-date` avec `date=YYYY-MM-DD` retourne les matchs du jour
- [ ] `POST /api/matches/by-date` avec `date=YYYY-MM-DD&game=lol` filtre par jeu
- [ ] Page `/match` affiche les matchs avec equipes, logos, scores
- [ ] Page `/match/[id]` affiche les details complets (streams, maps/games)
- [ ] Homepage carousel (`LiveMatchesCarousel`) affiche les matchs en cours
- [ ] `LiveMatchCard` affiche correctement : noms equipes, logos, scores, badges statut, BO

## Points d'attention

1. **IDs** : Liquipedia utilise peut-etre des identifiants differents (strings vs int). Le normalizer doit gerer ca.
2. **Images equipes** : Les URLs d'images de Liquipedia sont differentes de PandaScore. Verifier que `next/image` peut les charger.
3. **Streams** : Liquipedia stocke les streams differemment. Le normalizer doit reconstruire la structure `streams_list[]`.
4. **Statuts** : Les statuts Liquipedia (`ongoing`, `completed`, etc.) different peut-etre de PandaScore (`running`, `finished`). Le normalizer doit mapper.
5. **Jeux bannis** : Le frontend filtre certains jeux (Mobile Legends, StarCraft 2). Verifier que le filtre fonctionne toujours.

## Dependances

- Phase 1 terminee (LiquipediaService operationnel)
- Documentation API Liquipedia pour les endpoints match
- Cle API fonctionnelle
