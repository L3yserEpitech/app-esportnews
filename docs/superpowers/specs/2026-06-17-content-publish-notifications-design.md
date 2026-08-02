# Notifications « nouvel article / nouvelle news » — Design

**Date:** 2026-06-17
**Statut:** Validé (design), prêt pour le plan d'implémentation

## Objectif

Envoyer une notification push à **tous les utilisateurs opt-in** dès qu'un nouvel
article ou une nouvelle news est publié(e) depuis le back-office, pour avoir du
contenu « en temps réel » dans l'app.

## Contexte / état existant (vérifié dans le code)

- **« News » = un article avec `category == "Actus"`** ; « article » = toute autre
  catégorie. Les deux sont créés par le **même** endpoint admin
  `POST /admin/articles` → `ArticleHandler.CreateArticle` → `ArticleService.CreateArticle`.
  L'insert est immédiatement live (pas d'état brouillon). C'est donc un point de
  déclenchement unique pour les deux.
- L'infra push existe déjà : `ExpoPushService.SendBatch` (Expo → APNs/FCM, chunks
  de 100), tokens dans la table `push_token` (`active = true`).
- Les colonnes de préférence existent **déjà** et sont câblées dans l'API de prefs
  (`internal/handlers/notifications.go`) mais **ne sont utilisées par aucun envoi** :
  `notif_articles`, `notif_news`, master `notifi_push`.
- Le handler de tap notification mobile (`app/_layout.tsx`) ne connaît aujourd'hui
  que `data.type === 'match_start'`. L'écran article est `/article/[slug]`.
- Table utilisateurs réelle = **`users`** (`models.User.TableName()` → `"users"`).
  On suit le code, pas la note CLAUDE.md §2bis (`public.user`) qui est contredite
  par le code en place.
- Le seeding (`./seed`) insère via GORM en direct, **sans** passer par
  `CreateArticle` → ne déclenchera donc aucune notification (comportement voulu).

## Décisions produit (validées)

| Sujet | Décision |
|---|---|
| Wording article | Titre **« Nouvel article »**, corps = titre de l'article |
| Wording news | Titre **« Nouvelle news »**, corps = titre de la news |
| Style | Sans emoji, sobre, cohérent avec la notif match existante |
| Opt-in | **Deux toggles séparés** : `notif_articles` gate « Nouvel article », `notif_news` gate « Nouvelle news ». Le master `notifi_push` doit aussi être ON dans les deux cas. |
| Tap | Ouvre l'article (`/article/[slug]`) |
| Langue | **FR-only** en V1 (comme la notif match actuelle, hardcodée FR) |

## Approche retenue : fire-on-create + garde d'idempotence

Approche **A** : on déclenche le broadcast directement dans le flux de création,
en temps réel. Une colonne `notified_at` sur `articles` sert de garde
d'idempotence (et de base pour un futur bouton « Renotifier »).

Rejetées : (B) scheduler poll 60s — résilient mais latence + state à tracker ;
(C) hybride complet — sur-ingénierie pour le besoin actuel.

## Conception détaillée

### 1. Déclenchement (`ArticleHandler.CreateArticle`)

Après que `h.service.CreateArticle()` réussit, lancer le broadcast dans une
**goroutine** avec `recover()` anti-crash, pour que la réponse HTTP à l'admin
reste instantanée.

La goroutine tourne sur un `context.WithTimeout(context.Background(), 30s)`
**propre** — **jamais** le `ctx` de la requête Echo, qui est annulé dès que la
réponse HTTP part (sinon l'envoi est coupé en plein vol).

### 2. Nouveau service `ContentNotificationService`

Fichier : `internal/services/content_notification_service.go`.

Constructeur : `NewContentNotificationService(gormDB interface{}, pushService *ExpoPushService, logger *logrus.Logger)`
— réutilise le **même** `expoPushService` que le scheduler.

Méthode : `NotifyNewContent(ctx context.Context, article *models.Article)` :

1. `isNews := article.Category != nil && *article.Category == "Actus"`.
2. Sélection (fonction pure testable `buildContentNotification`) :
   - news → titre `"Nouvelle news"`, colonne `notif_news`, `data.type = "new_news"`
   - article → titre `"Nouvel article"`, colonne `notif_articles`, `data.type = "new_article"`
   - corps = `*article.Title` (skip si titre vide/nil)
   - `data.slug = *article.Slug`
3. **Garde d'idempotence** : ne rien faire si `article.NotifiedAt != nil`.
4. Récupère les tokens en **une requête JOIN** :
   ```sql
   SELECT pt.token FROM push_token pt
   JOIN users u ON u.id = pt.user_id
   WHERE pt.active = true
     AND u.notifi_push = true
     AND u.<notif_articles|notif_news> = true
   ```
   La colonne provient d'une **allowlist fixe** (pas d'input utilisateur) → zéro
   risque d'injection.
5. Construit **un `ExpoPushMessage` par token** (`To: []string{token}`). Raison :
   l'actuel `sendChunk` indexe `messages[idx]` pour mapper les tickets d'erreur ;
   un mapping ticket↔message 1:1 garde la désactivation `DeviceNotRegistered`
   précise (un `To` multi-tokens casserait cet indexage).
   - `Title` = titre choisi, `Body` = titre du contenu
   - `Sound = "default"`, `ChannelId = "content-updates"`, priorité **normale**
     (contenu non urgent, contrairement au match-start qui est `high`)
   - `Data = { type, slug }`
6. `pushService.SendBatch()` (déjà chunké à 100 msg/requête) → désactive les
   tokens invalides retournés (même logique que le scheduler).
7. Stamp `articles.notified_at = now()` (best-effort, après la tentative d'envoi).

### 3. DB — colonne `notified_at`

- Champ modèle : `NotifiedAt *time.Time` sur `models.Article`
  (`gorm:"column:notified_at"`).
- Migration prod : SQL **idempotent** dans le bloc « always migrate » de
  `internal/database/gorm.go` :
  ```sql
  ALTER TABLE articles ADD COLUMN IF NOT EXISTS notified_at timestamptz
  ```
  (Pas d'`AutoMigrate` sur tout le modèle `Article` legacy en prod — risqué.)

### 4. Câblage `cmd/server/main.go`

- Déplacer la création de `expoPushService` **avant** la construction du
  `articleHandler` (actuellement ligne 215 vs 176).
- Créer `contentNotifier := services.NewContentNotificationService(gormDB, expoPushService, logger)`.
- L'injecter dans `NewArticleHandlerWithService(...)` (nouveau paramètre + champ
  dans le struct `ArticleHandler`).

### 5. Mobile (OTA-shippable — pas de rebuild natif requis)

La création de canal et le deep-link sont du JS runtime → diffusables en
`eas update` (OTA), pas besoin d'`eas build`.

- `utils/notifications.ts` : créer un **2ᵉ canal Android `content-updates`** en
  importance **DEFAULT** (moins agressif que `match-alerts`/HIGH). Dégrade
  proprement sur les anciennes versions (fallback canal par défaut).
- `app/_layout.tsx` : étendre le listener —
  `if (data.type === 'new_article' || data.type === 'new_news') router.push('/article/' + data.slug)`.

### 6. Tests

- Test unitaire de la fonction pure `buildContentNotification` (sélection
  titre/type/colonne selon `category`, corps = titre, news vs article), façon
  `article_service_test.go`.

## Gestion des erreurs

- Aucun token correspondant → no-op + log.
- `SendBatch` en erreur → log, pas de crash ; `notified_at` est stampé après la
  tentative (best-effort, pas de retry — tradeoff assumé de l'approche A).
- Panic dans la goroutine → `recover()` + log, le serveur ne tombe pas.

## Performance / scalabilité

Le broadcast scale linéairement : ≈ `ceil(N_tokens / 100)` requêtes Expo
séquentielles (timeout 10s chacune). OK pour la base actuelle. Si la base devient
très grosse → migrer vers une approche scheduler/queue (approche B).

## Hors scope V1 (notés)

- **Multi-langue** : notif FR-only (cohérent avec la notif match). I18n =
  amélioration future.
- **« Renotifier » manuel** et **checkbox « ne pas notifier »** à la création :
  non implémentés (« à chaque fois » → toujours). `notified_at` pose les bases si
  besoin plus tard.
- **File/queue** : pas en V1.
