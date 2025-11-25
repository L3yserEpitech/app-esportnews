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
| `/api/matches/by-date` | POST | Matchs à une date précise | `date` (form), `game` (form, optionnel) |
| `/api/matches/:id` | GET | Détails d'un match | `id` (path) |

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

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.