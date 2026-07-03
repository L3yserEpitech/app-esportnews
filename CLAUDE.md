# CLAUDE.md — EsportNews

> Source unique de vérité pour cadrer le produit, la stack, l'architecture, les variables d'environnement, les services, les handlers, le cache, la base de données et les procédures opérationnelles. **Toute future session Claude doit pouvoir prendre la main sur le projet en lisant ce seul document.**

---

## 0) Index

1. [Vision & contexte produit](#1-vision--contexte-produit)
2. [Architecture globale](#2-architecture-globale)
3. [Stack technique](#3-stack-technique)
4. [Variables d'environnement](#4-variables-denvironnement-référence-exhaustive)
5. [Backend Go — Services](#5-backend-go--services)
6. [Backend Go — Handlers & routes](#6-backend-go--handlers--routes-http)
7. [Backend Go — Models](#7-backend-go--models)
8. [Cache Redis](#8-cache-redis)
9. [Base de données PostgreSQL](#9-base-de-données-postgresql)
10. [Intégration Liquipedia API v3](#10-intégration-liquipedia-api-v3)
11. [Webhooks Liquipedia](#11-webhooks-liquipedia)
12. [Notification Scheduler (push Expo)](#12-notification-scheduler-push-expo)
13. [Frontend Next.js](#13-frontend-nextjs)
14. [Mobile App (Expo)](#14-mobile-app-expo)
15. [Déploiement Railway (prod + preview)](#15-déploiement-railway-prod--preview)
16. [Procédures opérationnelles courantes](#16-procédures-opérationnelles-courantes)
17. [Historique de migration](#17-historique-de-migration)
18. [Pages spécifiques (Match / Admin Ads)](#18-pages-spécifiques)
19. [Conventions de travail](#19-conventions-de-travail)

---

## 1) Vision & contexte produit

* **Pitch** : Plateforme e-sport mettant en avant les matchs **en direct** (multi-jeux) + actualités, avec monétisation par bannières publicitaires **gérées en interne** (zéro tracking tiers) et SEO solide sur les contenus éditoriaux.
* **Problème utilisateur** : Difficile de trouver rapidement les matchs live pertinents et les actus fiables par jeu.
* **Différenciation** : Focus **live-only** agrégé, tournois/équipes/matchs structurés (Liquipedia API v3), UX rapide par jeu et calendrier simple.
* **KPI principaux** : CTR jeux en home, temps sur "Direct", clics pubs, impressions bannières, conversions abonnement (no-ad mobile), pages vues News/Articles, retour visiteurs.
* **Cibles** : Visuellement → **fans** ; panneau publicitaire → **joueurs**.
* **Contraintes business** : Pas de back-office à développer (déjà existant). Pas de conservation de données esport côté app (cache Redis uniquement). Pas de limite API contractuelle.

### Jeux supportés au lancement (10)
| Acronyme interne | Wiki Liquipedia | Nom complet |
|------------------|-----------------|-------------|
| `csgo`           | `counterstrike` | Counter-Strike 2 |
| `valorant`       | `valorant`      | Valorant |
| `lol`            | `leagueoflegends` | League of Legends |
| `dota2`          | `dota2`         | Dota 2 |
| `rl`             | `rocketleague`  | Rocket League |
| `codmw`          | `callofduty`    | Call of Duty |
| `r6siege`        | `rainbowsix`    | Rainbow Six Siege |
| `ow`             | `overwatch`     | Overwatch |
| `fifa`           | `easportsfc`    | EA Sports FC (anciennement FIFA) |
| `lol-wild-rift`  | `wildrift`      | Wild Rift |

> Source de vérité : `backend-go/internal/models/liquipedia.go` (`GameWikiMapping`).

### Palette de couleurs
`#060B13` (background principal) · `#091626` (fond secondaire) · `#182859` (accent navy) · `#F22E62` (rose primary — calendrier, CTA actifs)

### Monétisation
* **Bannières publicitaires gérées en interne** (pas de Google AdSense / Meta Ads). Images/vidéos uploadées dans Cloudflare R2, métadonnées en DB.
* **Desktop** : 3 emplacements pub dans une colonne droite pleine hauteur (visibles pour tous, abonnés compris).
* **Mobile** : aucun popup publicitaire pour les abonnés **Premium** ; autorisés pour les utilisateurs gratuits.
* **Aucun cookie publicitaire tiers, aucun tracking comportemental.**

### SEO
* H1/H2/H3, meta Title/Description, OpenGraph.
* Articles : mots-clés (champ `tags` en DB) + slug unique.
* URL : kebab-case, slugs par jeu/compétition/article.
* Pas de canonical sur les filtres dynamiques (listings de matchs).

---

## 2) Architecture globale

```
                          ┌──────────────────────────┐
                          │   Liquipedia API v3      │
                          │  (api.liquipedia.net)    │
                          └─────────┬────────────────┘
                                    │ HTTP (1000 req/wiki/h)
                                    │ Apikey + User-Agent
                                    │
                  ┌─────────────────┴────────────────┐
                  │       LiquipediaService          │
                  │   (singleflight + budget         │
                  │    tracker + stale-while-        │
                  │    revalidate)                   │
                  └───────┬────────────────┬─────────┘
              writes      │                │  on-demand
                          ▼                ▼
                     ┌────────────────────────┐
                     │   Redis Cache          │
                     │ (liq:* + cache:* keys) │
                     └────────┬───────────────┘
                              │
                  reads only  │  (handlers ne touchent JAMAIS Liquipedia direct)
                              │
              ┌───────────────┴────────────────┐
              │     Echo HTTP handlers          │
              │  matches / tournaments / teams  │
              │  articles / ads / auth / ...    │
              └─────┬────────────────────┬──────┘
                    │                    │
                    ▼                    ▼
          ┌─────────────────┐    ┌──────────────────┐
          │ Frontend Next.js│    │  Mobile App      │
          │  (Vercel/local) │    │  (Expo)          │
          └─────────────────┘    └──────────────────┘

                  ┌──────────────────────────┐
                  │   PostgreSQL (Supabase)  │
                  │  users · articles · ads  │
                  │  notifications · games   │
                  │  match_subscription      │
                  │  tournament_subscription │
                  │  push_token              │
                  └──────────────────────────┘
                              ▲
                              │  GORM + pgxpool
                              │
                  ┌──────────┴───────────────┐
                  │ Backend Go (Echo, port   │
                  │ 4000 local / 8080 prod)  │
                  └──────────────────────────┘
```

### Flux des données « live » (matchs, tournois, équipes)
1. **Poller** (goroutine background, 1 par wiki) appelle Liquipedia à intervalles fixes → écrit dans Redis.
2. **Webhook** LiquipediaDB POST `/api/webhooks/liquipedia` → marque dirty flags → poller fait un refresh ciblé (au prochain tick `DirtyCheckInterval` = 2 min).
3. **Handlers HTTP** lisent uniquement Redis (jamais d'appel direct à Liquipedia depuis un handler synchrone — sauf détails on-demand qui passent par `MakeRequest` cache-aside).
4. **NotificationScheduler** (goroutine) lit Redis via `LiquipediaReader` pour détecter les matchs qui passent en live et déclencher des push notifications Expo.

### Flux des données persistantes
* **users / articles / ads / push_token / match_subscription / tournament_subscription** : PostgreSQL via GORM (source de vérité).
* **games** : PostgreSQL (10 lignes statiques, alimentées via back-office).
* **Aucune table `matches` ou `tournaments`** : ces données vivent uniquement dans Redis (cache des appels Liquipedia).

---

## 3) Stack technique

### Backend
* **Langage** : Go 1.22
* **Framework HTTP** : Echo v4 (`github.com/labstack/echo/v4`)
* **ORM principal** : GORM v2 (`gorm.io/gorm`) → table `users`, `articles`, `ads`, `match_subscription`, `tournament_subscription`, `push_token`, `notifications`, `games`
* **Driver PostgreSQL bas niveau** : `github.com/jackc/pgx/v5` (pgxpool, conservé pour la rétro-compat de certains handlers historiques)
* **Cache** : `github.com/redis/go-redis/v9`
* **Logger** : `github.com/sirupsen/logrus` (format JSON)
* **Singleflight** : `golang.org/x/sync/singleflight` (déduplication des appels API concurrents)
* **Env loader** : `github.com/joho/godotenv` (lecture `.env` en dev local)

### Frontend (web)
* **Framework** : Next.js 15 (App Router + Turbopack)
* **Langage** : TypeScript
* **State** : RTK Query (services API + cache normalisé)
* **Styling** : Tailwind CSS
* **Internationalisation** : 5 langues (fr, en, es, de, it)

### Mobile
* **Runtime** : Expo + React Native
* **Push notifications** : Expo Push Notifications API

### Infrastructure
* **Base de données** : PostgreSQL (Supabase managed) — partagée entre prod et preview Railway
* **Cache** : Redis (managed Railway)
* **Object storage** : Cloudflare R2 (`pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev`) pour les images d'articles, ads, avatars
* **Déploiement** : Railway (2 projets : prod + preview)
* **CDN frontend** : Vercel (esportnews.fr)
* **Domaines** :
  - Prod : `https://www.esportnews.fr` (frontend) + backend Railway prod
  - Preview R&D : `https://www.blitchapp.online` (backend Railway preview, custom domain en cours)

### Paiements
* **Web** : Stripe (Checkout + Customer Portal + webhooks)
* **iOS** : Apple In-App Purchase (App Store Server Notifications V2 + JWS verification)
* **Android** : Google Play Billing (Real-time Developer Notifications via Pub/Sub)

### Email
* **Resend** (`https://resend.com`)

---

## 4) Variables d'environnement (référence exhaustive)

Toutes lues dans `backend-go/internal/config/config.go` via `LoadConfig()`. Source de vérité par défaut dans `.env.example`. Surchargées dans les `docker-compose*.yml` (dev/prod) ou les variables Railway (prod/preview).

### Server
| Variable | Type | Défaut | Rôle | Pourquoi |
|----------|------|--------|------|----------|
| `PORT` | string | `4000` | Port d'écoute HTTP du backend Go | Railway l'override à `8080` automatiquement |
| `ENV` | string | `development` | Étiquette d'environnement (purement informatif) | Utilisé par GORM pour activer/désactiver les logs SQL |
| `FRONTEND_URL` | url | `http://localhost:3000` | URL canonique du frontend | Ajoutée automatiquement à la whitelist CORS |
| `CORS_ORIGINS` | csv | `""` | Origines additionnelles séparées par virgules | Permet d'ajouter des previews ad-hoc sans recompiler |

### Database & Cache
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `DATABASE_URL` | dsn | `postgres://esportnews:secret@localhost:5432/esportnews` | DSN PostgreSQL (utilisé par pgxpool ET GORM) |
| `REDIS_URL` | url | `redis://localhost:6379` | URL Redis (cache live + sessions + budgets) |
| `DB_MAX_CONNECTIONS` | int | `25` | Pool size pgxpool (hardcoded dans `MaxConnections`) |

### Auth
| Variable | Type | Défaut | Rôle | Pourquoi |
|----------|------|--------|------|----------|
| `JWT_SECRET` | string | `your-secret-key` | Clé de signature HS256 des access tokens | **Doit être unique et secret en prod**, sinon JWT forgeables |

JWT expiration hardcodée : **7 jours**.

### Liquipedia
| Variable | Type | Défaut | Rôle | Pourquoi |
|----------|------|--------|------|----------|
| `LIQUIPEDIA_API_KEY` | string | `""` | Clé API v3 → header `Authorization: Apikey <key>` | Si vide, le poller log un warning et **ne démarre pas** |
| `LIQUIPEDIA_BUDGET_PER_WIKI` | int | `1000` | Quota requêtes/heure/wiki appliqué par le `RequestBudget` | Passé de 60 → 1000 en juin 2026 après extension officielle du quota |
| `LIQUIPEDIA_WEBHOOKS_ENABLED` | bool | `false` (dev) / `true` (prod) | Active le mode dirty-flags du poller | Une fois OFF, le poller fait du polling aveugle aux intervalles fixes (Scenario B) |
| `LIQUIPEDIA_WEBHOOK_SECRET` | string | `""` | Secret validé via header `X-Webhook-Secret` ou query param `?secret=` (`crypto/subtle.ConstantTimeCompare`) | LiquipediaDB ne sait envoyer ni header ni signature → le secret passe dans l'URL. Empty = pas de vérification (dev local uniquement) |
| `LIQUIPEDIA_SKIP_TLS` | bool | `false` | Désactive la vérification TLS du client HTTP Liquipedia | **Dev uniquement** — utile en local quand le cert IPv4 forcé pose souci |
| `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` | int | `0` (désactivé) / `1500` (docker-compose.dev) | Espacement minimum entre appels HTTP sortants vers Liquipedia | L'API a une limite par IP en plus du quota horaire ; indispensable en local (cold cache = fetch massif). Recommandé en prod : `300` |
| `LIQUIPEDIA_DISABLE_IPV4` | bool | `false` | Désactive le forçage IPv4 vers api.liquipedia.net | Pour un host local avec IPv6 fonctionnel dont l'IPv4 est rate-limitée. **Ne jamais activer sur Railway** (pas d'IPv6) |

### Background services
| Variable | Type | Défaut | Rôle | Pourquoi |
|----------|------|--------|------|----------|
| `NOTIFICATION_SCHEDULER_ENABLED` | bool | `true` | Lance le NotificationScheduler au boot | **Doit être `false`** sur l'env preview pour éviter d'envoyer 2× les push notifs (preview partage la DB de prod) |

### Stripe
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `STRIPE_SECRET_KEY` | string | `""` | Clé secrète Stripe (`sk_test_...` ou `sk_live_...`) |
| `STRIPE_PRICE_ID` | string | `price_1SZoti3MOTiy12q9vCQLg1wG` | Price ID de l'abonnement Premium |
| `STRIPE_WEBHOOK_SECRET` | string | `""` | Secret pour vérifier la signature du webhook `/api/webhooks/stripe` |

### Resend
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `RESEND_API_KEY` | string | `""` | Clé API Resend pour envoyer les emails de bienvenue/reset password |
| `EMAIL_FROM` | string | `noreply@resend.dev` | Adresse `From` des emails |

### Apple IAP
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `APPLE_IAP_KEY_PATH` | path | `""` | Chemin local vers `AuthKey_XXXX.p8` (clé privée App Store Server API) |
| `APPLE_IAP_KEY_ID` | string | `""` | Identifiant 10 chars de la clé Apple |
| `APPLE_IAP_ISSUER_ID` | uuid | `""` | Issuer ID de l'App Store Connect |
| `APPLE_IAP_BUNDLE_ID` | string | `com.esportnews-app.mobile` | Bundle ID de l'app iOS |
| `APPLE_IAP_ENVIRONMENT` | string | `sandbox` | `sandbox` ou `production` |

### Google IAP
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `GOOGLE_IAP_KEY_PATH` | path | `""` | Chemin vers le JSON du service account Google |
| `GOOGLE_IAP_PACKAGE` | string | `com.esportnewsapp.mobile` | Package name Android |
| `GOOGLE_WEBHOOK_TOKEN` | string | `""` | Secret partagé pour authentifier les notifications RTDN via Pub/Sub push |

### Cloudflare R2
| Variable | Type | Défaut | Rôle |
|----------|------|--------|------|
| `CLOUDFLARE_ACCOUNT_ID` | string | `""` | ID du compte Cloudflare |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | string | `""` | Access key R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | string | `""` | Secret access key R2 |
| `CLOUDFLARE_R2_BUCKET_NAME` | string | `esportnews-bucket` | Nom du bucket |
| `CLOUDFLARE_R2_ENDPOINT` | url | `""` | Endpoint S3 du bucket (`https://<accountid>.r2.cloudflarestorage.com`) |
| `CLOUDFLARE_R2_PUBLIC_URL` | url | `""` | URL publique CDN du bucket (`https://pub-...r2.dev`) |
| `MAX_UPLOAD_SIZE` | int64 | `524288000` (500 MB) | Limite taille fichier upload |
| `UPLOAD_TIMEOUT` | int (s) | `600` (10 min) | Timeout requêtes upload |

### Frontend (Next.js — `.env.local`)
| Variable | Type | Rôle |
|----------|------|------|
| `NEXT_PUBLIC_API_URL` | url | Base URL backend (ex: `https://api.esportnews.fr` ou `http://localhost:4000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | string | Clé publique Stripe pour Checkout |

---

## 5) Backend Go — Services

Tous les services vivent dans `backend-go/internal/services/`. Convention : un service par responsabilité métier, injection de dépendances par constructeur, état partagé protégé par mutex/sync.

### 5.1 `LiquipediaService` — Client HTTP central
**Fichier** : `liquipedia_service.go`

Responsabilité unique : **toutes** les communications HTTP avec Liquipedia passent par ce service. Personne d'autre n'instancie un `http.Client` vers `api.liquipedia.net`.

Fonctionnalités principales :
* **Client HTTP** : timeout 30 s, User-Agent obligatoire, header `Authorization: Apikey <key>`, IPv4 forcé sur `api.liquipedia.net` (Railway/Docker n'ont pas d'IPv6 → sinon Happy Eyeballs ajoute 3 s par requête ; désactivable via `LIQUIPEDIA_DISABLE_IPV4`).
* **Concurrence sortante** : 1 seul appel HTTP en vol à la fois (sémaphore global) + espacement optionnel `LIQUIPEDIA_MIN_REQUEST_INTERVAL_MS` — l'API a un burst limit et une limite par IP en plus du quota horaire.
* **Cap de taille réponse** : 20 MB ; un dépassement n'est JAMAIS caché (fallback stale) pour éviter de servir du JSON tronqué.
* **Sélection de champs** : les requêtes match/tournament passent `query=<json tags des structs>` (`LiqMatchQueryFields`/`LiqTournamentQueryFields`) — divise la taille des payloads par 3-10×.
* **`RequestBudget` par wiki** : compteur in-memory + persistance Redis (`liq:budget:<wiki>:<YYYYMMDDHH>`). Reset à chaque heure pleine. **Survit aux redémarrages** dans l'heure courante.
* **Backoff sur 429** : 5 min → 10 → 20, capé à 30 min. Reset automatique à l'heure suivante. N'épuise PAS le budget horaire (seul le timer de backoff bloque, puis expire).
* **Stale-while-revalidate** : à chaque écriture fraîche, une copie est stockée avec le suffixe `:stale` (TTL 6 h). En cas d'erreur ou budget épuisé, on retourne le stale plutôt qu'une erreur.
* **Singleflight** : N requêtes concurrentes pour la même clé cache → 1 seul appel API (`golang.org/x/sync/singleflight`). Le fetch partagé tourne sur un contexte détaché (35 s) — l'annulation du premier caller ne fait pas échouer les autres.
* **Méthode publique principale** : `MakeRequest(ctx, wiki, endpoint, params, cacheKey, ttl)` — fait tout le cycle (cache hit / singleflight / budget / HTTP / cache write).
* **Helpers métier** : `SearchTeams`, `GetTeamByPageID`, `GetTeamByTemplate`, `GetTeamsByPageIDs`, `GetTeamDetailByPageID`, `FetchBatchSquadPlayers`, `FetchTeamMatches`, `FetchTeamPlacements`, `MapAcronymToWiki`, `GetBudgetStatus`, `ParseResponse`.

Constructeur : `NewLiquipediaService(apiKey, budgetPerWiki, redisCache, logger)`. `budgetPerWiki <= 0` retombe sur `defaultBudgetLimitPerWiki = 1000`.

### 5.2 `LiquipediaPoller` — Background sync
**Fichier** : `liquipedia_poller.go`

Lance, au boot, une goroutine par wiki (10 wikis = 10 goroutines) + 1 goroutine `consumeDirtyFlags`.

Chaque goroutine de wiki :
1. **Phase 1 — Warmup** : attend son slot (`wikiIdx × WarmupStaggerInterval = 20s`, donc 0/20/40/60... secondes), puis fait 6 appels (1 par type) espacés de `WarmupIntraDelay = 2s`. Total : ~12 s pour warmup d'un wiki.
2. **Phase 2 — Polling régulier** : 6 tickers, un par type :

| Type | Intervalle | TTL associée | req/h |
|------|------------|--------------|-------|
| `matches_running` | 8 min | 10 min | 7.5 |
| `matches_upcoming` | 20 min | 22 min | 3 |
| `matches_past` (7 derniers jours) | 45 min | 50 min | 1.3 |
| `tournaments_running` | 20 min | 22 min | 3 |
| `tournaments_upcoming` | 30 min | 35 min | 2 |
| `tournaments_finished` (30 derniers jours) | 90 min | 100 min | 0.7 |
| **Total background** | | | **~17.5 req/wiki/h** |

> **Note** : Ces intervalles ont été calibrés pour un quota de 60 req/wiki/h. Avec le quota actuel de **1000 req/wiki/h**, il reste **~982 req/h libres** par wiki pour les requêtes on-demand (détails de match, recherche d'équipes, etc.). Les intervalles n'ont volontairement pas été serrés pour rester conservateur pendant la phase de stabilisation.

**Mode dirty-flags** : si `LIQUIPEDIA_WEBHOOKS_ENABLED=true`, les tickers se déclenchent toujours mais ne refresh que si `safetyMultiplier × intervalle` s'est écoulé (filet de sécurité). Les vrais refresh sont déclenchés par `consumeDirtyFlags` (toutes les 2 min) en lisant les `DirtyFlag` du `DirtyTracker`.

### 5.3 `LiquipediaReader` — Lecture cache pour callers internes
**Fichier** : `liquipedia_reader.go` (créé dans cette session)

Méthodes haut niveau attachées à `*LiquipediaService` pour les callers internes (scheduler notamment) :

* `MatchesByStatus(ctx, gameAcronym, status)` — Lit le cache du poller (running/upcoming/past). **Cache-only**, ne fait JAMAIS d'appel Liquipedia. Retourne `[]NormalizedMatch` ou `ErrUnknownGame`.
* `TournamentMatches(ctx, gameAcronym, tournamentID)` — Lookup en 2 étapes (pageid → pagename → matchs) via `MakeRequest` (cache-aside + budget + singleflight + stale).

Pourquoi un module séparé : découple le `NotificationScheduler` du layout cache Redis. Si demain les clés `liq:*` changent, seuls `liquipedia_reader.go` et le poller sont touchés.

### 5.4 `DirtyTracker` — Webhook → poller bus
**Fichier** : `liquipedia_poller.go` (struct `DirtyTracker`)

Map thread-safe `wiki → *DirtyFlag` avec champs booléens (`MatchesRunning`, `MatchesUpcoming`, `MatchesPast`, `Tournaments`, `Teams`).

* `MarkDirty(event)` : appelé depuis `WebhookHandler` quand un webhook arrive. Convertit l'event Liquipedia en flags (namespace -10 = teams, namespace 0 = tout sauf teams).
* `GetAndResetDirty()` : appelé par `consumeDirtyFlags` du poller toutes les 2 min. Atomique (lock + swap).
* **Debounce** : N webhooks pour le même wiki dans l'intervalle = 1 seul refresh batch.

### 5.5 `NotificationScheduler` — Push notifications Expo
**Fichier** : `notification_scheduler.go`

Goroutine background avec 3 tickers :
| Ticker | Fréquence | Job |
|--------|-----------|-----|
| `mainTicker` | 60 s | `processMatchNotifications` — pour chaque `match_subscription` non encore notifié, vérifie si le match est passé en running dans Redis → envoie push "Match en direct" via Expo → marque `notified_start=true`. Détecte aussi les reschedules (changement de `begin_at`). |
| `cleanupTicker` | 30 min | Supprime les `match_subscription`/`tournament_subscription` finis depuis +7 jours. |
| `hydrationTicker` | 10 min | Pour chaque `tournament_subscription` actif, lit les matchs du tournoi via `LiquipediaReader.TournamentMatches`, crée les `match_subscription` manquantes. Déduplique les fetches par tournoi. |

Activable via `NOTIFICATION_SCHEDULER_ENABLED` (cf. section 4).

### 5.6 `ExpoPushService` — Dispatch Expo
**Fichier** : `expo_push.go`

Wrapper autour de l'API Expo Push (`https://exp.host/--/api/v2/push/send`). Méthode `SendBatch(ctx, messages)` retourne la liste des tokens invalides (à désactiver dans `push_token`).

### 5.7 Autres services (référence rapide)

| Service | Rôle | DB | Cache |
|---------|------|----|----|
| `AuthService` | Signup, login, JWT, refresh tokens, change password, delete account | GORM `users` | `auth:jwt:*`, `auth:refresh:*` |
| `GameService` | Liste statique des 10 jeux | GORM `games` | `cache:games` |
| `ArticleService` | CRUD articles, recherche full-text, similaires | GORM `articles` | `cache:articles:*` |
| `AdService` | CRUD bannières publicitaires | GORM `ads` | `cache:ads` |
| `StorageService` | Upload R2 (S3-compatible) | – | – |
| `StripeService` | Checkout, webhooks, portail customer, abonnements | GORM `users` (`stripe_*`) | – |
| `EmailService` | Envoi Resend | – | – |
| `IAPService` | Validation receipts Apple/Google, sync subscription_status | GORM `users` (`iap_*`) | – |
| `IAPValidationScheduler` | Re-validation quotidienne des receipts IAP | GORM `users` | – |
| `AnalyticsService` | Page views, stats visiteurs, exports | GORM `page_views` | – |
| `TeamService` | Wrapper autour de `LiquipediaService.SearchTeams` + favoris GORM | GORM `users` (`favorite_teams`) | `liq:team:*`, `liq:teams:search:*` |
| `MatchService` | (Legacy — wrapper minimal autour de `LiquipediaService`) | – | `liq:matches:*` |
| `TournamentService` | (Legacy — wrapper minimal autour de `LiquipediaService`) | – | `liq:tournaments:*` |

---

## 6) Backend Go — Handlers & routes HTTP

Tous les handlers sont enregistrés dans `cmd/server/main.go` sous le préfixe `/api`. Les routes admin sont sous le sous-groupe `apiGroup.Group("")` avec middleware `RequireAdmin(authService)`.

### Public — Health & utilitaires
| Méthode | Route | Handler | Description |
|---------|-------|---------|-------------|
| `GET` | `/health` | inline | Health check `{ "status": "ok" }` |
| `OPTIONS` | `/api/*` | inline | Preflight CORS |
| `GET` | `/api/proxy/image` | `image_proxy.go` | Proxy image (Liquipedia → assets, contournement CORS frontend) |

### Auth (`auth.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/auth/signup` | – | Création de compte (email + password) |
| `POST` | `/api/auth/login` | – | Login → JWT |
| `GET` | `/api/auth/me` | JWT | Profil de l'utilisateur courant |
| `POST` | `/api/auth/me` | JWT | Mise à jour du profil |
| `POST` | `/api/auth/avatar` | JWT | Upload avatar (URL) — web |
| `POST` | `/api/auth/avatar/upload` | JWT | Upload avatar (fichier multipart) — mobile |
| `DELETE` | `/api/auth/avatar` | JWT | Supprimer l'avatar |
| `POST` | `/api/auth/change-password` | JWT | Changer le mot de passe |
| `POST` | `/api/auth/logout` | JWT | Logout (révoque le refresh token) |
| `POST` | `/api/auth/refresh` | – | Renouvelle le JWT |
| `DELETE` | `/api/auth/account` | JWT | Suppression définitive du compte |

### Games (`games.go`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/games` | Liste des 10 jeux supportés |
| `GET` | `/api/games/:id` | Jeu par ID |
| `GET` | `/api/games/acronym/:acronym` | Jeu par acronyme |

### Articles (`articles.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/articles` | – | Liste paginée |
| `GET` | `/api/articles/search` | – | Full-text search |
| `GET` | `/api/count-articles` | – | Compte total (pour pagination) |
| `GET` | `/api/articles/:slug` | – | Article par slug |
| `GET` | `/api/articles/:slug/similar` | – | Articles similaires (tags) |
| `POST` | `/api/articles/:slug/view` | – | Incrémente le compteur de vues |
| `POST` | `/api/admin/articles` | Admin | Créer un article |
| `GET` | `/api/admin/articles` | Admin | Liste admin (incluant brouillons) |
| `GET` | `/api/admin/articles/:id` | Admin | Détail admin |
| `PUT` | `/api/admin/articles/:id` | Admin | Modifier |
| `DELETE` | `/api/admin/articles/:id` | Admin | Supprimer |
| `POST` | `/api/admin/articles/upload-cover` | Admin | Upload featured image vers R2 |
| `POST` | `/api/admin/articles/upload-content` | Admin | Upload image dans le contenu vers R2 |

### Ads (`ads.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/ads` | – | Liste des bannières actives (cache Redis 1h) |
| `POST` | `/api/admin/ads` | Admin | Créer (max 3 positions) |
| `GET` | `/api/admin/ads` | Admin | Liste admin |
| `GET` | `/api/admin/ads/:id` | Admin | Détail |
| `PUT` | `/api/admin/ads/:id` | Admin | Modifier |
| `DELETE` | `/api/admin/ads/:id` | Admin | Supprimer |
| `POST` | `/api/admin/ads/upload` | Admin | Upload image vers R2 |

### Matches (`matches.go`)
| Méthode | Route | Description | Source |
|---------|-------|-------------|--------|
| `GET` | `/api/live` | Alias de `/matches/running` (compat historique) | Cache Redis |
| `GET` | `/api/matches/running` | Matchs en direct | Cache Redis |
| `GET` | `/api/matches/upcoming` | Matchs à venir | Cache Redis |
| `GET` | `/api/matches/past` | Matchs récents (7 derniers jours) | Cache Redis |
| `POST` | `/api/matches/by-date` | Matchs d'une date précise (body form-encoded : `date=YYYY-MM-DD&game=acronyme`) | Cache-aside (Liquipedia on-demand) |
| `GET` | `/api/matches/:id` | Détail d'un match | Cache-aside |

Query params communs : `game=valorant` (acronyme), `limit`, `offset`, `sort=date|-date`.

### Tournaments (`tournaments.go`)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/tournaments` | Tournois en cours (par défaut) |
| `GET` | `/api/tournaments/all` | Tous les tournois en cours, sans filtre tier |
| `GET` | `/api/tournaments/upcoming` | Tournois à venir |
| `GET` | `/api/tournaments/finished` | Tournois terminés (30 derniers jours) |
| `GET` | `/api/tournaments/filtered` | Avec filtres `game`, `status`, `filter[tier]` |
| `GET` | `/api/tournaments/:id` | Détail tournoi |
| `POST` | `/api/tournaments/by-date` | Tournois d'une date (form-encoded) |

### Teams (`teams.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/teams/search?q=` | – | Recherche d'équipes (parallèle sur 10 wikis) |
| `GET` | `/api/teams/by-template?wiki=&template=` | – | Équipe par shortname |
| `GET` | `/api/teams/:id` | – | Équipe par pageid |
| `GET` | `/api/teams/:id/detail` | – | Détails enrichis (roster, achievements) |
| `GET` | `/api/teams/:id/matches?type=recent\|upcoming` | – | Matchs récents/à venir de l'équipe |
| `GET` | `/api/teams/:id/placements` | – | Placements en tournoi |
| `GET` | `/api/users/favorite-teams` | JWT | Équipes favorites (enrichies depuis Liquipedia) |
| `GET` | `/api/users/favorite-teams/ids` | JWT | Juste les IDs (rapide) |
| `POST` | `/api/users/favorite-teams/:teamId` | JWT | Ajouter aux favoris |
| `DELETE` | `/api/users/favorite-teams/:teamId` | JWT | Retirer des favoris |

### Notifications (`notifications.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/notifications/preferences` | JWT | Préférences (push, articles, news, matchs) |
| `PATCH` | `/api/notifications/preferences` | JWT | Mise à jour groupée |
| `POST` | `/api/notifications/:type/toggle` | JWT | Toggle individuel par type |

### Subscriptions matchs/tournois (`subscription_match_handler.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/push-tokens` | JWT | Enregistre un token Expo (`ExponentPushToken[xxx]`) |
| `DELETE` | `/api/push-tokens` | JWT | Désinscrit un token |
| `GET` | `/api/subscriptions/matches` | JWT | Liste des abonnements matchs |
| `GET` | `/api/subscriptions/matches/ids` | JWT | Juste les match_id |
| `POST` | `/api/subscriptions/matches/:matchId` | JWT | S'abonner à un match |
| `DELETE` | `/api/subscriptions/matches/:matchId` | JWT | Se désabonner |
| `GET` | `/api/subscriptions/tournaments` | JWT | Liste des abonnements tournois |
| `GET` | `/api/subscriptions/tournaments/ids` | JWT | Juste les tournament_id |
| `POST` | `/api/subscriptions/tournaments/:tournamentId` | JWT | S'abonner à un tournoi |
| `DELETE` | `/api/subscriptions/tournaments/:tournamentId` | JWT | Se désabonner |

### Stripe (`subscription_handler.go`, `stripe_webhook_handler.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/subscriptions/checkout` | JWT | Crée une session Stripe Checkout |
| `GET` | `/api/subscriptions/status` | JWT | Statut de l'abonnement |
| `GET` | `/api/subscriptions/portal` | JWT | URL Stripe Customer Portal |
| `POST` | `/api/webhooks/stripe` | Signature | Webhook Stripe (events checkout/subscription) |

### IAP mobile (`iap_handler.go`, `apple_webhook_handler.go`, `google_webhook_handler.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/subscriptions/iap/validate` | JWT | Validation receipt App Store / Play Store |
| `POST` | `/api/webhooks/apple` | JWS | App Store Server Notifications V2 |
| `POST` | `/api/webhooks/google` | Token | Google Play Real-Time Developer Notifications (via Pub/Sub) |

### Analytics (`analytics.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/analytics/track` | – | Tracking page view (IP, UA, referer) |
| `GET` | `/api/analytics/visitors` | Admin | Stats visiteurs |
| `GET` | `/api/analytics/registrations` | Admin | Inscriptions par jour |
| `GET` | `/api/analytics/summary` | Admin | Résumé global |
| `GET` | `/api/analytics/export` | Admin | Export CSV |
| `GET` | `/api/analytics/age-distribution` | Admin | Distribution par âge |

### Webhooks Liquipedia (`webhooks.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/webhooks/liquipedia` | `X-Webhook-Secret` ou `?secret=` | LiquipediaDB → DirtyTracker → poller refresh |

### Admin monitoring (inline dans `main.go`)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/admin/api-budget` | Admin | Budget Liquipedia par wiki + total — `{ budgets: {...}, total_used, total_limit }` |

---

## 7) Backend Go — Models

### Modèles GORM (persistance PostgreSQL)

#### `User` — `users`
Source de vérité utilisateur. Tous les handlers passent par GORM ici.

Champs clés : `id`, `email` (unique), `password` (jamais exposé), `avatar`, `admin`, `age`, `favorite_teams` (`int[]`), `notifi_push`, `notif_articles`, `notif_news`, `notif_matchs`, `premium`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `iap_platform`, `iap_product_id`, `iap_transaction_id`, `iap_original_transaction_id`, `iap_expires_at`.

> **Note** : Il existait historiquement une seconde table `public.users` accédée via pgxpool. **Cette voie est dépréciée** — tous les handlers actuels (`NotificationHandler`, `TeamHandler`, `AuthHandler`) utilisent GORM sur `public.users`.

#### `Article` — `articles`
Champs : `id`, `slug` (unique), `tags` (`text[]`), `title`, `views`, `author`, `content` (markdown ?), `article_content` (HTML brut moderne), `category`, `subtitle`, `description`, `content_black`/`content_white` (variants thème), `featuredImage`, `videoUrl`, `videoType`, `credit`.

#### `Ad` — `ads`
Champs : `id`, `title`, `position` (1-3), `type` (`image`|`video`), `url` (R2), `redirect_link`.

#### `MatchSubscription` — `match_subscription`
Champs : `id`, `user_id`, `match_id` (ID Liquipedia volatile), `game_acronym`, `match_name`, `tournament_name`, `begin_at`, `status` (`upcoming`|`running`|`finished`|`canceled`), `notified_start`, `notified_schedule`, `from_tournament` (nullable : non-null si auto-créé via `tournament_subscription`).
Contrainte unique : `(user_id, match_id)`.

#### `TournamentSubscription` — `tournament_subscription`
Champs : `id`, `user_id`, `tournament_id` (ID Liquipedia volatile), `game_acronym`, `tournament_name`, `begin_at`, `end_at`, `status`.
Contrainte unique : `(user_id, tournament_id)`.

#### `PushToken` — `push_token`
Champs : `id`, `user_id`, `token` (unique, format `ExponentPushToken[xxx]`), `platform` (`ios`|`android`), `active`.

### Modèles Liquipedia (parsing API v3)

#### `LiqMatch` (`liquipedia_match.go`)
~37 champs reflétant la réponse brute de Liquipedia (`pageid`, `pagename`, `bestof`, `dateexact`, `finished`, `winner`, `match2opponents`, `match2games`, `stream`, etc.).

`NormalizedMatch` (`liquipedia_match.go` également) : version aplatie compatible avec le frontend (format historiquement compatible avec l'ancien `PandaMatch`).
Helpers : `m.HasTwoNamedOpponents()`, `m.UniqueKey()`, `NormalizeLiqMatch(liqMatch, wiki, statusHint) NormalizedMatch`.

#### `LiqTournament` (`liquipedia_tournament.go`)
~27 champs. `NormalizedTournament` + `NormalizedMatchCompact` (entrées de la liste matchs d'un tournoi).
Helper : `NormalizeLiqTournament(liqTournament, wiki) NormalizedTournament`.

#### `LiqTeam`, `LiqSquadPlayer`, `LiqPlacement` (`team.go`)
Modèles équipes/joueurs/placements. Normalizers :
* `NormalizeLiqTeam(team, wiki, players) NormalizedTeam`
* `NormalizeLiqTeamDetail(team, wiki, players) EnrichedTeamDetail`
* `NormalizeLiqSquadPlayers(players) []NormalizedPlayer`
* `NormalizeLiqPlacement(p) NormalizedPlacement`

#### `LiquipediaResponse`, `LiquipediaWebhookEvent`, `GameWikiMapping`, `WikiToAcronym` (`liquipedia.go`)
Wrappers techniques + mapping acronymes ↔ wikis.

### Convention de nommage frontend
Le frontend conserve les noms `PandaMatch`, `PandaTournament` dans `frontend/app/types/index.ts` — héritage historique, **kept untouched** pour éviter un refactor blast-radius. Ces types sont **compatibles** avec les `Normalized*` du backend.

---

## 8) Cache Redis

Patterns centralisés dans `backend-go/internal/cache/patterns.go`. Toutes les clés sont accédées via les helpers (jamais en raw `fmt.Sprintf`).

### Clés non-Liquipedia (préfixe `cache:` ou autres)

| Clé | TTL | Source | Invalidation |
|-----|-----|--------|--------------|
| `cache:games` | – | `GameService` | Sur reload manuel |
| `cache:games:<id>` | – | `GameService` | – |
| `cache:articles:<slug>` | – | `ArticleService.GetBySlug` | CREATE/UPDATE/DELETE article |
| `cache:articles:similar:<slug>` | – | `ArticleService.GetSimilar` | idem |
| `cache:articles:search:<sha1(query)>:<category>:<bool>:<limit>` | – | `ArticleService.Search` | wildcard `cache:articles:search:*` purgé sur CUD |
| `cache:ads` | 1h | `AdService.List` | CUD via `/api/admin/ads/*` |
| `cache:teams:<id>` | – | (cache rapide id-only) | – |
| `cache:user:favorites:<id>` | – | – | – |
| `auth:jwt:<token_id>` | 7j (JWT exp) | `AuthService` | Logout |
| `auth:refresh:<user_id>` | 30j | `AuthService` | Logout/refresh |
| `ratelimit:<ip>` | sliding window | `RateLimitMiddleware` | – |

### Clés Liquipedia (préfixe `liq:`)

| Pattern | Helper | TTL | Source d'écriture |
|---------|--------|-----|-------------------|
| `liq:matches:running:<wiki>` | `LiqMatchesRunningKey` | 10 min | Poller (8 min) ou webhook dirty |
| `liq:matches:upcoming:<wiki>` | `LiqMatchesUpcomingKey` | 22 min | Poller (20 min) ou webhook dirty |
| `liq:matches:past:<wiki>` | `LiqMatchesPastKey` | 50 min | Poller (45 min) ou webhook dirty |
| `liq:matches:date:<wiki>:<YYYY-MM-DD>` | `LiqMatchesByDateKey` | 6h (passé) / 10 min (auj.+futur) | On-demand (cache-aside) |
| `liq:match:<wiki>:<id>` | `LiqMatchKey` | 5 min ou 24h (finished) | On-demand |
| `liq:tournaments:running:<wiki>` | `LiqTournamentsRunningKey` | 22 min | Poller (20 min) |
| `liq:tournaments:upcoming:<wiki>` | `LiqTournamentsUpcomingKey` | 35 min | Poller (30 min) |
| `liq:tournaments:finished:<wiki>` | `LiqTournamentsFinishedKey` | 100 min | Poller (90 min) |
| `liq:tournaments:date:<wiki>:<date>` | `LiqTournamentsByDateKey` | 10 min | On-demand |
| `liq:tournament:<wiki>:<id>` | `LiqTournamentKey` | 10 min | On-demand (`GET /tournaments/:id`) |
| `liq:tournament:matches:<wiki>:<pagename>` | `LiqTournamentMatchesKey` | 10 min | On-demand (hydration scheduler) |
| `liq:tournament:squads:<wiki>:<pagename>` | `LiqTournamentSquadsKey` | 10 min | On-demand |
| `liq:teams:search:<wiki>:<query>` | `LiqTeamSearchKey` | 30 min | On-demand (`/teams/search`) |
| `liq:team:<wiki>:<id\|template>` | `LiqTeamKey` | 6h | On-demand |
| `liq:team:squad:<wiki>:<pagename>` | `LiqTeamSquadKey` | 6h | On-demand |
| `liq:team:matches:recent:<wiki>:<template>` | `LiqTeamMatchesRecentKey` | 15 min | On-demand |
| `liq:team:matches:upcoming:<wiki>:<template>` | `LiqTeamMatchesUpcomingKey` | 15 min | On-demand |
| `liq:team:placements:<wiki>:<name>` | `LiqTeamPlacementsKey` | 1h | On-demand |
| `liq:wikihint:<id>` | `LiqWikiHintKey` | 24h | Écrit quand un user consulte un tournoi/match (sert à retrouver le wiki depuis l'ID) |
| `liq:budget:<wiki>:<YYYYMMDDHH>` | `RequestBudget.budgetRedisKey` | 1h + 2min | `RequestBudget.RecordRequest` (best-effort) |
| `<any_above>:stale` | `StaleKey` | 6h | Copie auto à chaque écriture via `MakeRequest` |

### Règle d'or
**Aucun handler HTTP ne fait d'appel direct à Liquipedia.** Soit il lit le cache, soit il passe par `LiquipediaService.MakeRequest` (qui gère cache-aside + budget + singleflight + stale).

---

## 9) Base de données PostgreSQL

### Tables persistantes (8)
1. **`users`** — Comptes + préférences notifications + Stripe + IAP
2. **`games`** — Référence des 10 jeux (alimentée via back-office)
3. **`articles`** — Contenu éditorial
4. **`ads`** — Bannières publicitaires (max 3 positions)
5. **`notifications`** — Préférences notifications (legacy ? — coexiste avec colonnes `notif_*` sur `users`)
6. **`match_subscription`** — Abonnements push aux matchs (GORM)
7. **`tournament_subscription`** — Abonnements push aux tournois (GORM)
8. **`push_token`** — Tokens Expo par device (GORM)
9. **`page_views`** — Analytics (IP, UA, referer, timestamp, url)

### Tables supprimées (historique)
* ~~`tournaments`~~ — données en cache Redis (source Liquipedia)
* ~~`matches`~~ — idem
* ~~`games_pandascore`~~ — idem

### Migrations
Fichiers SQL dans `backend-go/migrations/` :
```
00000_init_user.sql              — création du user PostgreSQL
00000_init.sh                    — script d'init (extensions)
00001_initial_schema.sql         — schéma initial
00001a_add_age_to_users.sql
00001b_add_stripe_fields_to_users.sql
00002_users.sql                  — seed users (admin initial)
00003_games.sql                  — seed 10 jeux
00004_ads.sql                    — schéma ads
00005_add_article_content.sql
00006_add_credit_to_articles.sql
00007_import_articles.sql        — seed initial articles (47 articles)
00009_create_page_views.sql
00010_notifications.sql
00011_page_views.sql
00012_add_iap_fields_to_users.sql
00013_articles_search.sql        — index GIN pour full-text search
```

> Les tables GORM (`match_subscription`, `tournament_subscription`, `push_token`) sont créées par **AutoMigrate** au démarrage du backend, pas par les migrations SQL.

### Seeding des articles
Script Go dédié : `backend-go/cmd/seed/main.go` + `internal/seed/articles.go`.

```bash
docker compose exec -T backend ./seed --data=initial_data/articles_rows.json
```

* Source JSON : `backend-go/initial_data/articles_rows.json` (export Supabase, 47 articles)
* Idempotent : `ON CONFLICT (slug) DO NOTHING`
* Flags : `--dry-run`, `-v` (verbose)

### Politique de rétention
* **Persistantes** (users, articles, ads, …) : pas de suppression auto. Soft-delete si besoin.
* **Volatiles** (matchs, tournois, équipes) : aucune rétention DB, uniquement cache Redis.
* **Cleanup auto** : `NotificationScheduler.cleanupStaleSubscriptions` supprime les subscriptions finished/canceled depuis +7 jours.

---

## 10) Intégration Liquipedia API v3

### Connexion
* **Base URL** : `https://api.liquipedia.net/api/v3`
* **Auth** : header `Authorization: Apikey <LIQUIPEDIA_API_KEY>`
* **User-Agent** : obligatoire — `EsportNews/1.0 (contact@esportnews.fr)`
* **Rate limit** : **1000 requêtes par wiki (jeu) par heure** (depuis juin 2026 ; 60 avant)
* **Format réponse** : `{ "result": [ ...objets... ] }`

### Mapping jeux → wikis
Voir section 1 (tableau des 10 jeux). Source : `models.GameWikiMapping` (acronyme → wiki) et `models.WikiToAcronym` (inverse).

### Endpoints utilisés
* `GET /match?wiki=X&conditions=...` — Liste de matchs (poller + on-demand)
* `GET /tournament?wiki=X&conditions=...` — Liste de tournois
* `GET /team?wiki=X&conditions=...` — Liste/recherche d'équipes
* `GET /squadplayer?wiki=X&conditions=[[pagename::...]]` — Roster d'une équipe (par pagename OR batch)
* `GET /placement?wiki=X&conditions=[[opponentname::...]]` — Placements en tournoi

### Conditions API (langage de query Liquipedia)
Format `[[field::value]]`, combiné avec `AND` et `OR`.

Exemples utilisés :
* Matchs running : `[[finished::0]] AND [[dateexact::1]] AND [[date::<cutoff]] AND [[date::>past_cutoff]]`
* Matchs upcoming : `[[finished::0]] AND [[dateexact::1]] AND [[date::>now]]`
* Matchs past (7j) : `[[finished::1]] AND [[date::>cutoff_7days_ago]]`
* Tournois running : `[[status::!finished]] AND [[startdate::<tomorrow]] AND [[enddate::>yesterday]]`
* Détail match : `[[pageid::<id>]]`
* Recherche équipe par template : `[[template::<shortname>]]`
* Matchs d'une équipe : `[[opponent::<teamTemplate>]] AND [[finished::1]]` (recent) ou `AND [[date::>now]]` (upcoming)

### Quotas et fallback
* Budget par wiki tracké par `RequestBudget` (in-memory + Redis).
* Si budget épuisé : `getStaleOrError` → retourne le cache `:stale` (TTL 6h) ou erreur 503.
* Sur 429 : backoff exponentiel (5/10/20 min, cap 30 min) + reset à l'heure pleine.

### Monitoring
```
GET /api/admin/api-budget   (JWT admin requis)

{
  "budgets": {
    "valorant": { "wiki": "valorant", "used": 17, "limit": 1000, "remaining": 983, "resets_at": "..." },
    "leagueoflegends": { ... },
    ...
  },
  "total_used": 170,
  "total_limit": 10000
}
```

---

## 11) Webhooks Liquipedia

### Vue d'ensemble
LiquipediaDB peut envoyer un POST à notre backend chaque fois qu'une page est éditée/supprimée/déplacée/purgée. Le backend marque la wiki concernée comme "dirty" et le poller fait un refresh ciblé au prochain tick (2 min).

### Configuration côté LiquipediaDB
Dashboard LiquipediaDB → Webhooks → Webhook #49. **Le dashboard ne permet de régler qu'une URL + un commentaire** : aucun header custom, aucune signature dans le payload. Le secret voyage donc **dans l'URL en query param** (`?secret=`) — c'est le seul moyen d'authentifier les livraisons réelles.
* **URL** : `https://www.blitchapp.online/api/webhooks/liquipedia?secret=<LIQUIPEDIA_WEBHOOK_SECRET>` (preview) ou `https://www.esportnews.fr/api/webhooks/liquipedia?secret=<...>` (prod, à venir)
* **Events** : `edit`, `delete`, `move`, `purge`

### Payload reçu
```json
{
  "page": "Match:Vitality_vs_Heroic",
  "from_page": "...",            // si event=move
  "namespace": 0,                 // 0 = main, -10 = teamtemplates
  "from_namespace": 0,            // si event=move
  "wiki": "counterstrike",
  "event": "edit"
}
```

### Côté backend
1. **Validation** : `crypto/subtle.ConstantTimeCompare` sur le header `X-Webhook-Secret` (tests manuels curl) puis, si absent, sur le query param `secret` (livraisons réelles LiquipediaDB). Si `LIQUIPEDIA_WEBHOOK_SECRET=""`, validation désactivée (dev uniquement).
2. **Parsing** : `models.LiquipediaWebhookEvent`
3. **Mark dirty** : `DirtyTracker.MarkDirty(event)` (thread-safe). Namespace -10 = teams only, sinon = matches + tournaments.
4. **Réponse** : `HTTP 200` (vide, immédiat — le refresh est async).

### Consumer
`LiquipediaPoller.consumeDirtyFlags` toutes les 2 min :
* Lit `dirtyTracker.GetAndResetDirty()` (atomique)
* **Cooldown par wiki+type** (`dirtyRefreshGate`) : un type ne se refetch pas plus souvent que la moitié de son intervalle de polling (running 4 min, upcoming 10 min, past 22.5 min, tournaments 10 min) — borne le coût webhook à ~2× le polling aveugle au lieu de 10×.
* Les events `Main_Page` (purges automatiques des wikis) sont ignorés dès le handler.
* Flag `Teams` (namespace -10) : invalide `liq:teams:search:<wiki>:*` au lieu de refetcher.

### Mode activation
* `LIQUIPEDIA_WEBHOOKS_ENABLED=true` → consumer actif + tickers en mode "safety net" (refresh seulement si `3× intervalle` écoulé).
* `LIQUIPEDIA_WEBHOOKS_ENABLED=false` → polling aveugle aux intervalles fixes (Scenario B).

### Test manuel
```bash
curl -i -X POST https://www.blitchapp.online/api/webhooks/liquipedia \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <secret>" \
  -d '{"page":"Test","namespace":0,"wiki":"valorant","event":"edit"}'
# Attendu : HTTP 200 (body vide)
```

Logs attendus côté backend :
```
[WEBHOOK] ✅ Received and accepted — marking dirty   wiki=valorant
[DIRTY] Consuming dirty flags — triggering targeted refresh
[REFRESH] Starting   type=matches_running   wiki=valorant
[REFRESH] ✅ Success — data cached
```

---

## 12) Notification Scheduler (push Expo)

### Vue d'ensemble
Background goroutine qui :
1. Détecte les matchs qui passent en live → push "Match en direct"
2. Détecte les reschedules (changement de `begin_at`) → met à jour la subscription
3. Crée automatiquement les `match_subscription` pour les abonnés tournois (hydration)
4. Purge les subscriptions vieilles de +7 jours

### Démarrage
Wired dans `cmd/server/main.go:231-242`. Conditionné par `cfg.NotificationSchedulerEnabled` (`NOTIFICATION_SCHEDULER_ENABLED=true` par défaut).

```go
if cfg.NotificationSchedulerEnabled {
    notifScheduler := services.NewNotificationScheduler(gormDB, liquipediaService, expoPushService, logger)
    go notifScheduler.Start(schedulerCtx)
    logger.Info("Notification scheduler started")
} else {
    logger.Info("Notification scheduler disabled (NOTIFICATION_SCHEDULER_ENABLED=false)")
}
```

**Important** : doit être `false` sur l'env preview parce que la DB est partagée avec la prod. Sans ça, prod + preview enverraient chacun leur push → notifications dupliquées et race conditions sur `match_subscription.notified_start`.

### Architecture interne
Voir `notification_scheduler.go` :

* `Start(ctx)` lance 3 tickers (60s, 30 min, 10 min)
* `processMatchNotifications` (60s) :
  - Charge max 500 `match_subscription` non encore notifiées (`status IN ('upcoming', 'running') AND notified_start = false`)
  - Groupe par `game_acronym`
  - Pour chaque jeu : `liqService.MatchesByStatus(ctx, gameAcronym, MatchStatusRunning)` → map `match_id → NormalizedMatch`
  - Pour chaque sub : si le match est dans la map running, envoie push + flag `notified_start=true` + status=`running`
  - Détecte les reschedules : si `match.BeginAt` (RFC3339) ≠ `sub.BeginAt` → update
  - Batch send via `ExpoPushService.SendBatch` → désactive les tokens invalides retournés par Expo
* `cleanupStaleSubscriptions` (30 min) — supprime les subs `status IN ('finished', 'canceled') AND created_at < now - 7j`
* `hydrateTournamentMatches` (10 min) :
  - Charge tous les `tournament_subscription` actifs
  - Pour chaque tournoi unique : `liqService.TournamentMatches(ctx, gameAcronym, tournamentID)` (avec dédup via `matchesByTournament` map)
  - Pour chaque match du tournoi : crée la `match_subscription` correspondante si elle n'existe pas (avec `from_tournament=tournamentID`)

### Push token lifecycle
* User signup → frontend mobile demande un push token Expo → `POST /api/push-tokens`
* Backend stocke dans `push_token` (unique sur `token`)
* Expo renvoie des tokens invalides dans la réponse `SendBatch` → `deactivateTokens` flips `active=false`

### Préférences notifs
`User.NotifiPush` (push global) + `User.NotifMatches` (matchs spécifiquement). `userWantsMatchNotifs(userID)` retourne true si les deux sont true.

---

## 13) Frontend Next.js

### Structure
```
frontend/
├── app/
│   ├── HomePageClient.tsx        — Page d'accueil (live matches + actus + ads)
│   ├── components/               — Composants partagés (Navbar, AdColumn, LiveMatchCard, ...)
│   ├── lib/                      — Utilitaires (imageUtils, API client, helpers i18n)
│   ├── types/index.ts            — Types TypeScript (PandaMatch, PandaTournament — héritage)
│   ├── store/                    — RTK store + slices
│   ├── article/[slug]/           — Page article
│   ├── match/                    — Page matchs avec calendrier 11 cases
│   ├── tournaments/              — Liste tournois
│   ├── teams/                    — Liste équipes + détail
│   ├── admin/                    — Back-office (articles, ads, stats, analytics)
│   ├── account/                  — Profil utilisateur, préférences
│   └── auth/                     — Pages login/signup
├── next.config.ts                — Config Next + images.remotePatterns
└── package.json
```

### API client
Centralisé dans `frontend/app/lib/api.ts` (axios + intercepteurs JWT). RTK Query services par domaine (`matchesApi`, `tournamentsApi`, `articlesApi`, ...).

### Images autorisées
`frontend/app/lib/imageUtils.ts` maintient la liste `ALLOWED_IMAGE_HOSTS` qui doit rester en sync avec `next.config.ts` → `images.remotePatterns` :
* `olybccviffjiqjmnsysn.supabase.co` (héritage images Supabase, en cours de migration vers R2)
* `pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev` (Cloudflare R2)
* `i.postimg.cc` (images externes admin)

Les images Liquipedia passent par le **proxy backend** (`/api/proxy/image`) pour contourner CORS.

### i18n
5 langues : `fr`, `en`, `es`, `de`, `it`. Fichiers de traduction par page/composant.

### Détection mobile vs desktop
Layout responsive Tailwind. Important : **éviter le basculement prématuré vers tablet** quand on réduit la fenêtre depuis desktop.

---

## 14) Mobile App (Expo)

### Stack
* Expo + React Native
* Push notifications via Expo
* In-App Purchases (StoreKit iOS / Play Billing Android)
* Sécurité : pas de stockage de password, JWT en `expo-secure-store`

### Endpoints spécifiques mobile
* `POST /api/auth/avatar/upload` (multipart)
* `POST /api/push-tokens` (enregistrement Expo token)
* `POST /api/subscriptions/iap/validate`

### Doc spécifique
`mobile-app/docs/PROGRESS.md` (peut être obsolète sur la partie data sources).

---

## 15) Déploiement Railway (prod + preview)

### Deux projets Railway

| Projet | Frontend | Backend | DB | Redis | Domain |
|--------|----------|---------|----|----|--------|
| **Prod** | Vercel (esportnews.fr) | Railway prod | Supabase (partagée) | Railway prod | `https://www.esportnews.fr` |
| **Preview R&D** | (pas de frontend dédié) | Railway preview | **Supabase (même qu'en prod)** | Railway preview | `https://www.blitchapp.online` (custom domain en cours) + `https://app-esportnews-preview-production.up.railway.app` |

### Variables d'environnement clés par env

**Prod** (Railway → projet prod → Settings → Variables) :
```
LIQUIPEDIA_API_KEY=<secret>
LIQUIPEDIA_BUDGET_PER_WIKI=1000
LIQUIPEDIA_WEBHOOKS_ENABLED=true        # à activer quand prêt
LIQUIPEDIA_WEBHOOK_SECRET=<random prod>
NOTIFICATION_SCHEDULER_ENABLED=true
DATABASE_URL=<Supabase pooler>
REDIS_URL=<Railway Redis>
JWT_SECRET=<random>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=<Stripe webhook>
APPLE_IAP_*, GOOGLE_IAP_* (production keys)
CLOUDFLARE_R2_*
```

**Preview** (Railway → projet preview → Settings → Variables) :
```
LIQUIPEDIA_API_KEY=<same as prod>
LIQUIPEDIA_BUDGET_PER_WIKI=1000
LIQUIPEDIA_WEBHOOKS_ENABLED=true
LIQUIPEDIA_WEBHOOK_SECRET=<random preview, different from prod>
NOTIFICATION_SCHEDULER_ENABLED=false    # CRUCIAL — DB partagée
DATABASE_URL=<same as prod — Supabase pooler>
REDIS_URL=<Railway Redis preview>
JWT_SECRET=<same as prod si les sessions doivent être valides cross-env>
... (Stripe et IAP idéalement en test/sandbox)
```

### Custom domain Railway
1. Railway → projet → Settings → Networking → Custom Domain
2. Ajouter le domaine (ex `www.blitchapp.online`)
3. Railway donne un CNAME cible
4. Chez le registrar DNS : créer le CNAME (sans proxy Cloudflare)
5. Attendre 1-5 min → Railway provisionne le cert Let's Encrypt automatiquement

### Port
Railway injecte `PORT=8080`. Le backend Go lit `cfg.Port = getEnv("PORT", "4000")` donc s'adapte automatiquement.

### IPv4 forcé
Important sur Railway : `LiquipediaService` force IPv4 sur `api.liquipedia.net` parce que Railway/Docker n'ont pas d'IPv6 et Happy Eyeballs ajoute 3 s par requête sinon.

---

## 16) Procédures opérationnelles courantes

### Changer le quota Liquipedia
1. Updater `LIQUIPEDIA_BUDGET_PER_WIKI` dans Railway (ou `.env` en dev)
2. Redéployer le backend
3. Vérifier dans les logs au boot : `[BUDGET] Initial budget status at startup limit=<nouvelle valeur>`
4. Optionnellement, ré-équilibrer les `PollInterval*` dans `liquipedia_poller.go` si on veut profiter du quota (actuellement intervalles calibrés pour 60 req/h, conservés malgré le bump à 1000).

### Désactiver le scheduler sur preview
```
NOTIFICATION_SCHEDULER_ENABLED=false
```
Redémarrer. Logs : `Notification scheduler disabled (NOTIFICATION_SCHEDULER_ENABLED=false)`.

### Activer les webhooks Liquipedia
1. Générer un secret : `openssl rand -hex 32`
2. Setter `LIQUIPEDIA_WEBHOOK_SECRET=<secret>` + `LIQUIPEDIA_WEBHOOKS_ENABLED=true` dans Railway
3. Redéployer
4. Configurer le webhook côté dashboard LiquipediaDB (URL + commentaire uniquement, pas de header possible) :
   - URL : `https://<domain>/api/webhooks/liquipedia?secret=<secret>`
   - Events : edit, delete, move, purge
5. Tester avec un edit de page → logs : `[WEBHOOK] ✅ Received and accepted`

### Ajouter un nouveau jeu
1. Ajouter l'entrée dans `models.GameWikiMapping` (`backend-go/internal/models/liquipedia.go`)
2. Migration SQL pour insérer la ligne dans `games` (acronyme, nom, images selected/unselected)
3. Le poller le détectera automatiquement au prochain restart (10 → 11 wikis = 11 goroutines)
4. Frontend : ajouter le jeu dans la liste statique d'icônes
5. Vérifier le quota : 11 wikis × 1000 = 11 000 req/h total

### Seed des articles initiaux
```bash
docker compose exec -T backend ./seed --data=initial_data/articles_rows.json
```
Idempotent (`ON CONFLICT (slug) DO NOTHING`).

### Debug un webhook qui ne marche pas
1. `curl -i -X POST ...` direct contre l'URL Railway interne (`*.up.railway.app`) → confirme que le backend reçoit
2. Si 200 OK → problème côté DNS/cert du custom domain
3. Si 403 → secret côté backend != secret côté LiquipediaDB
4. Si 404 → route pas enregistrée (`webhookHandler.RegisterRoutes(apiGroup)` dans `main.go`)
5. Si timeout → backend offline ou nginx route pas vers le backend

### Vider le cache Liquipedia (purge complète)
```bash
# Via redis-cli (depuis le conteneur Redis Railway)
redis-cli -u <REDIS_URL> KEYS 'liq:*' | xargs redis-cli -u <REDIS_URL> DEL
```
**Attention** : redémarre le warmup au prochain boot (~3.3 min total pour 10 wikis).

### Monitorer le budget API
```bash
curl -H "Authorization: Bearer <jwt_admin>" \
  https://www.esportnews.fr/api/admin/api-budget | jq
```

---

## 17) Historique de migration

### Migrations terminées
| Étape | Avant | Après | Statut |
|-------|-------|-------|--------|
| Backend | Node.js (`/backend/api`) | Go (`/backend-go`) | ✅ |
| DB | Supabase hosted | Supabase managed (toujours) | ✅ |
| Déploiement | Vercel (full-stack) | Vercel (frontend) + Railway (backend) | ✅ |
| Source data esport | PandaScore + SportDevs | Liquipedia API v3 | ✅ |
| Tables DB esport | `tournaments`, `matches`, `games_pandascore` | Cache Redis uniquement | ✅ |

### Migration PandaScore → Liquipedia — Phases (toutes complètes)
| Phase | Description |
|-------|-------------|
| 0 | Nettoyage code PandaScore/SportDevs |
| 1 | Fondation Liquipedia (service HTTP, budget, poller, webhooks) |
| 2 | Matchs (LiqMatch, 5 endpoints, poller conditions) |
| 3 | Tournois (LiqTournament, 7 endpoints) |
| 4 | Équipes/joueurs (LiqTeam, LiqSquadPlayer, search parallel, favoris) |
| 5 | Live/streams (validation carousel, normalisation streams) |
| 6 | Documentation |
| Post | Activation webhooks + variable d'env budget + scheduler toggle + cleanup frontend (juin 2026) |

> Les docs de planification par phase (`docs/phase*.md`) et `docs/strategie-rate-limiting.md` ont été supprimés une fois la migration terminée (prémisse obsolète « 60 req/h », statuts périmés). **La référence technique à jour est `docs/liquipedia.md`** (état des lieux + architecture complète) ; cette section §10-11 en donne la vue d'ensemble.

### Décisions clés
* **Garder les noms de types `PandaMatch`/`PandaTournament` sur le frontend** : refactor blast-radius énorme pour zéro bénéfice utilisateur. Les `Normalized*` du backend sont construits compatibles.
* **Aucune table DB pour les matchs/tournois** : Liquipedia est la source, Redis le cache. Pas de réplication, pas de divergence.
* **Quota augmenté 60 → 1000** (juin 2026) : permet 16× plus de marge pour les requêtes on-demand. Polling intervals conservés pour rester conservateur.
* **Webhooks + polling en parallèle** : webhooks pour la fraîcheur, polling comme filet de sécurité (refresh forcé si `3× intervalle` écoulé sans webhook).

---

## 18) Pages spécifiques

### 18.1 Page Match (`/match`)
> Remplace l'ancienne route `/live`.

**Calendrier 11 cases** :
* Jour actuel toujours centré (case 6/11)
* Navigation par flèches gauche/droite (offset de 11 jours)
* Date sélectionnée en `bg-[#F22E62]`
* Jour actuel : `bg-bg-tertiary` + bordure rose
* Format : `lun 2 jan` (3 lettres jour + numéro + 3 lettres mois)

**Filtres** :
* Par date (`POST /api/matches/by-date` avec `date=YYYY-MM-DD&game=<acronyme>`)
* Par jeu (`GameSelector` sticky en desktop, accordion en mobile)
* Combinables

**Recherche modale (⌘K)** :
* Style identique à la page Articles
* Modale plein écran `98vw × 90vh`
* 1 match par ligne (`grid-cols-1`)
* Filtre multi-critères : nom, équipe, tournoi, ligue, jeu

**Filtrage automatique** : n'affiche que les matchs avec **2 opponents définis** (`match.opponents.length >= 2 && opponent.name présent`).

**Traductions** :
* `pages_detail.match.title` : Matchs / Matches / Partidos / Spiele / Partite
* `pages_detail.match.prev_dates`, `next_dates`, `today`, `no_matches`

**Composant principal** : `frontend/app/match/MatchPageClient.tsx`. Service : `matchService.getMatchesByDate(date, gameAcronym)`. **Important** : utiliser `URLSearchParams` (pas `FormData`) pour le body, `Content-Type: application/x-www-form-urlencoded`.

#### Politique 404 sur entités absentes (SEO — pas de redirect)
Les pages détail `match/[id]` et `tournois/[id]` **fetchent côté serveur** et appellent `notFound()` (vrai HTTP 404) quand le backend renvoie 404 — jamais de soft-404 (HTTP 200 + contenu "non trouvé"), qui garderait l'URL indexée. **Aucun redirect** : il n'existe aucun mapping ancien ID PandaScore (numérique) → ID Liquipedia, donc on laisse les vieilles URLs indexées tomber proprement en 404 (Google dé-indexe). **404 uniquement sur un 404 explicite du backend** : une erreur transitoire (timeout/réseau) laisse rendre le client pour ne pas dé-indexer une entité valide. Côté backend, `GET /api/matches/:id` **skip le scan on-demand 10-wikis pour un ID numérique** (un `match2id` Liquipedia est alphanumérique ; un ID numérique ne peut être qu'un `pageid` déjà couvert par le cache, ou un vieil ID PandaScore) → 404 immédiat, budget API préservé.

### 18.2 Panel Admin — Gestion des publicités (`/admin/ads`)

**Auth** : JWT + `admin=true` sur l'utilisateur.

**Fonctionnalités CRUD** :
* Liste avec preview, position, type, lien
* Création : titre, position (1-3), type (image/video), upload image vers R2, lien de redirection
* Modification (cache invalidé après update)
* Suppression (avec confirmation, hard delete)

**Stockage R2** :
* Path : `ads/images/`
* Nommage : `{timestamp}-{random}.{ext}`
* URL : `https://pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev/ads/images/{filename}`

**Affichage frontend** :
* `AdBanner` : pub individuelle (Next/Image, hover overlay, clic ouvre `redirect_link` en `_blank` `noopener,noreferrer`)
* `AdColumn` : colonne droite desktop (max 3 pubs)
* `AdSkeleton` : loading state
* Cache Redis `cache:ads` 1h, invalidé à chaque CUD

**Validation** :
* Backend Go : position 1-3 strict, type ∈ `{image, video}`, url + redirect_link required
* Timeout upload 10 min (`UPLOAD_TIMEOUT`)
* `MAX_UPLOAD_SIZE` : 500 MB par défaut

**Important** :
* ✅ Utiliser `<Image>` Next.js (CORS géré via proxy interne, optimisation auto)
* ❌ Ne pas utiliser `<img>` standard avec URLs R2 (CORS si pas configuré côté R2)

### 18.3 Page détail de match — architecture modulaire par jeu

**Fichiers** : `frontend/app/match/_components/`
```
matchSections.ts                    — registre : SECTION_IDS + PRESETS + PRESET_BY_WIKI
MatchDetailPageClient.tsx           — shell : resolveSections(wiki) → renderSection(id)
sections/
├── shared.tsx                      — MatchSectionProps, TeamLogo, SectionHeader, helpers
├── MatchHeader.tsx, GameResults.tsx, DraftPanel.tsx, PlayerStatsTable.tsx,
│   StreamPlayer.tsx, RostersPanel.tsx, ExternalStatsLinks.tsx   — sections génériques
├── draft.ts, statColumns.ts        — parsing draft + config colonnes stats par wiki
└── valorant/                       — ⚠️ un dossier par jeu à rendu custom
    ├── ValorantGameCards.tsx       — bloc par map : hero + draft + scoreboard
    └── valorantAssets.ts           — mapping statique nom → UUID valorant-api.com
```

**Principe** : chaque wiki mappe vers un preset (liste ordonnée de sections). Une section rend `null` si ses données manquent. Un jeu qui mérite un rendu custom reçoit **son propre dossier** sous `sections/<jeu>/` + son preset ; les sections génériques ne bougent pas. Preset `valorant` : `gameResults` (branché sur `ValorantGameCards`) embarque draft + stats **par map** → pas de sections `draft`/`playerStats` séparées ni de sélecteur « Game N ». La section `matchInfo` (IDs internes) a été supprimée partout.

**Design system Valorant (référence esthétique à décliner pour les autres jeux)** :
* **Bloc par game** = carte « map hero » + panneau attaché dessous (draft + stats de CETTE map).
* **Map hero** : splash de la map en fond full-bleed (~132px desktop, `object-cover`, zoom `scale-105` au hover 700ms) + **dégradé latéral** (bords `#060B13` ~96% → centre ~25%) + léger voile vertical. Scores `text-5xl font-black tabular-nums` : gagnant en accent + `drop-shadow` glow rose, perdant `text-white/45` et côté à `opacity-50`. **Liseré vertical 3px accent côté gagnant** (live : liseré + badge pulsants couleur live). Nom de map au centre en capitales `tracking-[0.25em]` entre deux traits. Game à venir : carte réduite (~84px), splash `grayscale opacity-50`, « À venir ».
* **Draft** : tuiles d'agents (portrait carré ~44px arrondi, dégradé navy en fond, nom en dessous 8px uppercase, hover bordure accent + scale) — home à gauche, away à droite, « VS » discret au centre.
* **Scoreboard** (façon vlr.gg) : un tableau par équipe, header logo + acronyme, portrait d'agent à côté du joueur, tri **ACS décroissant**, colonnes K/D/A séparées, **+/- calculé (K−D)** vert/rose selon signe, KAST arrondi en %, texte 13px, zebra rows. Côte à côte en `xl:` seulement.
* **Header de match épuré** : pills réduites (statut + BO + rescheduled), scoreboard central, une seule ligne d'info (tournoi + date + badge Liquipedia en fin). Fond : splash de la map de la game 1 en **grayscale `opacity-[0.16]`** + dégradé vertical fondu vers `--color-bg-primary` (jeux sans assets : fond uni actuel).
* **Équipes cliquables partout** : bloc logo + nom = `<Link>` via `teamHref()` (`lib/gameLinks.ts`), hover nom → accent. Le score reste hors du lien.

**Assets externes par jeu** (CDN publics, pas de CORS, hotlink prévu — mapping statique nom → id dans `<jeu>Assets.ts`, fallback null → dégradé navy, rien ne casse) :
| Jeu | Source | Contenu |
|-----|--------|---------|
| Valorant | `media.valorant-api.com` (via valorant-api.com) | maps (splash/listview/minimap), 29 agents (displayicon/portraits), abilités |
| LoL | Data Dragon (`ddragon.leagueoflegends.com`) | splashs champions (non versionnés), portraits/sorts/items (versionnés `DDRAGON_VER` dans `lolAssets.ts`), items par NOM → id via `item.json` fetché lazy 1× (module cache) |
| CS2 | GitHub raw (`ghostcap-gaming/cs2-map-images`) | screenshots officiels des maps 1920×1080 (mapping statique + fallback `de_<slug>` dans `csAssets.ts`) |
| Dota 2 (à faire) | Steam CDN (`cdn.steamstatic.com`) | héros, items |

**Spécificités LoL** (`sections/leagueoflegends/`, preset `lol` = même forme que valorant) : pas de variété de maps → **hero = duel de champions** (splash du champion clé de chaque équipe — meilleur impact KDA/dégâts — fondus au centre, côté perdant `grayscale brightness-75`) ; gros chiffres = **kills d'équipe** (le score de game 1-0 n'a pas d'intérêt visuel) ; pastille side **bleu/rouge** (`extradata.teamNside`) à côté de l'acronyme ; bande d'**objectifs comparés** en chips (tours/dragons/barons/hérauts/larves/atakhan/inhibiteurs, valeur dominante en gras teintée par side) ; draft = picks (ordre de rôle top→sup) + **bans barrés** en tuiles réduites grayscale ; scoreboard façon op.gg (portrait champion + 2 sorts + rôle, K/D/A coloré, KP%, CS, or, dégâts, **build d'items en icônes** `lg:` only). `parseDraft` (partagé) lit aussi les clés numérotées `teamNbanK`/`teamNchampionK` (format LoL/Dota). Backdrop du header = splash du champion clé de la game 1 (`lolHeaderBackdrop`).

**Spécificités CS2** (`sections/counterstrike/`, preset `cs`) : **aucune stat joueur sur Liquipedia** (les modules Lua CS2 n'implémentent pas `getPlayersOfMapOpponent` — ADR/KAST/rating vivent sur HLTV, accessible via `match.links` → section `externalLinks`). Le max de data = **strip de veto** au-dessus du détail des games (`MapVetoStrip` : chaque étape du veto en carte 16/11 avec screenshot ; bans en **grayscale + nom barré + « BAN »**, picks en couleur avec **logo d'équipe + « Pick · ACR »**, decider en ambre) + blocs par map (hero screenshot + score en rounds + **mi-temps CT/T en chips** colorées par side : CT `sky-400`, T `orange-400`, depuis `extradata.tNhalfs`/`tNsides`, OT gérées). Le `mapveto` (ordre ban/pick/decider, `team1`/`team2`/`decider` = noms de maps) est extrait de `extradata.mapveto` côté backend (`NormalizedMatch.MapVeto`, tolérant array **et** objet à clés numériques — format Lua) ; il n'est renseigné que sur les gros tournois → la strip se cache sinon. `flattenVeto` (testé) déplie les rounds où les deux équipes agissent.

Les images de **joueurs pros** n'existent dans aucune de ces APIs (Liquipedia les a mais pas via l'API v3 → coût quota, non implémenté).

**Pour ajouter un rendu custom à un jeu** : 1) créer `sections/<jeu>/` avec `<jeu>Assets.ts` (mapping statique) et le composant de blocs par game, 2) brancher dans `GameResults.tsx` (test sur `match.wiki`), 3) ajouter le preset dans `matchSections.ts`, 4) décliner les éléments du design system ci-dessus (hero d'arène/champ de bataille, tuiles de picks, scoreboard aux colonnes du jeu via `statColumns.ts`).

---

## 19) Conventions de travail

### Code Go
* **Pas de commentaires WHAT** (le code se lit) ; commentaires WHY uniquement quand non-obvious (workaround, contrainte cachée, invariant subtil).
* **Pas de docstrings multi-paragraphes**, une ligne max.
* **Pas d'erreur handling défensif** pour des cas qui ne peuvent pas arriver. Trust the framework.
* **Pas de feature flags / shims rétrocompat** : changer le code directement.
* **Pas de helpers prématurés** : 3 lignes similaires > abstraction prématurée.

### Git
* **Branches** : `liquipedia` (branche de R&D actuelle). `main` = prod, à puller manuellement.
* **Commits atomiques** : 1 commit = 1 changement logique. Découper via `git add -p` au besoin.
* **Messages** : convention `type(scope): description courte` + corps explicatif (Conventional Commits-ish).
  - Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`
  - Scope : `backend`, `frontend`, `mobile`, `infra`, `claude`
* **Pas de `--no-verify`** : si un hook bloque, comprendre pourquoi, ne pas contourner.
* **`gofmt -w`** systématique avant commit (sinon la CI peut râler).

### Données
* **Aucune donnée fictive** sauf demande explicite de l'utilisateur.
* **Aucune donnée esport en DB** : matchs/tournois/équipes vivent uniquement dans Redis.
* **Demander les endpoints API** si besoin d'en consommer un nouveau (cf. section 6 pour les existants).

### Tooling Claude
* **Tâches simples** : éditer directement, pas de plan ni todos
* **Tâches multi-steps** : TodoWrite obligatoire, mise à jour en temps réel
* **Pas de fichiers .md de planning/decisions** : la conversation suffit
* **Pas d'emojis** sauf demande explicite
* **Toujours valider `go build ./...` avant commit**

### Sécurité
* **JWT_SECRET, STRIPE_SECRET_KEY, LIQUIPEDIA_*_SECRET, GOOGLE_WEBHOOK_TOKEN** : jamais en clair dans les logs, jamais en clair dans le code
* **Comparaisons de secrets** : `crypto/subtle.ConstantTimeCompare` (cf. `webhooks.go`, `google_webhook_handler.go`, `stripe_webhook_handler.go`)
* **Webhook validation** : signature/secret obligatoire en prod, désactivable uniquement en dev local
* **Aucun cookie tiers**, aucun tracking comportemental
* **Mots de passe** : bcrypt cost 10, jamais retournés dans une réponse JSON (`json:"-"`)
* **CORS** : whitelist stricte (origines précises + `*-esport-news.vercel.app` pour les previews Vercel)

## 20) Notifications Push (Mobile App)

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

## 21) Publicités AdMob (Mobile App)

> ⚠️ Distinct des **bannières internes** (site web, table `ads`, `/api/ads`, `AdColumn`/`AdBanner`, gérées au back-office). Ici = pubs **interstitielles AdMob** dans l'app mobile via `react-native-google-mobile-ads`.

* **Init** : `app/_layout.tsx` (`mobileAds().initialize()` + ATT iOS via `expo-tracking-transparency`).
* **IDs (publics, embarqués dans le binaire, par plateforme)** — dans `app.config.js` :
  - App ID iOS : `ca-app-pub-5118678813787741~6090534381`
  - App ID Android : `ca-app-pub-5118678813787741~6893939034`
  - Interstitiel : `ca-app-pub-5118678813787741/1903877366`
* **Dev vs prod** : `getInterstitialAdUnitId()` (dans `contexts/AdContext.tsx` et `hooks/useAdPopup.ts`) → `TestIds.INTERSTITIAL` si `__DEV__` (Expo Go/`expo run`, fill 100 %), sinon `Constants.expoConfig.extra.admobInterstitialId`.
* **⚠️ Piège prod (env non uploadé à EAS)** : les vrais IDs sont dans le **`.env` racine gitignoré**, chargé par `app.config.js` via `dotenv`. **EAS cloud respecte `.gitignore` → `.env` n'est PAS uploadé** → `process.env.ADMOB_*` undefined au build → ce sont les **fallbacks `|| "..."` de app.config.js qui partent en prod**. ⇒ **Ces fallbacks doivent TOUJOURS valoir les vrais IDs prod.** (Bug initial : fallback iOS = App ID Android → AdMob refusait de servir.)
* **Déclenchement** : `useAdPopup({ skipIfSubscribed, isSubscribed })` — cooldown 5 min (`adCooldownService`), `requestNonPersonalizedAdsOnly: true`, skip pour abonnés Premium. Écrans index/match/tournoi/article.
* **Gap connu** : consentement UMP/GDPR (`AdsConsent`) **non implémenté** (`requestConsent()` = placeholder) → risque de no-fill EEA (France). Les nouvelles apps/units AdMob peuvent aussi no-fill quelques heures à ~2 j (warm-up).

## 22) Build & Release Mobile (EAS)

* **Profils** (`mobile-app/eas.json`) : `production` (AAB iOS/Android, `autoIncrement` du **build number**, API prod), `preview` (APK installable, distribution interne, **API prod**), `development`.
* **Versioning** : `appVersionSource: "remote"` → EAS gère le **build number** (`autoIncrement`). La **version marketing** (`CFBundleShortVersionString`) vient de `version` dans `app.config.js`.
  - **⚠️ App Store** : on ne peut pas re-soumettre sous une version déjà publiée (erreurs `ITMS-90186` train fermé / `ITMS-90062` version pas supérieure). → **bumper `version`** dans `app.config.js` (ex. `1.0.0` → `1.0.1`) avant un nouveau build iOS.
* **Play Console** exige un **`.aab`** (pas d'APK) en production → profil `production`. L'APK `preview` sert au test device uniquement.
* Commandes : `eas build --platform <ios|android> --profile production` puis (iOS) `eas submit --platform ios --profile production` ou upload manuel du `.aab` (Android).
* `npx` est réécrit en `npm` par un hook local → utiliser les binaires directs (`./node_modules/.bin/expo`, etc.) pour les commandes scriptées.

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.
