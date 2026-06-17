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
