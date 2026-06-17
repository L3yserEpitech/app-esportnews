# CLAUDE.md — Maquette (squelette)

> Ce document sert de source unique de vérité pour cadrer le produit, la DA, la structure du site et les exigences techniques. Il doit rester court par section, mais exhaustif par les rubriques.

---

## 1) Vision & Contexte

* **Pitch (1 phrase)** : Plateforme e-sport mettant en avant les matchs **en direct** (multi-jeux) + actualités, avec monétisation par bannières publicitaires (gérées en interne, sans tracking tiers) et SEO solide sur les contenus éditoriaux.
* **Problème utilisateur** : Difficile de trouver rapidement les matchs live pertinents et les actus fiables par jeu.
* **Valeur clé / différenciation** : Focus **live-only** agrégé (SportDevs), tournois/équipes/matchs structurés (PandaScore), UX rapide par **jeu** et calendrier simple.
* **Mesure du succès (KPI)** : CTR jeux en home, temps sur « Direct », clics pubs, impressions bannières publicitaires, conversions abonnement (no-popup-ads mobile), pages vues News/Articles, retour visiteurs.
* **Contraintes business** : Pas de back-office à développer (déjà existant). Pas de conservation de données côté app. Pas de limite API contractuelle.
* **Infrastructure** : Migration de Vercel/Supabase vers déploiement local (PostgreSQL + Redis + Go backend en Docker Compose).
* **Backend** : Backend Go en cours de finalisation dans `/backend-go` (remplace ancien Node.js `/backend/api`)

### Décisions actées (20/09/2025)

* **Jeux au lancement** : Valorant, FIFA, Wild Rift, Dota, Overwatch, Call of Duty, League of Legends, Rainbow Six Siege, Rocket League, CS2.
* **Cibles** : Visuellement s’adresser aux **fans** ; **panneau publicitaire** pensé pour les joueurs.
* **Périmètre** : Pas de MVP — développement **complet** de l’app dès V1. Back-office **déjà fait**.
* **Sources de données** :

  * **SportDevs** → *uniquement* flux **en direct** + **news**.
  * **PandaScore** → tournois, équipes, matchs (hors live) et structure compétitions.
* **Données** : Aucune **conservation** locale (no persistence au-delà du cache volatile).
* **API** : Aucune limite de requêtes imposée.
* **Qualité des données** : Gestion des incohérences/doublons **plus tard** (hors V1).
* **Navigation** : Liens de diffusion **ouvrent dans un nouvel onglet**.
* **Monétisation** :
  * **Bannières publicitaires gérées en interne** (sans régies externes type Google AdSense / Meta Ads)
  * **Desktop** : 3 emplacements pub dans une colonne droite pleine hauteur (visibles pour tous utilisateurs, y compris abonnés)
  * **Mobile** : Aucun popup publicitaire pour les **abonnés Premium**. Popups autorisés uniquement pour les utilisateurs gratuits.
  * **Données** : Aucun cookie publicitaire tiers, aucun tracking comportemental. Affichage simple d'images/vidéos fournies par les partenaires commerciaux.
* **SEO** : H1/H2 optimisés ; articles avec **mots-clés** injectés automatiquement depuis la base de données.

## 5) Design & Direction Artistique (DA)

* **Intent** : priorité **fans** (lisibilité live, hiérarchie forte par jeu), codes visuels e-sport.
* **Design System** : tokens couleurs, typo, composants (Button, Card, Tabs jeux, Banner pub, LiveMatchItem).
* **Responsive** : Desktop sans bascule prématurée vers layout tablet quand on réduit la fenêtre.
* **Accessibilité** : WCAG 2.1 AA, focus visible, contraste OK.
* **Palette De Couleur** :#060B13, #091626, #182859, #F22E62

## 6) Contenus & SEO

* **SEO** : H1/H2/H3, meta Title/Description, OpenGraph. **Articles** : mots-clés auto depuis DB, champs éditoriaux existants via BO.
* **URLs** : slugs par jeu/compétition/article ; canonical sur listings avec filtres.
* **News** : une principale + liste ; règles d’épinglage via BO existant.
* **Charte éditoriale** : voix, tutoiement/vouvoiement, terminologie bannie/autorisé.
* **Modèle de page SEO** : Title (≤60), Meta description (≤155), H1–H3, schémas.
* **Stratégie mots-clés** : primaire / secondaires, intention.
* **Règles URL** : kebab-case, i18n, redirections (301/302), canonical.

## 2bis) Infrastructure & Déploiement

* **Stack infrastructure** :
  - **Backend** : Go 1.22 + Echo framework (remplace Node.js)
  - **Database** : PostgreSQL 15 (local, via Docker)
  - **ORM** : GORM pour toutes les opérations utilisateur (authentification, préférences, équipes favorites)
  - **Cache** : Redis 7 (live data + sessions)
  - **Frontend** : Next.js 15 (Node.js + Turbopack)
  - **Orchestration** : Docker Compose (3 conteneurs : postgres, redis, backend-go)

* **Architecture de synchronisation** :
  - Backend Go polling **PandaScore toutes les 5 minutes**
  - Insertion/update automatique des tournaments et matches
  - Déduplication via `panda_id` unique
  - Aucun stockage persistant de données **SportDevs** (cache Redis seulement)

* **Données persistantes vs volatiles** :
  - **Persistantes** : users, articles, ads (édités via back-office)
  - **Volatiles/Sync'd** : tournaments, matches, games_pandascore (PandaScore)
  - **Cache Redis** : live data (30 sec TTL), sessions utilisateur

* **Base de données - Table utilisateurs** :
  - **Table GORM** : `public.user` (source unique de vérité pour les utilisateurs)
  - **Accès** : Tous les handlers (NotificationHandler, TeamHandler, AuthHandler) utilisent GORM pour lire/écrire les données utilisateurs
  - **NOTE** : ❌ **DEPRECATED** - La table `public.users` (pgxpool) n'est plus utilisée. Tous les accès utilisateurs passent par GORM sur `public.user`
  - **Colonnes clés** : id, email, password, avatar, admin, age, favorite_teams (BIGINT[]), notifi_push, notif_articles, notif_news, notif_matchs

## 3bis) API Endpoints — Documentation Complète

### **Tournois (Tournaments)**

| Endpoint | Méthode | Description | Paramètres |
|----------|---------|-------------|-----------|
| `/api/tournaments` | GET | Tournois en cours (running) | `limit`, `offset`, `sort`, `game` |
| `/api/tournaments/all` | GET | Tous les tournois en cours | `sort` |
| `/api/tournaments/upcoming` | GET | Tournois à venir (upcoming) | `limit`, `offset`, `sort` |
| `/api/tournaments/finished` | GET | Tournois terminés (past) | `limit`, `offset`, `sort` |
| `/api/tournaments/by-date` | POST | Tournois à une date précise | `date` (form), `game` (form, optionnel) |
| `/api/tournaments/:id` | GET | Détails d'un tournoi | `id` (path) |
| `/api/tournaments/filtered` | GET | Tournois avec filtres | `game`, `status`, `filter[tier]` |

**Paramètres de query disponibles** :
- `limit` : nombre de résultats par page (défaut: 20)
- `offset` : décalage de pagination (défaut: 0)
- `sort` : critère de tri (valeurs: `tier`, `-tier`, `begin_at`, `-begin_at`)
- `game` : acronyme du jeu pour filtrer (ex: `valorant`, `lol`, `cs2`)
- `status` : statut du tournoi (`running`, `upcoming`, `finished`)
- `filter[tier]` : rang du tournoi (`s`, `a`, `b`, `c`, `d`)

**Statuts supportés** :
- `running` → PandaScore: `/running`
- `upcoming` → PandaScore: `/upcoming`
- `finished` → PandaScore: `/past` (mappé automatiquement)

### **Matchs (Matches)**

| Endpoint | Méthode | Description | Paramètres |
|----------|---------|-------------|-----------|
| `/api/matches/by-date` | POST | Matchs à une date précise | `date` (form YYYY-MM-DD), `game` (form, optionnel) |
| `/api/matches/:id` | GET | Détails d'un match | `id` (path) |
| `/api/matches/running` | GET | Matchs en cours (live) | `game` (query, optionnel) |
| `/api/matches/upcoming` | GET | Matchs à venir | `game` (query, optionnel) |
| `/api/matches/past` | GET | Matchs terminés | `game` (query, optionnel) |

**Note importante** :
- L'endpoint `/api/matches/by-date` utilise `Content-Type: application/x-www-form-urlencoded`
- Frontend : Utiliser `URLSearchParams` (pas `FormData`) pour construire le body

### **Autres Endpoints**

| Endpoint | Méthode | Description | Paramètres |
|----------|---------|-------------|-----------|
| `/api/games` | GET | Liste des jeux supportés | - |
| `/api/articles` | GET | Articles éditoriaux | `limit`, `offset`, `category` |
| `/api/ads` | GET | Publicités actives | - |
| `/api/live` | GET | Matchs en direct (SportDevs) | - |

**Exemple de requête avec paramètres** :
```
GET /api/tournaments?limit=12&offset=0&sort=tier&game=valorant
GET /api/tournaments/upcoming?limit=20&offset=0&sort=-begin_at
POST /api/tournaments/by-date (body: date=2025-11-19&game=lol)
```

## 7) Technique — Stack & Architecture

* **Données & APIs** :

  * **SportDevs** (live-only + news) → lecture en temps réel (polling court ou webhooks si dispo). Aucun stockage persistant ; **cache Redis** uniquement.
  * **PandaScore** (tournois/équipes/matchs structurels) → sync toutes les 5 min par backend Go, stockage en DB avec `panda_id` comme clé de déduplication.
* **Stratégie data** : Base de données PostgreSQL pour persistance (users, articles, ads) + auto-sync PandaScore. Aucun stockage SportDevs. Prévoir **adapters** + **normalizers** post-V1 pour nettoyage.
* **Infra** : Docker local (dev/prod identique) + CDN + edge cache pour assets ; SSR/ISR pour pages éditoriales (SEO), live en CSR.
* **Interop** : liens de diffusion ouverts en **new tab**.

## 8) Base de Données — Architecture Détaillée

* **7 tables principales** :

  1. **users** - Comptes utilisateurs + préférences
     - Persistant | Édité par : authentification frontend + back-office
     - Cols clés : id, email (unique), avatar, favorite_teams[], notif_* (push/articles/news/matchs)

  2. **games** - Référence des 10 jeux supportés
     - Persistant | Édité par : back-office
     - Cols clés : id, name, acronym, selected_image, unselected_image

  3. **articles** - Contenu éditorial
     - Persistant | Édité par : back-office + CMS
     - Cols clés : id, slug (unique), title, content, category, tags[], featuredImage, videoUrl, credit
     - Support vidéo : youtube/vimeo/mp4
     - Credit : attribution source (ex. © VCT EMEA, © Studio X, etc.)

  4. **ads** - Bannières publicitaires gérées en interne
     - Persistant | Édité par : back-office
     - Cols clés : id, title, position (max 3), url, redirect_link, type

  5. **tournaments** - Tournois PandaScore
     - Synced (5 min polling) | Source : PandaScore API
     - Clé déduplication : **panda_id** (unique)
     - Cols clés : id, panda_id, name, slug, status, begin_at/end_at, tier, prizepool, raw_data (JSONB)

  6. **matches** - Matchs de tournois PandaScore
     - Synced (5 min polling) | Source : PandaScore API
     - Clé déduplication : **panda_id** (unique)
     - FK : tournament_id → tournaments(id)
     - Cols clés : id, panda_id, name, status, begin_at, end_at, live_supported, live_url, raw_data (JSONB)

  7. **games_pandascore** - Sous-matchs individuels (map/game)
     - Synced (5 min polling) | Source : PandaScore API
     - Clé déduplication : **panda_id** (unique)
     - FK : match_id → matches(id)
     - Cols clés : id, panda_id, position, status, begin_at/end_at, winner_id, raw_data (JSONB)

* **Indexes pour perf** :
  - users(email), articles(slug), tournaments(panda_id, videogame_id, status)
  - matches(panda_id, tournament_id, begin_at), games_pandascore(panda_id, match_id)

* **Politique de données** :
  - **Persistance** : users, articles, ads (jamais supprimés, soft-delete si besoin)
  - **Sync** : tournaments, matches, games_pandascore (re-sync complète à chaque polling, upsert via panda_id)
  - **Cache** : live data dans Redis (TTL 30s)
  - **Aucun tracking tiers** : pas de cookies de régies publicitaires

## 9) Migration Supabase → Local

* **Données à exporter de Supabase** :
  - Export complet `.sql` des 7 tables
  - Exports séparés par table (plus facile à vérifier)
  - Vérifier intégrité des foreign keys après import

* **Procédure de migration** :
  1. Dump complet Supabase : `pg_dump -U postgres supabase_db > backup.sql`
  2. Nettoyer le dump : supprimer les extensions Supabase spécifiques (postgrest, jwt, etc.)
  3. Importer en local : `psql -U postgres -d esportnews < backup.sql`
  4. Vérifier FK et indexes : `\d+` dans psql
  5. Valider : compter les lignes par table (users, articles, ads)

* **Points d'attention** :
  - URLs images (articles.featuredImage, ads.url) doivent rester accessibles
  - Métadonnées Supabase (created_at, updated_at) seront préservées
  - Contrevérifier les contraintes UNIQUE après import (id, email, slug, panda_id)
  - **Tournois/matchs ne se migrent PAS** : re-synced à chaque démarrage du backend Go

## 9.1) Seeding Articles — Procédure

* **Source de données** :
  - JSON export depuis Supabase : `/backend-go/initial_data/articles_rows.json`
  - Format : Array de 47 objets Article avec tous les champs (title, content, tags[], etc.)
  - Dépourvu de migrations SQL volumineux (idéal pour 40+ articles)

* **Script de seeding** :
  - Binaire Go : `./seed` (compilé automatiquement par Docker)
  - Logique : `internal/seed/articles.go` + `cmd/seed/main.go`
  - Gère les doublons via `ON CONFLICT (slug) DO NOTHING`

* **Procédure d'import** :
  1. S'assurer que Docker Compose est up : `docker-compose ps`
  2. Lancer le seeding :
     ```bash
     docker-compose exec -T backend ./seed --data=initial_data/articles_rows.json
     ```
  3. Vérifier le résultat (logs affichent nombre inséré + total en DB)
  4. Le script est **idempotent** : peut être re-exécuté sans créer de doublons

* **Flags disponibles** :
  - `--data=<path>` : chemin vers le fichier JSON (défaut: `initial_data/articles_rows.json`)
  - `--dry-run` : teste sans insérer (valide JSON + structure)
  - `-v` : verbose output (GORM debug logs)

* **Vérification** :
  ```sql
  -- Compter articles en BD
  SELECT COUNT(*) FROM articles;

  -- Vérifier un article par slug
  SELECT slug, title, author, array_length(tags, 1) as tag_count
  FROM articles WHERE slug = '<article-slug>';
  ```

## 9bis) Données & Contrats

* **Modèle logique** : Game → Tournament → Match → SubMatch (game_pandascore) → Live streams
  - News (source SportDevs) → Article cache
  - Article (via BO) → DB persistant
* **Politiques** :
  - **users, articles, ads** : rétention permanente (soft-delete si besoin)
  - **tournaments, matches, games_pandascore** : aucune rétention (re-sync à chaque cycle)
  - Pas de sauvegardes de données SportDevs en DB. Seuls logs techniques non-PII.
* **RGPD** : abonnement géré côté BO/processor ; bannières publicitaires internes sans tracking tiers (pas de consentement requis pour l'affichage simple).
* **Contrats d'API** : wrappers typed (Go structs), timeouts/retries (5 min polling), circuit-breaker Redis.

## 10) Observabilité & Qualité Produit (Backend)

* **Metrics** : Web Vitals (LCP<2.5s, CLS<0.1), temps de réponse APIs tierces, taux d’erreur fetch.
* **Alerting** : flux live down, dépassement temps réponse, anomalies volume.
* **Feature flags** : **no-popup-ads-mobile** pour abonnés (bannières desktop restent visibles pour tous).
* **Logs** : structure JSON, corrélation traceId, pas de PII en clair.
* **Metrics** : RED/USE pour backend, Web Vitals pour frontend.
* **Alerting** : seuils, canaux, astreintes.
* **Feature flags** : rollout progressif, kill switch.

## 11) Analytics & Expérimentation

* **Plan de marquage (exemples)** : select\_game, view\_live\_list, open\_stream, click\_ad, view\_news, read\_article, subscribe\_noads.
* **Consentement** : déclenchement selon CMP.

## 12) Notes de Transition & Dépréciations

* **DEPRECATED** :
  - ❌ Backend Node.js (`/backend/api`) - remplacé par Go backend
  - ❌ Supabase hosted - migré vers PostgreSQL local
  - ❌ Vercel deployment - infrastructure locale Docker

* **En cours** :
  - 🔄 Backend Go (`/backend-go`) - finalisation des endpoints + gestion erreurs

* **Complétés** :
  - ✅ Migration données Supabase (users, articles, ads)
  - ✅ Seeding articles (47 articles importés via script Go + JSON)

---

### Schéma Database (Référence complète)

create table public.users (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  name text not null,
  email text not null,
  password text not null,
  avatar text null,
  admin boolean not null default false,
  favorite_teams integer[] null,
  notifi_push boolean null default false,
  notif_articles boolean null default false,
  notif_news boolean null default false,
  notif_matchs boolean null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_id_key unique (id)
) TABLESPACE pg_default;

create table public.games (
  id bigint generated by default as identity not null,
  created_at time without time zone not null default now(),
  name text null,
  selected_image text null,
  unselected_image text null,
  acronym text null,
  full_name text null,
  constraint games_pkey primary key (id),
  constraint games_id_key unique (id)
) TABLESPACE pg_default;

create table public.articles (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  slug text null,
  tags text[] null,
  title text null,
  views integer null default 0,
  author text null,
  content text null,
  category text null,
  subtitle text null,
  description text null,
  content_black text null,
  content_white text null,
  "featuredImage" text null,
  credit text null,
  constraint articles_pkey primary key (id),
  constraint articles_id_key unique (id)
) TABLESPACE pg_default;

create table public.ads (
  id bigint generated by default as identity not null,
  created_at time without time zone not null default now(),
  title text null,
  position smallint null,
  type text null,
  url text null,
  redirect_link text null,
  constraint ads_pkey primary key (id),
  constraint ads_id_key unique (id)
) TABLESPACE pg_default;

create table public.notifications (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  push_notifications boolean null default false,
  starting_match boolean null default false,
  articles boolean null default false,
  news boolean null default false,
  constraint notifications_pkey primary key (id)
) TABLESPACE pg_default;

## 12bis) Page Match — Navigation par Calendrier

* **Route** : `/match` (remplace l'ancienne route `/live`)
* **Navigation** : Lien "Matchs" dans la navbar

### Concept et UX

* **Système de temporalité par jour** : Calendrier de 11 cases affichant les dates
  - Jour actuel toujours **centré** (case 6/11)
  - Navigation avec flèches gauche/droite (décalage de 11 jours)
  - Date sélectionnée en **rose (#F22E62)** pour mise en évidence
  - Jour actuel avec bordure rose mais fond gris (distinction visuelle)

* **Affichage des dates** :
  - Format : Jour (3 lettres) + Numéro + Mois (abrégé)
  - Exemple : `lun`, `2`, `jan`
  - Responsive : 5 colonnes mobile, 11 colonnes desktop

* **Filtrage** :
  - Par **date** : Sélection d'un jour dans le calendrier
  - Par **jeu** : GameSelector (sticky desktop, accordion mobile)
  - Combinaison date + jeu supportée

### Fonctionnalités

* **Chargement des matchs** :
  - Endpoint : `POST /api/matches/by-date` avec `date` (YYYY-MM-DD) et `game` (optionnel)
  - Filtrage automatique : N'affiche **que les matchs avec les 2 équipes définies**
  - Validation : `match.opponents.length >= 2` + `opponent.name` présents

* **Recherche modale (⌘K)** :
  - Style identique à la page Articles
  - Modale plein écran (98vw × 90vh) avec fond `bg-background`
  - Affichage : **1 match par ligne** (`grid-cols-1`)
  - Recherche multi-critères : nom, équipe, tournoi, ligue, jeu
  - Compteur de résultats dynamique

* **Actualisation** :
  - Pas d'auto-refresh (contrairement à l'ancienne page live)
  - Bouton "Actualiser" manuel
  - Rechargement automatique au changement de date ou de jeu

### Design

* **Calendrier** :
  - Cases carrées avec padding, bordure arrondie (`rounded-lg`)
  - États visuels :
    - **Sélectionné** : `bg-[#F22E62]` (rose) + texte blanc
    - **Aujourd'hui** : `bg-bg-tertiary` + bordure rose
    - **Autre** : `bg-bg-secondary` + hover `bg-bg-tertiary`

* **Layout** :
  - Padding top `pt-20` pour éviter superposition navbar
  - GameSelector sticky en desktop (z-40)
  - Grille 3 colonnes pour les cartes de matchs (responsive)
  - Colonne pub à droite (desktop uniquement)

### Traductions

* **Langues supportées** : fr, en, es, de, it
* **Clés principales** :
  - `pages_detail.match.title` : "Matchs" / "Matches" / "Partidos" / "Spiele" / "Partite"
  - `pages_detail.match.prev_dates` : "Dates précédentes" / "Previous dates"
  - `pages_detail.match.next_dates` : "Dates suivantes" / "Next dates"
  - `pages_detail.match.today` : "Aujourd'hui" / "Today" / "Hoy" / "Heute" / "Oggi"
  - `pages_detail.match.no_matches` : "Aucun match disponible pour cette date"

### Notes techniques

* **Service frontend** : `matchService.getMatchesByDate(date, gameAcronym)`
* **Format de requête** : `URLSearchParams` (pas FormData) avec `Content-Type: application/x-www-form-urlencoded`
* **Gestion d'état** :
  - `selectedDate` : Date object (défaut: aujourd'hui)
  - `dateRangeOffset` : Nombre de décalages de 11 jours (défaut: 0)
  - Fonction `generateDateRange(centerDate, offset)` pour calculer les 11 dates

* **Composants** :
  - `MatchPageClient.tsx` : Composant principal client-side
  - `LiveMatchCard` : Réutilisé pour l'affichage des matchs
  - `GameSelector` : Sélecteur de jeux (commun avec Tournois)

## 13) Panel Admin — Gestion des Publicités

* **Accès** : `/admin/ads` (authentification JWT requise)
* **Navigation** : Section "Publicité" dans le menu admin (remplace "Médias")

### Fonctionnalités CRUD

1. **Liste des publicités** (`/admin/ads`)
   - Affiche toutes les publicités avec preview image
   - Compteur "X/3" pour limiter les emplacements
   - Colonnes : Position, Aperçu, Titre, Type, Lien, Actions
   - Actions : Éditer, Supprimer (avec confirmation)
   - Tri automatique par position (1 → 3)

2. **Créer une publicité** (`/admin/ads/new`)
   - Champs requis :
     - **Titre** : nom de la publicité
     - **Position** : 1, 2 ou 3 (maximum 3 emplacements)
     - **Type** : image ou video
     - **URL** : lien vers l'image/vidéo (upload vers R2 ou URL externe)
     - **Lien de redirection** : URL de destination au clic
   - Upload d'image :
     - Stockage : Cloudflare R2 (`ads/images/`)
     - Preview en temps réel après upload
     - Formats supportés : JPG, PNG, WebP
   - Validation frontend + backend

3. **Modifier une publicité** (`/admin/ads/[id]/edit`)
   - Formulaire pré-rempli avec données existantes
   - Possibilité de changer l'image (nouvel upload)
   - Cache invalidé automatiquement après modification

4. **Supprimer une publicité**
   - Dialogue de confirmation avant suppression
   - Suppression définitive (pas de soft-delete)
   - Cache invalidé automatiquement

### API Endpoints Admin

| Endpoint | Méthode | Description | Auth |
|----------|---------|-------------|------|
| `/admin/ads` | GET | Liste toutes les pubs | JWT Admin |
| `/admin/ads` | POST | Créer une pub | JWT Admin |
| `/admin/ads/:id` | GET | Détails d'une pub | JWT Admin |
| `/admin/ads/:id` | PUT | Modifier une pub | JWT Admin |
| `/admin/ads/:id` | DELETE | Supprimer une pub | JWT Admin |
| `/admin/ads/upload` | POST | Upload image vers R2 | JWT Admin |

### Affichage Frontend

* **Composants** :
  - `AdBanner` : affiche une publicité individuelle
  - `AdColumn` : colonne droite contenant jusqu'à 3 pubs (desktop uniquement)
  - `AdSkeleton` : loading state pendant le chargement

* **Comportement** :
  - Images chargées via Next.js `<Image>` (optimisation automatique + gestion CORS)
  - Hover effect : overlay avec titre + badge "Publicité"
  - Clic : ouvre `redirect_link` dans nouvel onglet (`_blank`, `noopener,noreferrer`)
  - Visible uniquement pour utilisateurs non-abonnés (sauf desktop où tous voient les pubs)
  - Cache Redis 1h, invalidé à chaque modification

* **Gestion d'erreurs** :
  - Si image échoue au chargement → pub masquée automatiquement
  - Reset automatique de l'état d'erreur si l'URL change
  - Logs console pour debugging (à retirer en production)

### Stockage & CDN

* **Cloudflare R2** :
  - Bucket configuré avec permissions publiques
  - Path : `ads/images/`
  - Nommage : `{timestamp}-{random}.{ext}`
  - URL publique : `https://pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev/ads/images/{filename}`

* **CORS R2** (si nécessaire pour balises `<img>` standard) :
  ```json
  {
    "AllowedOrigins": ["http://localhost:3002", "*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
  ```
  Note : Next.js `<Image>` gère CORS via proxy interne, donc pas besoin de CORS sur R2 si on utilise `<Image>`

### Validation & Contraintes

* **Backend (Go)** :
  - Position : entre 1 et 3 (validation stricte)
  - Type : `image` ou `video` uniquement
  - URL et redirect_link : requis, non-vides
  - Timeout upload : 10 minutes max

* **Frontend (React)** :
  - Formulaire contrôlé avec validation en temps réel
  - Preview image obligatoire avant soumission
  - Gestion loading states (skeleton, spinners)
  - Messages d'erreur utilisateur clairs

* **Cache** :
  - Endpoint public `/api/ads` : cache Redis 1h
  - Invalidation automatique après CREATE/UPDATE/DELETE
  - Timestamp query param `?t={timestamp}` pour éviter cache navigateur

### Notes Techniques

* **Next.js Image vs `<img>`** :
  - ✅ Utiliser `<Image>` de Next.js pour éviter problèmes CORS
  - ✅ Optimisation automatique (WebP, responsive)
  - ❌ Ne pas utiliser `<img>` standard avec URLs R2 (bloqué par CORS)

* **React State Management** :
  - `useState` pour hasError, loading states
  - `useEffect` pour reset hasError quand ad.url change
  - `useMemo` pour filtrage/tri des pubs
  - `useCallback` pour handlers (optimisation)

## 14) Notifications Push (Mobile App)

* **Stack** : Expo Push Service (`https://exp.host/--/api/v2/push/send`) → relais vers **APNs** (iOS) et **FCM V1** (Android). Aucune intégration FCM/APNs directe côté app.

### Chaîne complète

1. `mobile-app/utils/notifications.ts` → `registerForPushNotificationsAsync()` : demande la permission, récupère le token Expo (`getExpoPushTokenAsync({ projectId })`), crée le canal Android `match-alerts` (importance HIGH).
2. `mobile-app/contexts/AuthContext.tsx` : appelle l'enregistrement **après login** → `POST /api/push-tokens` (`pushTokenService`).
3. Backend `internal/handlers/subscription_match_handler.go` : upsert dans la table **`push_token`** (`token` unique, `user_id`, `platform`, `active`).
4. Backend `internal/services/notification_scheduler.go` (tick **60 s**) : détecte les matchs suivis qui passent `running` → envoie via `internal/services/expo_push.go`.

### Règles importantes

* **Un seul type de notif existe** : « Match en direct » (match-start), pour un match **suivi** qui passe live, conditionné par `user.notifi_push && user.notif_matchs`. **Aucune notif articles/news** n'est implémentée malgré les colonnes `notif_articles`/`notif_news` (= dev à faire si besoin).
* Le message backend envoie `Priority: "high"` (APNs 10 / FCM high) + `ChannelId: "match-alerts"` (Android uniquement, iOS l'ignore) → bannière heads-up.

### ⚠️ Config Expo — source unique = `app.config.js`

* `app.config.js` exporte un **objet statique** → Expo **ignore complètement `app.json`** (pas de merge). `app.json` a été **supprimé** : tout est dans `app.config.js`.
* Plugins requis : `expo-notifications` (ajoute l'entitlement iOS `aps-environment`), `react-native-iap`. **Ne PAS lister `react-native-nitro-modules`** (pas de config plugin → casse le build ; il s'autolink).
* `ios.infoPlist.UIBackgroundModes: ["remote-notification"]` requis.
* Vérifier la config réelle d'un build : `cd mobile-app && ./node_modules/.bin/expo config --type public --json`.

### Credentials

* **iOS** : Push Key APNs (`eas credentials` → iOS) **doit être sur le même Apple Team que le bundle** `com.esportnews-app.mobile` → team **53A66VVR3U (ESPORT NEWS, company)**. (Un ancien key sur le team perso `22W276W7ZG` faisait échouer APNs.)
* **Android** (package `com.esportnewsapp.mobile`) :
  - `mobile-app/google-services.json` (projet Firebase `esport-news-eb60c`) → **public, committé**, activé via `android.googleServicesFile` (guard `fs.existsSync` dans app.config.js).
  - **Clé compte de service FCM V1** uploadée via `eas credentials` → Android → Google Service Account → **Push Notifications (FCM V1)** → **SECRET, jamais committée**. (FCM **Legacy** est mort depuis juin 2024 — slot inutile.)
* Toute config native (entitlement, plist, google-services) impose un **`eas build`** (l'OTA `eas update` ne suffit pas). Le changement de message backend est serveur (Railway, branche `main`).
* **Expo Go utilise les credentials push d'Expo** → les notifs « marchent » en Expo Go mais nécessitent TES credentials APNs/FCM en build standalone. Tester sur **vrai device** (pas simulateur), connecté, abonné à un match.

## 15) Publicités AdMob (Mobile App)

> ⚠️ Distinct des **bannières internes** (site web, table `ads`, `/api/ads`, `AdColumn`/`AdBanner`, gérées au back-office) décrites en §13. Ici = pubs **interstitielles AdMob** dans l'app mobile via `react-native-google-mobile-ads`.

* **Init** : `app/_layout.tsx` (`mobileAds().initialize()` + ATT iOS via `expo-tracking-transparency`).
* **IDs (publics, embarqués dans le binaire, par plateforme)** — dans `app.config.js` :
  - App ID iOS : `ca-app-pub-5118678813787741~6090534381`
  - App ID Android : `ca-app-pub-5118678813787741~6893939034`
  - Interstitiel : `ca-app-pub-5118678813787741/1903877366`
* **Dev vs prod** : `getInterstitialAdUnitId()` (dans `contexts/AdContext.tsx` et `hooks/useAdPopup.ts`) → `TestIds.INTERSTITIAL` si `__DEV__` (Expo Go/`expo run`, fill 100 %), sinon `Constants.expoConfig.extra.admobInterstitialId`.
* **⚠️ Piège prod (env non uploadé à EAS)** : les vrais IDs sont dans le **`.env` racine gitignoré**, chargé par `app.config.js` via `dotenv`. **EAS cloud respecte `.gitignore` → `.env` n'est PAS uploadé** → `process.env.ADMOB_*` undefined au build → ce sont les **fallbacks `|| "..."` de app.config.js qui partent en prod**. ⇒ **Ces fallbacks doivent TOUJOURS valoir les vrais IDs prod.** (Bug initial : fallback iOS = App ID Android → AdMob refusait de servir.)
* **Déclenchement** : `useAdPopup({ skipIfSubscribed, isSubscribed })` — cooldown 5 min (`adCooldownService`), `requestNonPersonalizedAdsOnly: true`, skip pour abonnés Premium. Écrans index/match/tournoi/article.
* **Gap connu** : consentement UMP/GDPR (`AdsConsent`) **non implémenté** (`requestConsent()` = placeholder) → risque de no-fill EEA (France). Les nouvelles apps/units AdMob peuvent aussi no-fill quelques heures à ~2 j (warm-up).

## 16) Build & Release Mobile (EAS)

* **Profils** (`mobile-app/eas.json`) : `production` (AAB iOS/Android, `autoIncrement` du **build number**, API prod), `preview` (APK installable, distribution interne, **API prod**), `development`.
* **Versioning** : `appVersionSource: "remote"` → EAS gère le **build number** (`autoIncrement`). La **version marketing** (`CFBundleShortVersionString`) vient de `version` dans `app.config.js`.
  - **⚠️ App Store** : on ne peut pas re-soumettre sous une version déjà publiée (erreurs `ITMS-90186` train fermé / `ITMS-90062` version pas supérieure). → **bumper `version`** dans `app.config.js` (ex. `1.0.0` → `1.0.1`) avant un nouveau build iOS.
* **Play Console** exige un **`.aab`** (pas d'APK) en production → profil `production`. L'APK `preview` sert au test device uniquement.
* Commandes : `eas build --platform <ios|android> --profile production` puis (iOS) `eas submit --platform ios --profile production` ou upload manuel du `.aab` (Android).
* `npx` est réécrit en `npm` par un hook local → utiliser les binaires directs (`./node_modules/.bin/expo`, etc.) pour les commandes scriptées.

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.