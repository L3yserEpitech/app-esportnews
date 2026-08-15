# Notifications « nouvel article / nouvelle news » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer une notification push à tous les utilisateurs opt-in dès qu'un nouvel article ou une nouvelle news est publié(e) depuis le back-office.

**Architecture:** Fire-on-create — `ArticleHandler.CreateArticle` lance, après l'insert, un broadcast en goroutine (contexte propre, `recover()` anti-crash) via un nouveau `ContentNotificationService` qui réutilise `ExpoPushService`. Une colonne `articles.notified_at` sert de garde d'idempotence. Côté mobile, un canal Android `content-updates` + un deep-link `/article/[slug]`.

**Tech Stack:** Go 1.22 / Echo / GORM / PostgreSQL ; Expo Push (APNs/FCM) ; Expo / React Native (mobile).

**Spec:** `docs/superpowers/specs/2026-06-17-content-publish-notifications-design.md`

> ⚠️ **Commits / branche :** le repo est sur `main`. Avant d'exécuter, créer une branche (`git checkout -b feat/content-publish-notifications`). Ne pousser/ouvrir une PR **que** si Jules le demande explicitement.

> ℹ️ **Rappel hook mobile :** `npx` est réécrit en `npm` par un hook local → utiliser les binaires directs (`./node_modules/.bin/...`) pour les commandes scriptées.

---

## File Structure

**Backend (`backend-go/`)**
- Create `internal/services/content_notification_service.go` — service de broadcast + fonction pure `buildContentNotification`.
- Create `internal/services/content_notification_service_test.go` — test de la fonction pure.
- Modify `internal/models/article.go` — ajoute le champ `NotifiedAt *time.Time`.
- Modify `internal/database/gorm.go` — `ALTER TABLE articles ADD COLUMN IF NOT EXISTS notified_at` idempotent.
- Modify `internal/handlers/articles.go` — champ `contentNotifier`, nouveau param du constructeur, déclenchement dans `CreateArticle`.
- Modify `cmd/server/main.go` — câblage (créer `expoPushService` plus tôt + `contentNotifier`, l'injecter dans le handler).

**Mobile (`mobile-app/`)**
- Modify `utils/notifications.ts` — canal Android `content-updates`.
- Modify `app/_layout.tsx` — deep-link tap → `/article/[slug]`.

---

## Task 1: Colonne d'idempotence `notified_at`

**Files:**
- Modify: `backend-go/internal/models/article.go:33` (après le champ `Credit`)
- Modify: `backend-go/internal/database/gorm.go:96` (après le bloc « new tables » AutoMigrate)

Changement structurel (pas de test unitaire — vérifié par le build au Task 6).

- [ ] **Step 1: Ajouter le champ au modèle**

Dans `internal/models/article.go`, ajouter le champ juste après `Credit *string ... json:"credit"` (ligne 33), avant la `}` de fermeture du struct :

```go
	Credit         *string        `json:"credit"`
	NotifiedAt     *time.Time     `json:"notified_at,omitempty" gorm:"column:notified_at"`
```

`time` est déjà importé dans ce fichier (utilisé par `CreatedAt`).

- [ ] **Step 2: Ajouter la migration idempotente**

Dans `internal/database/gorm.go`, juste après le `log.Info("New table migrations completed ...")` (ligne 96), insérer :

```go
	// Idempotently add the content-notification guard column to the legacy
	// articles table (AutoMigrate runs on the full Article model only in dev).
	if err := db.Exec(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS notified_at timestamptz`).Error; err != nil {
		return nil, fmt.Errorf("failed to add articles.notified_at column: %w", err)
	}
	log.Info("articles.notified_at column ensured")
```

`fmt` est déjà importé dans `gorm.go` (utilisé par les `fmt.Errorf` voisins).

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend-go && go build ./internal/...`
Expected: build OK, aucune erreur.

---

## Task 2: Fonction pure `buildContentNotification` (TDD)

**Files:**
- Create: `backend-go/internal/services/content_notification_service.go`
- Test: `backend-go/internal/services/content_notification_service_test.go`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `internal/services/content_notification_service_test.go` :

```go
package services

import (
	"testing"

	"github.com/esportnews/backend/internal/models"
)

// cnStr is a local string-pointer helper (unique name to avoid colliding with
// helpers in the other *_test.go files of this package).
func cnStr(s string) *string { return &s }

func TestBuildContentNotification(t *testing.T) {
	tests := []struct {
		name      string
		article   *models.Article
		wantOK    bool
		wantTitle string
		wantPref  string
		wantType  string
		wantBody  string
	}{
		{
			name:      "news category Actus",
			article:   &models.Article{Title: cnStr("Karmine Corp recrute"), Category: cnStr("Actus")},
			wantOK:    true,
			wantTitle: "Nouvelle news",
			wantPref:  "notif_news",
			wantType:  "new_news",
			wantBody:  "Karmine Corp recrute",
		},
		{
			name:      "regular article",
			article:   &models.Article{Title: cnStr("VCT EMEA"), Category: cnStr("Valorant")},
			wantOK:    true,
			wantTitle: "Nouvel article",
			wantPref:  "notif_articles",
			wantType:  "new_article",
			wantBody:  "VCT EMEA",
		},
		{
			name:      "nil category treated as article",
			article:   &models.Article{Title: cnStr("Sans categorie")},
			wantOK:    true,
			wantTitle: "Nouvel article",
			wantPref:  "notif_articles",
			wantType:  "new_article",
			wantBody:  "Sans categorie",
		},
		{
			name:    "nil title -> not ok",
			article: &models.Article{Category: cnStr("Actus")},
			wantOK:  false,
		},
		{
			name:    "empty title -> not ok",
			article: &models.Article{Title: cnStr("")},
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notif, body, ok := buildContentNotification(tt.article)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !tt.wantOK {
				return
			}
			if notif.title != tt.wantTitle {
				t.Errorf("title = %q, want %q", notif.title, tt.wantTitle)
			}
			if notif.prefCol != tt.wantPref {
				t.Errorf("prefCol = %q, want %q", notif.prefCol, tt.wantPref)
			}
			if notif.dataType != tt.wantType {
				t.Errorf("dataType = %q, want %q", notif.dataType, tt.wantType)
			}
			if body != tt.wantBody {
				t.Errorf("body = %q, want %q", body, tt.wantBody)
			}
		})
	}
}
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue (compile error attendu)**

Run: `cd backend-go && go test ./internal/services/ -run TestBuildContentNotification -v`
Expected: FAIL — `undefined: buildContentNotification`.

- [ ] **Step 3: Écrire l'implémentation minimale (fonction pure + types)**

Créer `internal/services/content_notification_service.go` :

```go
package services

import (
	"github.com/esportnews/backend/internal/models"
)

const newsCategory = "Actus"

// contentNotification holds the resolved push content for a published article/news.
type contentNotification struct {
	title    string // notification title shown to the user
	prefCol  string // user preference column that gates this notif
	dataType string // data.type sent to the mobile app for deep-linking
}

// buildContentNotification resolves the title, preference column and data.type
// for a freshly published article based on its category. Returns ok=false when
// the article has no usable title.
func buildContentNotification(article *models.Article) (notif contentNotification, body string, ok bool) {
	if article == nil || article.Title == nil {
		return contentNotification{}, "", false
	}
	body = *article.Title
	if body == "" {
		return contentNotification{}, "", false
	}

	isNews := article.Category != nil && *article.Category == newsCategory
	if isNews {
		return contentNotification{
			title:    "Nouvelle news",
			prefCol:  "notif_news",
			dataType: "new_news",
		}, body, true
	}
	return contentNotification{
		title:    "Nouvel article",
		prefCol:  "notif_articles",
		dataType: "new_article",
	}, body, true
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd backend-go && go test ./internal/services/ -run TestBuildContentNotification -v`
Expected: PASS (5 sous-tests OK).

- [ ] **Step 5: Commit**

```bash
git add backend-go/internal/services/content_notification_service.go backend-go/internal/services/content_notification_service_test.go backend-go/internal/models/article.go backend-go/internal/database/gorm.go
git commit -m "feat(notif): add content-publish notification builder + notified_at column"
```

---

## Task 3: Service `ContentNotificationService` (broadcast)

**Files:**
- Modify: `backend-go/internal/services/content_notification_service.go`

Partie I/O (DB + Expo) — vérifiée par build/vet (Task 6), pas de test unitaire.

- [ ] **Step 1: Compléter les imports**

Remplacer le bloc `import` du fichier par :

```go
import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)
```

- [ ] **Step 2: Ajouter le struct, le constructeur et `getDB`**

À la fin de `content_notification_service.go`, ajouter :

```go
// ContentNotificationService broadcasts a push notification to every opted-in
// user when a new article or news is published.
type ContentNotificationService struct {
	gormDB      interface{} // *gorm.DB or *database.Database
	pushService *ExpoPushService
	logger      *logrus.Logger
}

func NewContentNotificationService(gormDB interface{}, pushService *ExpoPushService, logger *logrus.Logger) *ContentNotificationService {
	return &ContentNotificationService{
		gormDB:      gormDB,
		pushService: pushService,
		logger:      logger,
	}
}

func (s *ContentNotificationService) getDB() *gorm.DB {
	switch v := s.gormDB.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB
	default:
		panic("gormDB is not a valid *gorm.DB or *database.Database instance")
	}
}
```

- [ ] **Step 3: Ajouter `NotifyNewContent` et `markNotified`**

À la suite, ajouter :

```go
// NotifyNewContent sends a "new article"/"new news" push to every user who has
// the master push toggle ON and the matching content preference ON. Idempotent:
// does nothing if the article was already notified. Safe to run in a goroutine.
func (s *ContentNotificationService) NotifyNewContent(ctx context.Context, article *models.Article) {
	defer func() {
		if r := recover(); r != nil {
			s.logger.Errorf("[ContentNotif] recovered from panic: %v", r)
		}
	}()

	if article == nil {
		return
	}
	if article.NotifiedAt != nil {
		s.logger.Infof("[ContentNotif] Article %d already notified, skipping", article.ID)
		return
	}

	notif, body, ok := buildContentNotification(article)
	if !ok {
		s.logger.Warnf("[ContentNotif] Article %d has no usable title, skipping", article.ID)
		return
	}

	db := s.getDB()

	// Fetch active tokens for every opted-in user in one JOIN.
	// notif.prefCol comes from a fixed allowlist (buildContentNotification),
	// never from user input -> no SQL injection.
	var tokens []string
	if err := db.WithContext(ctx).
		Table("push_token").
		Joins("JOIN users ON users.id = push_token.user_id").
		Where("push_token.active = ?", true).
		Where("users.notifi_push = ?", true).
		Where("users."+notif.prefCol+" = ?", true).
		Pluck("push_token.token", &tokens).Error; err != nil {
		s.logger.Errorf("[ContentNotif] Failed to fetch tokens for article %d: %v", article.ID, err)
		return
	}

	if len(tokens) == 0 {
		s.logger.Infof("[ContentNotif] No opted-in tokens for article %d (%s)", article.ID, notif.dataType)
		s.markNotified(ctx, article)
		return
	}

	slug := ""
	if article.Slug != nil {
		slug = *article.Slug
	}

	// One message per token keeps the Expo ticket<->message mapping 1:1, so the
	// DeviceNotRegistered cleanup inside SendBatch stays precise.
	messages := make([]ExpoPushMessage, 0, len(tokens))
	for _, t := range tokens {
		messages = append(messages, ExpoPushMessage{
			To:        []string{t},
			Title:     notif.title,
			Body:      body,
			Sound:     "default",
			ChannelId: "content-updates", // Android-only; iOS ignores it
			Data: map[string]interface{}{
				"type": notif.dataType,
				"slug": slug,
			},
		})
	}

	invalidTokens, err := s.pushService.SendBatch(ctx, messages)
	if err != nil {
		s.logger.Errorf("[ContentNotif] SendBatch failed for article %d: %v", article.ID, err)
	}
	if len(invalidTokens) > 0 {
		if derr := db.WithContext(ctx).Model(&models.PushToken{}).
			Where("token IN ?", invalidTokens).
			Update("active", false).Error; derr != nil {
			s.logger.Errorf("[ContentNotif] Failed to deactivate invalid tokens: %v", derr)
		}
	}

	s.logger.Infof("[ContentNotif] Sent %d notifications for article %d (%s), %d invalid",
		len(messages), article.ID, notif.dataType, len(invalidTokens))

	s.markNotified(ctx, article)
}

// markNotified stamps articles.notified_at (best-effort idempotency guard).
func (s *ContentNotificationService) markNotified(ctx context.Context, article *models.Article) {
	now := time.Now()
	if err := s.getDB().WithContext(ctx).Model(&models.Article{}).
		Where("id = ?", article.ID).
		Update("notified_at", now).Error; err != nil {
		s.logger.Errorf("[ContentNotif] Failed to stamp notified_at for article %d: %v", article.ID, err)
		return
	}
	article.NotifiedAt = &now
}
```

- [ ] **Step 4: Vérifier la compilation + vet**

Run: `cd backend-go && go build ./internal/services/ && go vet ./internal/services/`
Expected: aucun output d'erreur.

- [ ] **Step 5: Commit**

```bash
git add backend-go/internal/services/content_notification_service.go
git commit -m "feat(notif): broadcast new-content push to opted-in users"
```

---

## Task 4: Déclenchement dans `ArticleHandler.CreateArticle`

**Files:**
- Modify: `backend-go/internal/handlers/articles.go:16-29` (struct + constructeur)
- Modify: `backend-go/internal/handlers/articles.go:191-196` (dans `CreateArticle`)

- [ ] **Step 1: Ajouter le champ au struct**

Dans `internal/handlers/articles.go`, struct `ArticleHandler` (ligne ~16), ajouter le champ :

```go
type ArticleHandler struct {
	BaseHandler
	service         *services.ArticleService
	authService     *services.AuthService
	storageService  *services.StorageService
	contentNotifier *services.ContentNotificationService
}
```

- [ ] **Step 2: Mettre à jour le constructeur**

Remplacer `NewArticleHandlerWithService` (ligne ~23) par :

```go
func NewArticleHandlerWithService(service *services.ArticleService, authService *services.AuthService, storageService *services.StorageService, contentNotifier *services.ContentNotificationService) *ArticleHandler {
	return &ArticleHandler{
		service:         service,
		authService:     authService,
		storageService:  storageService,
		contentNotifier: contentNotifier,
	}
}
```

- [ ] **Step 3: Déclencher le broadcast après la création**

Dans `CreateArticle`, remplacer le bloc de retour final (lignes ~191-196) :

```go
	article, err := h.service.CreateArticle(ctx, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, article)
```

par :

```go
	article, err := h.service.CreateArticle(ctx, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Broadcast a "new article"/"new news" push to opted-in users.
	// Fire-and-forget on a fresh context: the Echo request ctx is canceled as
	// soon as the HTTP response is sent, which would abort the push send.
	if h.contentNotifier != nil {
		go func(a *models.Article) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			h.contentNotifier.NotifyNewContent(bgCtx, a)
		}(article)
	}

	return c.JSON(http.StatusCreated, article)
```

`context`, `time`, `models` et `services` sont déjà importés dans `articles.go`.

- [ ] **Step 4: Vérifier la compilation**

Run: `cd backend-go && go build ./internal/handlers/`
Expected: échoue avec une erreur d'appel sur `cmd/server/main.go` seulement si on build tout — ici on ne build que `handlers`, donc OK. (Le call site de `main.go` est corrigé au Task 5.)

---

## Task 5: Câblage dans `cmd/server/main.go`

**Files:**
- Modify: `backend-go/cmd/server/main.go:175-176` (création service + handler)
- Modify: `backend-go/cmd/server/main.go:215` (supprimer la création dupliquée de `expoPushService`)

- [ ] **Step 1: Créer `expoPushService` + `contentNotifier` avant le handler**

Remplacer les lignes 175-176 :

```go
	articleService := services.NewArticleServiceWithGORM(gormDB, redisClient)
	articleHandler := handlers.NewArticleHandlerWithService(articleService, authService, storageService)
```

par :

```go
	articleService := services.NewArticleServiceWithGORM(gormDB, redisClient)
	expoPushService := services.NewExpoPushService(logger)
	contentNotifier := services.NewContentNotificationService(gormDB, expoPushService, logger)
	articleHandler := handlers.NewArticleHandlerWithService(articleService, authService, storageService, contentNotifier)
```

- [ ] **Step 2: Supprimer la création dupliquée de `expoPushService`**

Plus bas (ligne ~215), supprimer la ligne devenue redondante :

```go
	expoPushService := services.NewExpoPushService(logger)
```

`notifScheduler := services.NewNotificationScheduler(gormDB, redisClient, expoPushService, logger)` (ligne suivante) réutilise désormais l'instance créée au Step 1. Ne rien changer d'autre.

- [ ] **Step 3: Vérifier la compilation complète**

Run: `cd backend-go && go build ./...`
Expected: build OK, aucune erreur (le call site de `main.go` correspond maintenant à la nouvelle signature).

---

## Task 6: Vérification backend complète

**Files:** aucun (vérification)

- [ ] **Step 1: Build + vet + tests**

Run: `cd backend-go && go build ./... && go vet ./... && go test ./internal/services/ -run TestBuildContentNotification -v`
Expected: build OK, vet sans erreur, test PASS.

- [ ] **Step 2: Commit**

```bash
git add backend-go/internal/handlers/articles.go backend-go/cmd/server/main.go
git commit -m "feat(notif): trigger content-publish broadcast on article create"
```

---

## Task 7: Canal Android `content-updates` (mobile)

**Files:**
- Modify: `mobile-app/utils/notifications.ts:46-51`

- [ ] **Step 1: Ajouter le canal**

Dans `utils/notifications.ts`, à l'intérieur du bloc `if (Platform.OS === 'android') { ... }`, après la déclaration du canal `match-alerts` (juste avant la `}` fermante du bloc, ligne ~51), ajouter :

```ts
    await Notifications.setNotificationChannelAsync('content-updates', {
      name: 'Articles & News',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F22E62',
    });
```

(Importance DEFAULT = moins agressif que `match-alerts`/HIGH. Sur une ancienne version sans ce canal, Android retombe sur le canal par défaut — dégradation propre.)

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd mobile-app && ./node_modules/.bin/tsc --noEmit`
Expected: aucune erreur TypeScript (rappel : ne PAS utiliser `npx`, réécrit en `npm` par le hook).

---

## Task 8: Deep-link tap → article (mobile)

**Files:**
- Modify: `mobile-app/app/_layout.tsx:40-45`

- [ ] **Step 1: Étendre le listener de tap**

Dans `app/_layout.tsx`, remplacer le corps du listener (lignes ~40-45) :

```tsx
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'match_start' && data?.match_id) {
        router.push(`/match/${data.match_id}` as any);
      }
    });
```

par :

```tsx
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'match_start' && data?.match_id) {
        router.push(`/match/${data.match_id}` as any);
      } else if ((data?.type === 'new_article' || data?.type === 'new_news') && data?.slug) {
        router.push(`/article/${data.slug}` as any);
      }
    });
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd mobile-app && ./node_modules/.bin/tsc --noEmit`
Expected: aucune erreur TypeScript.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/utils/notifications.ts mobile-app/app/_layout.tsx
git commit -m "feat(notif): content-updates Android channel + article deep-link"
```

---

## Vérification de bout en bout (manuelle, post-déploiement)

1. Déployer le backend (Railway, branche `main` une fois mergé) → la migration `notified_at` s'applique au démarrage.
2. Diffuser les changements mobile en **OTA** (`./node_modules/.bin/eas update`) — canal + deep-link sont du JS runtime, pas besoin d'`eas build`.
3. Sur un vrai device connecté : activer `notifi_push` + `notif_articles` (et/ou `notif_news`) dans les prefs.
4. Créer un article via le back-office (catégorie ≠ « Actus ») → vérifier la notif **« Nouvel article »** + titre.
5. Créer une news (catégorie « Actus ») → vérifier **« Nouvelle news »** + titre.
6. Taper la notif → ouvre `/article/[slug]`.
7. Vérifier en DB que `articles.notified_at` est rempli pour ces deux entrées, et qu'un 2ᵉ déclenchement n'y renvoie rien (idempotence).

---

## Self-Review (effectué)

**Couverture spec :**
- Wording article/news (« Nouvel article »/« Nouvelle news » + titre) → Task 2.
- Opt-in deux toggles (`notif_articles`/`notif_news` + `notifi_push`) → Task 3 (requête JOIN).
- Fire-on-create + goroutine + contexte propre → Task 4.
- Garde d'idempotence `notified_at` (colonne + migration + stamp) → Tasks 1 & 3.
- Un message par token → Task 3.
- Désactivation tokens invalides → Task 3.
- Câblage `expoPushService` partagé → Task 5.
- Canal Android `content-updates` → Task 7.
- Deep-link `/article/[slug]` → Task 8.
- Test fonction pure → Task 2.
- FR-only / hors-scope → respecté (aucune i18n, pas de renotify/queue).

**Placeholders :** aucun — tout le code est explicite.

**Cohérence des types :** `buildContentNotification(*models.Article) (contentNotification, string, bool)` et le struct `contentNotification{title, prefCol, dataType}` sont identiques entre Tasks 2 et 3 ; `NewContentNotificationService(gormDB, *ExpoPushService, *logrus.Logger)` et `NewArticleHandlerWithService(..., *services.ContentNotificationService)` cohérents entre Tasks 3, 4, 5 ; `data.type` (`new_article`/`new_news`) + `data.slug` cohérents entre Task 3 (émission) et Task 8 (réception).
