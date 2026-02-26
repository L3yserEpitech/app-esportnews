# Phase 0 — Nettoyage (PandaScore + SportDevs)

> **Statut : TERMINEE**

## Objectif

Retirer tout le code PandaScore et SportDevs du backend Go et du frontend Next.js. L'application compile et demarre, mais les endpoints matchs/tournois/equipes retournent des tableaux vides `[]`.

## Ce qui a ete fait

### Backend Go — Fichiers supprimes

| Fichier | Raison |
|---------|--------|
| `backend-go/internal/services/pandascore_service.go` | Service principal PandaScore (548 lignes) — supprime entierement |

### Backend Go — Fichiers vides/stubs

| Fichier | Avant | Apres |
|---------|-------|-------|
| `backend-go/internal/models/tournament.go` | 15+ structs PandaScore (Tournament, PandaMatch, PandaTeam, League, Serie, etc.) | Commentaire stub vide |
| `backend-go/internal/models/match.go` | Struct Match + MatchFilter avec `panda_id` | Commentaire stub vide |
| `backend-go/internal/models/team.go` | Struct Team avec `panda_id` | Commentaire stub vide |
| `backend-go/internal/models/database.go` | Struct DatabaseTournament avec `panda_id` | Commentaire stub vide |

### Backend Go — Handlers remplaces par des stubs

| Fichier | Endpoints | Comportement |
|---------|-----------|-------------|
| `backend-go/internal/handlers/tournaments.go` | 7 endpoints (`/tournaments`, `/tournaments/:id`, etc.) | Retournent `[]` ou `{}` |
| `backend-go/internal/handlers/matches.go` | 6 endpoints (`/matches/running`, `/live`, etc.) | Retournent `[]` ou `{}` |
| `backend-go/internal/handlers/teams.go` | Search et GetTeam en stub ; **favoris DB conserves** (Add/Remove/GetIDs) | Search → `[]`, GetTeam → 404 |

### Backend Go — Services nettoyes

| Fichier | Changement |
|---------|-----------|
| `backend-go/internal/handlers/factory.go` | `NewTournamentHandler()` et `NewMatchHandler()` sans argument. `NewTeamHandler(authService, gormDB)` sans pandaService |
| `backend-go/internal/services/team_service.go` | `pandaService` retire. `NewTeamService(db)` sans PandaScore. `GetFavoriteTeams()` supprime (sera recree en Phase 4) |
| `backend-go/internal/services/match_service.go` | Vide — commentaire stub |
| `backend-go/internal/services/tournament_service.go` | Vide — commentaire stub |
| `backend-go/internal/cache/patterns.go` | Toutes les constantes et fonctions `PandaScore*` supprimees |
| `backend-go/internal/config/config.go` | `PandaScoreAPIKey` → `LiquipediaAPIKey` |
| `backend-go/cmd/server/main.go` | `pandaScoreService` retire. Handlers crees sans injection de service externe |

### Configuration / Infrastructure

| Fichier | Changement |
|---------|-----------|
| `backend-go/.env` | `PANDASCORE_API_KEY=...` → `LIQUIPEDIA_API_KEY=` |
| `backend-go/docker-compose.yml` | `PANDASCORE_API_KEY` → `LIQUIPEDIA_API_KEY` |
| `docker-compose.yml` (racine) | `PANDASCORE_API_KEY` + `SPORTDEVS_API_KEY` → `LIQUIPEDIA_API_KEY` |
| `docker-compose.dev.yml` | Idem |
| `docker-compose.prod.yml` | Idem |
| `nginx.conf` | CSP : `api.pandascore.co` → `api.liquipedia.net` |

### Frontend

| Fichier | Changement |
|---------|-----------|
| `frontend/next.config.ts` | `cdn.pandascore.co` retire des `remotePatterns` |
| `frontend/app/legal/cgu/page.tsx` | PandaScore + SportDevs → Liquipedia |
| `frontend/app/legal/politique-confidentialite/page.tsx` | PandaScore + SportDevs → Liquipedia |
| `frontend/app/page.tsx` | Commentaire mis a jour |
| `frontend/app/types/index.ts` | Types `Panda*` **conserves** — seront renommes quand Liquipedia est integre |

### Base de donnees

```sql
-- A executer pour reset les favoris utilisateurs (IDs PandaScore invalides)
UPDATE users SET favorite_teams = '{}';
```

## Verification

- [x] `go build ./...` compile sans erreur
- [x] `next build` compile sans erreur
- [x] Zero reference `PANDASCORE` ou `SPORTDEVS` dans le code source et la config
- [x] Endpoints matchs/tournois retournent `[]`
- [x] Endpoints auth/articles/ads/games fonctionnent normalement
