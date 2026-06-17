package services

import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
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
	// In-memory idempotency guard: sufficient for the single fire-and-forget
	// callsite (a freshly created Article). A DB-level check would be needed if
	// this were ever called with a re-fetched struct.
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
	} else {
		s.logger.Infof("[ContentNotif] Sent %d notifications for article %d (%s), %d invalid",
			len(messages), article.ID, notif.dataType, len(invalidTokens))
	}
	if len(invalidTokens) > 0 {
		if derr := db.WithContext(ctx).Model(&models.PushToken{}).
			Where("token IN ?", invalidTokens).
			Update("active", false).Error; derr != nil {
			s.logger.Errorf("[ContentNotif] Failed to deactivate invalid tokens: %v", derr)
		}
	}

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
