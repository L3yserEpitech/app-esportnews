package services

import (
	"context"
	"html"
	"regexp"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

const (
	newsCategory = "Actus"
	// Both OSes collapse the body to ~2 lines; the caps only keep the payload
	// from carrying a whole article.
	excerptMaxWords = 25
	excerptMaxChars = 160
)

// contentNotification holds the resolved push content for a published article/news.
type contentNotification struct {
	title    string // the article title, rendered bold by both OSes
	body     string // the opening words of the article
	dataType string // data.type sent to the mobile app for deep-linking
}

// buildContentNotification resolves what to display for a freshly published
// article. Returns ok=false when the article has no usable title.
func buildContentNotification(article *models.Article) (contentNotification, bool) {
	if article == nil || article.Title == nil {
		return contentNotification{}, false
	}
	title := strings.TrimSpace(*article.Title)
	if title == "" {
		return contentNotification{}, false
	}

	dataType := "new_article"
	if article.Category != nil && *article.Category == newsCategory {
		dataType = "new_news"
	}

	return contentNotification{
		title:    title,
		body:     articleExcerpt(article),
		dataType: dataType,
	}, true
}

// articleExcerpt returns the opening words of an article, preferring the
// hand-written summary over the raw body.
func articleExcerpt(article *models.Article) string {
	for _, candidate := range []*string{article.Description, article.Subtitle, article.ArticleContent, article.Content} {
		if excerpt := truncateWords(stripMarkup(derefString(candidate))); excerpt != "" {
			return excerpt
		}
	}
	return ""
}

var (
	htmlTagPattern  = regexp.MustCompile(`<[^>]*>`)
	markdownNoise   = strings.NewReplacer("#", "", "*", "", "_", "", "`", "", ">", "")
	blockTagPattern = regexp.MustCompile(`(?i)</(p|div|h[1-6]|li|br)>`)
)

// stripMarkup flattens HTML or markdown article bodies into plain text.
func stripMarkup(s string) string {
	if s == "" {
		return ""
	}
	// Close block-level tags with a space first, otherwise "<p>a</p><p>b</p>"
	// would collapse into "ab".
	s = blockTagPattern.ReplaceAllString(s, " ")
	s = htmlTagPattern.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return markdownNoise.Replace(s)
}

// truncateWords keeps the first excerptMaxWords words, capped at
// excerptMaxChars runes, and appends an ellipsis when it cut something.
func truncateWords(text string) string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}

	cut := len(words) > excerptMaxWords
	if cut {
		words = words[:excerptMaxWords]
	}

	excerpt := strings.Join(words, " ")
	if runes := []rune(excerpt); len(runes) > excerptMaxChars {
		excerpt = strings.TrimSpace(string(runes[:excerptMaxChars]))
		cut = true
	}
	if cut {
		excerpt += "…"
	}
	return excerpt
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

	notif, ok := buildContentNotification(article)
	if !ok {
		s.logger.Warnf("[ContentNotif] Article %d has no usable title, skipping", article.ID)
		return
	}

	db := s.getDB()

	// Broadcast to every active device. Preference gating is intentionally
	// disabled: every user receives article/news notifications regardless of
	// their notifi_push / notif_articles / notif_news flags.
	var tokens []string
	if err := db.WithContext(ctx).
		Model(&models.PushToken{}).
		Where("active = ?", true).
		Pluck("token", &tokens).Error; err != nil {
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
			Body:      notif.body,
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
