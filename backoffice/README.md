# Back-office Esport News

Application Next.js (App Router, tout en composants client derrière la connexion) prévue pour `admin.esportnews.fr`.
Elle ne parle qu'à l'API Go, sous `/api/bo` (`backend-go/internal/backoffice`).

## Lancer en local

Jamais sur la base de prod. Une base et un Redis jetables suffisent :

```bash
docker run -d --name esportnews-bo-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=esportnews_bo -p 127.0.0.1:5440:5432 postgres:16-alpine
docker run -d --name esportnews-bo-redis -p 127.0.0.1:6390:6379 redis:7-alpine
for f in backend-go/migrations/*.sql; do PGPASSWORD=postgres psql -q -h 127.0.0.1 -p 5440 -U postgres -d esportnews_bo -f "$f"; done

cd backend-go
PORT=4100 ENV=development \
  DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5440/esportnews_bo?sslmode=disable' \
  REDIS_URL='redis://127.0.0.1:6390' JWT_SECRET=dev-secret-backoffice \
  LIQUIPEDIA_POLLER_ENABLED=false NOTIFICATION_SCHEDULER_ENABLED=false \
  BACKOFFICE_URL=http://localhost:3100 go run ./cmd/server

cd backoffice
NEXT_PUBLIC_API_URL=http://localhost:4100 pnpm dev      # http://localhost:3100
```

Un compte d'équipe se crée en donnant un rôle à un compte existant :
`UPDATE users SET role = 'admin', admin = true, team_since = now() WHERE email = '…'`.

Deux serveurs de dev dans ce dossier : donner à chacun `PORT` et `BO_DIST_DIR` (ex. `BO_DIST_DIR=.next-b PORT=3101`).

## Backend (`backend-go/internal/backoffice`)

- Un fichier par domaine (`articles.go`, `users.go`, `push.go`, `health.go`, `analytics.go`, `media.go`, `ads.go`), chacun avec son `register…Routes`, appelé depuis `routes.go`. Tables et colonnes : `schema.go`, appliqué à chaque démarrage, donc **idempotent** (`IF NOT EXISTS`).
- Toute route privée passe par `requireSession` (rôle relu en base à chaque requête). Ajouter `m.require(PermXxx)` selon la matrice de `core.go`, et `m.requireSudo` sur une action lourde (suppression de compte, changement de rôle, push à tous) : le client redemande alors un code.
- `sessionOf(c)` donne le membre connecté. `fail(c, status, code, message)` pour une erreur (message en français, affiché tel quel), `m.internal(c, err)` pour un 500.
- **Toute écriture s'inscrit au journal** : `m.audit(c, action, targetType, targetID, targetLabel, detail)`. Une nouvelle action s'ajoute aussi dans `backoffice/lib/audit.ts` (libellé et couleur).
- Une source externe non configurée (variable absente) ne renvoie jamais de chiffre inventé : elle répond `{"configured": false}` et l'écran le dit.

## Frontend

- `app/globals.css` reprend les classes de la maquette (`.carte`, `.tbl`, `.kpis`, `.chip`, `.btn`, `.filtre`, `.tabs`, `.dl`, `.liste`…). Une page se lit comme sa planche : mêmes classes, mêmes libellés.
- `components/ui.tsx` : `Chip`, `Dot`, `Avatar`, `Toggle`, `Modal`, `ConfirmModal`, `Menu`, `FilterMenu`, `Tabs`, `Pager`, `CodeInput`, `Skeleton`, `Empty`, `Notice`, `useToast`. `components/Shell.tsx` : `PageHeader`.
- `lib/api.ts` : `api(path, { method, body, form })` (préfixe `/api/bo` ajouté), `fetcher` pour SWR, `download()` pour un export, `errorMessage(e)`. Un 403 `reauth_required` ouvre tout seul la demande de code puis rejoue l'appel ; ignorer l'erreur `reauth_cancelled`.
- `lib/session.tsx` : `useSession()` → `me`, `can('users.manage')`. `lib/format.ts` : nombres, dates et durées en français.
- Pas de donnée d'exemple dans le code : un écran sans donnée affiche un état vide ou « non connecté ».
