# Phase 4 — Equipes / Joueurs (donnees Liquipedia)

> **Statut : ✅ TERMINEE**
> **Pre-requis : Phase 3 terminee, doc API Liquipedia equipes/joueurs fournie**

## Objectif

Rebrancher la recherche d'equipes, le detail equipe avec joueurs, et la resolution des equipes favorites via Liquipedia. Les endpoints `/teams/search`, `/teams/:id` et `/users/favorite-teams` doivent retourner de vraies donnees.

> **RATE LIMITING** : 60 req/jeu/heure. Les equipes/joueurs sont **on-demand uniquement** (pas de polling background) car les donnees changent rarement. Cache TTL long (30 min) + stale (1h). Chaque recherche ou detail equipe consomme 1 requete du budget reserve (8 req/jeu/heure). Voir `docs/strategie-rate-limiting.md`.

## Endpoints a rebrancher

| Route | Methode | Description | Etat actuel |
|-------|---------|-------------|-------------|
| `/api/teams/search` | GET | Recherche d'equipes | Retourne `[]` |
| `/api/teams/:id` | GET | Detail d'une equipe | Retourne 404 |
| `/api/users/favorite-teams` | GET | Equipes favorites avec details | Retourne juste les IDs |
| `/api/users/favorite-teams/ids` | GET | IDs des equipes favorites | Fonctionne (DB) |
| `/api/users/favorite-teams/:teamId` | POST | Ajouter une equipe favorite | Fonctionne (DB) |
| `/api/users/favorite-teams/:teamId` | DELETE | Retirer une equipe favorite | Fonctionne (DB) |

**Parametres supportes :**
- `query` ou `q` (search) : terme de recherche
- `pageSize` (search) : nombre de resultats

## Backend — Fichiers a modifier

### 1. `backend-go/internal/models/liquipedia.go` — Ajouter les structs equipe/joueur

```go
type LiqTeam struct {
    // Champs Liquipedia natifs (a definir avec la doc)
    // ...
}

type LiqPlayer struct {
    // Champs Liquipedia natifs
    // ...
}
```

**Normalisation** :
- `normalizeLiqTeamToTeam(liqTeam) Team` → format compatible frontend `teamService.ts`
- `normalizeLiqTeamToPandaTeam(liqTeam) PandaTeam` → format compatible composants (`TournamentCard`, `LiveMatchCard`)

**Champs critiques que le frontend attend (teamService.ts) :**

| Champ frontend (Team) | Description | Utilise par |
|------------------------|-------------|-------------|
| `id` | Identifiant unique | Navigation, favoris |
| `name` | Nom de l'equipe | FavoriteTeamsSection, TeamSearchResult |
| `location` | Pays/region | TeamSearchResult |
| `slug` | Slug URL | |
| `acronym` | Sigle (ex: "FNC", "T1") | Badge |
| `image_url` | Logo equipe | Image (avec fallback initiales) |
| `dark_mode_image_url` | Logo dark mode (optionnel) | |
| `modified_at` | Derniere MAJ | TeamSearchResult ("Last update") |
| `current_videogame.id` | ID jeu | |
| `current_videogame.name` | Nom jeu | |
| `current_videogame.slug` | Slug jeu | |
| `players[]` | Liste des joueurs | Roster expandable |

**Champs joueur attendus :**

| Champ frontend (Player) | Description | Utilise par |
|--------------------------|-------------|-------------|
| `id` | Identifiant unique | |
| `name` | Pseudo | TeamsRosters, TeamSearchResult |
| `role` | Role (mid, adc, support, etc.) | Couleur role, hover overlay |
| `image_url` | Photo joueur | Image (avec fallback initiales) |
| `active` | Joueur actif | Compteur actifs |
| `first_name` | Prenom | TeamSearchResult |
| `last_name` | Nom de famille | TeamSearchResult |
| `nationality` | Nationalite | TeamSearchResult |
| `age` | Age | TeamSearchResult (optionnel) |
| `slug` | Slug | |
| `birthday` | Date de naissance | Calcul age |

### 2. `backend-go/internal/services/liquipedia_service.go` — Ajouter les methodes equipe

| Methode | Endpoint Liquipedia | Filtres |
|---------|-------------------|---------|
| `SearchTeams(ctx, query, pageSize)` | TBD avec doc | Recherche par nom |
| `GetTeamById(ctx, id)` | TBD avec doc | Par ID |
| `GetTeamsByIds(ctx, ids)` | TBD avec doc | Batch par IDs (pour favoris) |

Chaque methode :
1. Appelle `makeRequest()` avec les bons parametres
2. Parse la reponse dans `[]LiqTeam`
3. Normalise en format frontend compatible
4. Retourne le resultat

### 3. `backend-go/internal/handlers/teams.go` — Rebrancher les handlers

La struct `TeamHandler` recoit un champ `liquipediaService *services.LiquipediaService` en plus de `authService` et `gormDB`.

**Handlers a modifier :**

| Handler | Avant | Apres |
|---------|-------|-------|
| `SearchTeams` | Retourne `[]` | Appelle `liquipediaService.SearchTeams()` |
| `GetTeam` | Retourne 404 | Appelle `liquipediaService.GetTeamById()` |
| `GetFavoriteTeams` | Retourne juste les IDs | Lit IDs depuis DB + resout les details via `liquipediaService.GetTeamsByIds()` |
| `GetFavoriteTeamIDs` | Fonctionne | Pas de changement |
| `AddFavoriteTeam` | Fonctionne (DB) | Pas de changement |
| `RemoveFavoriteTeam` | Fonctionne (DB) | Pas de changement |

### 4. `backend-go/internal/handlers/factory.go`

```go
func NewTeamHandler(liquipediaService *services.LiquipediaService, authService *services.AuthService, gormDB interface{}) *TeamHandler {
    return &TeamHandler{
        liquipediaService: liquipediaService,
        authService:       authService,
        gormDB:            gormDB,
    }
}
```

### 5. `backend-go/cmd/server/main.go`

```go
teamHandler := handlers.NewTeamHandler(liquipediaService, authService, gormDB)
```

### 6. Question IDs : int64 vs string

**Point critique** : Liquipedia utilise probablement des identifiants differents de PandaScore.

| Scenario | Impact |
|----------|--------|
| IDs Liquipedia sont des **entiers** | Aucun changement DB/frontend. Le normalizer mappe directement. |
| IDs Liquipedia sont des **strings** | Il faut changer `favorite_teams` de `Int64Array` a `StringArray` dans le modele User + migration DB |

**Si migration necessaire :**

```sql
-- Migration : int[] → text[]
ALTER TABLE public.user ALTER COLUMN favorite_teams TYPE text[] USING favorite_teams::text[];
```

Et modifier :
- `backend-go/internal/models/user.go` : `FavoriteTeams []int64` → `FavoriteTeams []string`
- `frontend/app/services/teamService.ts` : adapter le type des IDs si necessaire
- `frontend/app/components/profile/sections/FavoriteTeamsSection.tsx` : adapter les comparaisons d'IDs

## Frontend — Fichiers a verifier/modifier

### 7. `frontend/app/services/teamService.ts`

**Si les IDs changent de type (int → string)** : adapter les types dans le service.

Les endpoints appeles ne changent pas :
- `GET /api/teams/search?query=...&pageSize=...`
- `GET /api/teams/:id`
- `GET /api/users/favorite-teams`
- `GET /api/users/favorite-teams/ids`
- `POST /api/users/favorite-teams/:teamId`
- `DELETE /api/users/favorite-teams/:teamId`

### 8. Composants a verifier

| Composant | Ce qu'il utilise | Verifier |
|-----------|-----------------|---------|
| `frontend/app/components/profile/sections/FavoriteTeamsSection.tsx` | `teamService.searchTeams()`, `teamService.getFavoriteTeams()`, add/remove | Recherche, ajout/suppression favoris (max 3), affichage equipes |
| `frontend/app/components/profile/TeamSearchResult.tsx` | `Team` (id, name, location, acronym, image_url, players[], modified_at) | Carte equipe expandable avec roster |
| `frontend/app/components/tournaments/TeamsRosters.tsx` | `PandaRoster[]` (team + players[]) | Grille equipes dans page tournoi (roles, couleurs) |
| `frontend/app/components/matches/LiveMatchCard.tsx` | `opponents[].opponent.image_url`, `opponents[].opponent.name` | Logos equipes dans cartes match |
| `frontend/app/components/matches/PandaMatchCard.tsx` | `opponents[].opponent` (PandaTeam) | Variante carte match |

### 9. Images equipes

Les URLs d'images Liquipedia sont differentes de PandaScore. Verifier :
- `frontend/next.config.ts` : domaine images Liquipedia deja ajoute (Phase 2)
- Les composants utilisent `<Image>` Next.js avec fallback sur initiales si image absente
- Tester le chargement des logos via `next/image`

## Verification

- [ ] `GET /api/teams/search?query=fnatic` retourne des equipes avec joueurs
- [ ] `GET /api/teams/:id` retourne le detail complet d'une equipe
- [ ] `GET /api/users/favorite-teams` (avec JWT) retourne les equipes favorites avec noms, logos, joueurs
- [ ] Ajout/suppression favoris fonctionne toujours (max 3)
- [ ] Page profil : recherche equipe affiche des resultats
- [ ] Page profil : equipes favorites affichees avec logos et noms
- [ ] `TeamSearchResult` : carte expandable montre les joueurs avec roles et nationalite
- [ ] `TeamsRosters` dans page tournoi : equipes et joueurs s'affichent correctement
- [ ] `LiveMatchCard` : logos equipes s'affichent (URLs Liquipedia)
- [ ] Logos equipes chargent via `next/image` sans erreur CORS

## Points d'attention

1. **IDs** : Decision critique — si Liquipedia utilise des strings, migration DB necessaire. A confirmer avec la doc.
2. **Joueurs** : Liquipedia a beaucoup plus de donnees joueurs (historique, earnings, etc.). Ne prendre que ce qui est utilise.
3. **Recherche** : L'API Liquipedia peut ne pas supporter la recherche textuelle directement. Alternative : fetch + filtre cote Go.
4. **Batch fetch** : `GetTeamsByIds()` pour les favoris. Si l'API ne supporte pas le batch, faire des appels paralleles avec goroutines.
5. **Roles joueurs** : Liquipedia utilise des noms de roles differents (peut-etre "Carry" au lieu de "adc"). Le normalizer doit mapper.
6. **Images** : Certaines equipes/joueurs n'ont pas d'image sur Liquipedia. Les composants gerent deja les fallbacks (initiales).
7. **Max 3 favoris** : La logique est preservee dans `AddFavoriteTeam()` — pas de changement.

## Dependances

- Phase 3 terminee (les equipes apparaissent deja dans les tournois)
- Documentation API Liquipedia pour les endpoints equipe/joueur
- Cle API fonctionnelle
- Decision sur le type des IDs (int vs string)
