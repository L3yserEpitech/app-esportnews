# CLAUDE.md — Maquette (squelette)

> Ce document sert de source unique de vérité pour cadrer le produit, la DA, la structure du site et les exigences techniques. Il doit rester court par section, mais exhaustif par les rubriques.

---

## 1) Vision & Contexte

* **Pitch (1 phrase)** : Plateforme e-sport mettant en avant les matchs **en direct** (multi-jeux) + actualités, avec monétisation par bannières publicitaires (gérées en interne, sans tracking tiers) et SEO solide sur les contenus éditoriaux.
* **Problème utilisateur** : Difficile de trouver rapidement les matchs live pertinents et les actus fiables par jeu.
* **Valeur clé / différenciation** : Focus **live-only** agrégé, tournois/équipes/matchs structurés (Liquipedia API v3), UX rapide par **jeu** et calendrier simple.
* **Mesure du succès (KPI)** : CTR jeux en home, temps sur « Direct », clics pubs, impressions bannières publicitaires, conversions abonnement (no-popup-ads mobile), pages vues News/Articles, retour visiteurs.
* **Contraintes business** : Pas de back-office à développer (déjà existant). Pas de conservation de données côté app. Pas de limite API contractuelle.
* **Infrastructure** : Migration de Vercel/Supabase vers déploiement local (PostgreSQL + Redis + Go backend en Docker Compose).
* **Backend** : Backend Go finalisé dans `/backend-go` (remplace ancien Node.js `/backend/api`)

### Décisions actées (20/09/2025)

* **Jeux au lancement** : Valorant, FIFA, Wild Rift, Dota, Overwatch, Call of Duty, League of Legends, Rainbow Six Siege, Rocket League, CS2.
* **Cibles** : Visuellement s’adresser aux **fans** ; **panneau publicitaire** pensé pour les joueurs.
* **Périmètre** : Pas de MVP — développement **complet** de l’app dès V1. Back-office **déjà fait**.
* **Source de données** :

  * **Liquipedia API v3** → source unique pour matchs, tournois, équipes, joueurs, live. Remplace PandaScore + SportDevs.
* **Données** : Aucune **conservation** locale de données esport (cache Redis uniquement). DB pour users/articles/ads.
* **API** : **60 requêtes par jeu (wiki) par heure** — voir section 14) Liquipedia.
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

* **Architecture de synchronisation (Liquipedia)** :
  - **Webhooks LiquipediaDB** : notification push quand une page change → dirty flags → batch fetch
  - **Background poller** : goroutines par jeu, tickers par type de données (fallback si webhooks indisponibles)
  - **Cache-aside on-demand** : pour détails individuels (match/:id, tournament/:id, teams/search)
  - **Budget tracker** : 60 req/wiki/heure, compteur avec reset horaire, stale-while-revalidate si épuisé
  - Voir `docs/strategie-rate-limiting.md` pour les détails complets

* **Données persistantes vs volatiles** :
  - **Persistantes** : users, articles, ads (édités via back-office)
  - **Volatiles** : matchs, tournois, équipes (cache Redis uniquement, source Liquipedia)
  - **Cache Redis TTLs** : live 3min, upcoming 15min, past 20min, tournois 15-60min, stale 1h

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
- `running` → matchs/tournois en cours
- `upcoming` → à venir
- `finished` → terminés

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
| `/api/live` | GET | Matchs en direct (alias /matches/running) | `game` (query, optionnel) |
| `/api/webhooks/liquipedia` | POST | Webhook LiquipediaDB (events: edit, delete, move, purge) | - |
| `/admin/api-budget` | GET | Budget API Liquipedia par wiki (admin) | JWT Admin |

**Exemple de requête avec paramètres** :
```
GET /api/tournaments?limit=12&offset=0&sort=tier&game=valorant
GET /api/tournaments/upcoming?limit=20&offset=0&sort=-begin_at
POST /api/tournaments/by-date (body: date=2025-11-19&game=lol)
```

## 7) Technique — Stack & Architecture

* **Données & APIs** :

  * **Liquipedia API v3** → source unique pour toutes les données esport (matchs, tournois, équipes, joueurs, live). Base URL : `https://api.liquipedia.net/api/v3`. Auth : `Authorization: Apikey <token>`. Rate limit : 60 req/wiki/heure.
  * PandaScore et SportDevs ont été **supprimés** (migration terminée — Phases 0 à 6 complètes).
* **Stratégie data** : PostgreSQL pour persistance (users, articles, ads). Données esport en cache Redis uniquement (source Liquipedia). Backend Go normalise les réponses Liquipedia vers un format compatible frontend.
* **Infra** : Docker local (dev/prod identique) + CDN + edge cache pour assets ; SSR/ISR pour pages éditoriales (SEO), live en CSR.
* **Interop** : liens de diffusion ouverts en **new tab**.

## 8) Base de Données — Architecture Détaillée

* **4 tables principales** (persistantes en PostgreSQL) :

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

* **Tables supprimées** (données désormais en cache Redis via Liquipedia) :
  - ~~tournaments~~ — matchs/tournois servis depuis Redis (source Liquipedia API v3)
  - ~~matches~~ — matchs servis depuis Redis (source Liquipedia API v3)
  - ~~games_pandascore~~ — sous-matchs servis depuis Redis (source Liquipedia API v3)

* **Indexes pour perf** :
  - users(email), articles(slug)

* **Politique de données** :
  - **Persistance** : users, articles, ads (jamais supprimés, soft-delete si besoin)
  - **Volatiles** : matchs, tournois, équipes (cache Redis uniquement, source Liquipedia API v3, aucune rétention DB)
  - **Cache** : live data dans Redis (TTL 3min live, 15min upcoming, 20min past, 15-60min tournois, 30min équipes, stale 1h)
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
  - Contrevérifier les contraintes UNIQUE après import (id, email, slug)
  - **Tournois/matchs ne se migrent PAS** : servis depuis cache Redis (source Liquipedia API v3)

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

* **Modèle logique** : Game → (Liquipedia API v3) → Tournament → Match → Games/Maps → Live streams
  - Article (via BO) → DB persistant
* **Politiques** :
  - **users, articles, ads** : rétention permanente (soft-delete si besoin)
  - **matchs, tournois, équipes** : cache Redis volatile uniquement (source Liquipedia), aucune rétention DB
* **RGPD** : abonnement géré côté BO/processor ; bannières publicitaires internes sans tracking tiers (pas de consentement requis pour l'affichage simple).
* **Contrats d'API** : wrappers typed (Go structs LiqMatch, LiqTournament, LiqTeam), budget tracker 60 req/wiki/heure, stale-while-revalidate si épuisé, circuit-breaker Redis.

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

* **DEPRECATED** (historique) :
  - ❌ Backend Node.js (`/backend/api`) — remplacé par Go backend
  - ❌ Supabase hosted — migré vers PostgreSQL local
  - ❌ Vercel deployment — infrastructure locale Docker
  - ❌ PandaScore API — remplacé par Liquipedia API v3
  - ❌ SportDevs API — remplacé par Liquipedia API v3
  - ❌ Tables DB `tournaments`, `matches`, `games_pandascore` — données en cache Redis (Liquipedia)

* **Complétés** :
  - ✅ Migration données Supabase (users, articles, ads)
  - ✅ Seeding articles (47 articles importés via script Go + JSON)
  - ✅ Migration PandaScore → Liquipedia (matchs, tournois, équipes)
  - ✅ Migration SportDevs → Liquipedia (live, streams)
  - ✅ Backend Node.js → Go (finalisé)
  - ✅ Supabase → PostgreSQL local
  - ✅ Vercel → infrastructure locale Docker
  - ✅ Phase 0 — Nettoyage PandaScore/SportDevs (code supprimé)
  - ✅ Phase 1 — Fondation Liquipedia (service HTTP, budget tracker, poller, webhooks)
  - ✅ Phase 2 — Matchs Liquipedia (LiqMatch structs, poller conditions, handlers Redis + on-demand)
  - ✅ Phase 3 — Tournois Liquipedia (LiqTournament structs, 7 endpoints, cache poller + on-demand)
  - ✅ Phase 4 — Équipes/joueurs Liquipedia (LiqTeam/LiqSquadPlayer, search parallel, favorites)
  - ✅ Phase 5 — Live/streams (validation carousel, stream normalization)
  - ✅ Phase 6 — Documentation (mise à jour complète docs projet)

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

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.

## 14) Backend Liquipedia — Intégration API v3

### API Liquipedia v3

* **Base URL** : `https://api.liquipedia.net/api/v3`
* **Auth** : Header `Authorization: Apikey <token>` — clé dans `LIQUIPEDIA_API_KEY` (.env)
* **User-Agent** : Obligatoire — `EsportNews/1.0 (contact@esportnews.fr)`
* **Rate limit** : **60 requêtes par wiki (jeu) par heure**. 10 wikis = 600 req/heure total.
* **Format réponse** : `{ "result": [ ...json objects... ] }`
* **Webhooks LiquipediaDB** : Events `edit`, `delete`, `move`, `purge`. Payload : `{ page, namespace, wiki, event }`. URL configurée dans le dashboard LiquipediaDB.
* **Doc stratégie complète** : `docs/strategie-rate-limiting.md`

### Mapping jeux → wikis Liquipedia

| Acronyme interne | Wiki Liquipedia | Défini dans |
|-----------------|----------------|-------------|
| `csgo` | `counterstrike` | `models/liquipedia.go` → `GameWikiMapping` |
| `valorant` | `valorant` | |
| `lol` | `leagueoflegends` | |
| `dota2` | `dota2` | |
| `rl` | `rocketleague` | |
| `codmw` | `callofduty` | |
| `r6siege` | `rainbowsix` | |
| `ow` | `overwatch` | |
| `fifa` | `fifa` | |
| `lol-wild-rift` | `wildrift` | |

Reverse mapping : `WikiToAcronym` (même fichier).

### Architecture backend (Phase 1 — implémenté)

```
Liquipedia API v3
       |
  ┌────┼────┐
  │    │    │
Webhooks  Poller  On-demand
(push)  (background) (cache-aside)
  │    │    │
  └────┼────┘
       │
  Redis Cache (source unique)
       │
  ┌────┼────┐
  │    │    │
/matches /tournaments /teams
handlers   handlers   handlers
  │    │    │
  └────┼────┘
       │
  Frontend Next.js
```

**Principe clé** : Les handlers HTTP ne font **jamais** d'appel direct à Liquipedia. Ils lisent **toujours** depuis Redis. Seuls le poller, les webhooks et les requêtes on-demand écrivent dans Redis.

### Fichiers backend Liquipedia

| Fichier | Rôle |
|---------|------|
| `services/liquipedia_service.go` | Client HTTP, auth, budget tracker, `MakeRequest()`, stale-while-revalidate, `SearchTeams()`, `GetTeamByPageID()` |
| `services/liquipedia_poller.go` | Goroutines background par jeu, tickers par endpoint (matchs + tournois), dirty flags consumer |
| `handlers/webhooks.go` | Endpoint `POST /webhooks/liquipedia`, parse event, `MarkDirty()` |
| `handlers/matches.go` | 5 endpoints matchs : running, upcoming, past (Redis), by-date et :id (on-demand) |
| `handlers/tournaments.go` | 7 endpoints tournois : running, all, upcoming, finished, by-date, :id, filtered (Redis + on-demand) |
| `handlers/teams.go` | 6 endpoints équipes : search, get, favorites CRUD (Liquipedia + GORM) |
| `models/liquipedia.go` | `LiquipediaResponse`, `LiquipediaWebhookEvent`, `GameWikiMapping`, `WikiToAcronym` |
| `models/liquipedia_match.go` | `LiqMatch` (37 champs), `NormalizedMatch`, `NormalizeLiqMatch()`, normalisation streams/games/opponents |
| `models/liquipedia_tournament.go` | `LiqTournament` (27 champs), `NormalizedTournament`, `NormalizeLiqTournament()`, status/prizepool |
| `models/team.go` | `LiqTeam`, `LiqSquadPlayer`, `NormalizedTeam`, `NormalizedPlayer`, normalisation roster |
| `cache/patterns.go` | Clés Redis : `liq:matches:*`, `liq:tournaments:*`, `liq:team:*`, `StaleKey()` |

### Budget tracker (RequestBudget)

* **Limite** : 60 req/wiki/heure (hardcodé dans `liquipedia_service.go`)
* **Reset** : automatique chaque heure (truncate to hour + 1h)
* **Stale-while-revalidate** : si budget épuisé → retourner données stale (TTL 1h) plutôt qu'erreur
* **Monitoring** : `GET /admin/api-budget` retourne `{ budgets: { wiki: { used, limit, remaining, resets_at } }, total_used, total_limit }`

### Cache Redis — Clés et TTLs

| Clé | TTL | Source |
|-----|-----|--------|
| `liq:matches:running:<wiki>` | 3 min | Poller (2 min) ou webhook dirty |
| `liq:matches:upcoming:<wiki>` | 15 min | Poller (10 min) ou webhook dirty |
| `liq:matches:past:<wiki>` | 20 min | Poller (15 min) ou webhook dirty |
| `liq:tournaments:running:<wiki>` | 15 min | Poller (10 min) ou webhook dirty |
| `liq:tournaments:upcoming:<wiki>` | 20 min | Poller (15 min) ou webhook dirty |
| `liq:tournaments:finished:<wiki>` | 1h | Poller (30 min) ou webhook dirty |
| `liq:match:<wiki>:<id>` | 5 min | On-demand (cache-aside) |
| `liq:tournament:<wiki>:<id>` | 10 min | On-demand |
| `liq:team:<wiki>:<id>` | 30 min | On-demand |
| `*:stale` | 1h | Copie automatique à chaque écriture |

### Dirty flags (webhook → poller)

* **DirtyTracker** : `map[wiki]*DirtyFlag` thread-safe (`sync.Mutex`)
* **DirtyFlag** : `MatchesRunning`, `MatchesUpcoming`, `MatchesPast`, `Tournaments`, `Teams`, `LastEvent`
* **Flux** : Webhook arrive → `MarkDirty(event)` → Poller check toutes les 2 min → `GetAndResetDirty()` → fetch batch → Redis
* **Debounce** : N webhooks pour le même wiki = 1 seul fetch (regroupé par le dirty flag)

### Poller — Modes de fonctionnement

* **Sans webhooks (Scenario B)** : polling aveugle à intervalles fixes — 52 req/heure/jeu background + 8 reserve on-demand
* **Avec webhooks (Scenario A)** : polling uniquement quand dirty flags sont set — 0-40 req background selon activité + 20-60 reserve
* **Toggle** : `poller.SetWebhooksEnabled(true)` — à activer une fois les webhooks configurés dans le dashboard LiquipediaDB

### Migration — État d'avancement

| Phase | Statut | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Terminée | Nettoyage PandaScore/SportDevs |
| Phase 1 | ✅ Terminée | Fondation (service, poller, webhooks, budget) |
| Phase 2 | ✅ Terminée | Matchs (LiqMatch structs, poller conditions, handlers Redis + on-demand) |
| Phase 3 | ✅ Terminée | Tournois (LiqTournament structs, 7 endpoints, cache poller + on-demand) |
| Phase 4 | ✅ Terminée | Équipes/joueurs (LiqTeam/LiqSquadPlayer, search parallel, favorites) |
| Phase 5 | ✅ Terminée | Live/streams (validation carousel, stream normalization) |
| Phase 6 | ✅ Terminée | Documentation (mise à jour complète docs projet) |

**Docs détaillées** : `docs/phase0-nettoyage.md` → `docs/phase6-documentation.md` + `docs/strategie-rate-limiting.md`

### Architecture résumée (toutes phases complètes)

1. **`services/liquipedia_service.go`** — Client HTTP unique vers Liquipedia, budget tracker, stale-while-revalidate, search/get teams
2. **`services/liquipedia_poller.go`** — Goroutines background par jeu (6 tickers : matchs running/upcoming/past + tournois running/upcoming/finished)
3. **`cache/patterns.go`** — Clés Redis pour matchs, tournois, équipes + stale keys
4. **`models/liquipedia_match.go`** — LiqMatch → NormalizedMatch (compatible frontend PandaMatch)
5. **`models/liquipedia_tournament.go`** — LiqTournament → NormalizedTournament (compatible frontend PandaTournament)
6. **`models/team.go`** — LiqTeam + LiqSquadPlayer → NormalizedTeam + NormalizedPlayer
7. **Handlers** — Tous lisent depuis Redis, jamais d'appel direct Liquipedia (sauf on-demand cache-aside)