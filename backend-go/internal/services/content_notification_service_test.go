package services

import (
	"strings"
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
		wantType  string
		wantBody  string
	}{
		{
			name: "news category Actus",
			article: &models.Article{
				Title:       cnStr("Karmine Corp recrute"),
				Category:    cnStr("Actus"),
				Description: cnStr("Le club français annonce son nouveau roster."),
			},
			wantOK:    true,
			wantTitle: "Karmine Corp recrute",
			wantType:  "new_news",
			wantBody:  "Le club français annonce son nouveau roster.",
		},
		{
			name:      "regular article",
			article:   &models.Article{Title: cnStr("VCT EMEA"), Category: cnStr("Valorant"), Subtitle: cnStr("Le récap de la journée")},
			wantOK:    true,
			wantTitle: "VCT EMEA",
			wantType:  "new_article",
			wantBody:  "Le récap de la journée",
		},
		{
			name:      "nil category treated as article",
			article:   &models.Article{Title: cnStr("Sans categorie")},
			wantOK:    true,
			wantTitle: "Sans categorie",
			wantType:  "new_article",
		},
		{
			name: "falls back to the html body, tags stripped",
			article: &models.Article{
				Title:          cnStr("Major Cologne"),
				ArticleContent: cnStr("<p>Vitality s&#39;impose</p><p>en finale</p>"),
			},
			wantOK:    true,
			wantTitle: "Major Cologne",
			wantType:  "new_article",
			wantBody:  "Vitality s'impose en finale",
		},
		{
			name:    "nil title -> not ok",
			article: &models.Article{Category: cnStr("Actus")},
			wantOK:  false,
		},
		{
			name:    "blank title -> not ok",
			article: &models.Article{Title: cnStr("   ")},
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notif, ok := buildContentNotification(tt.article)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !tt.wantOK {
				return
			}
			if notif.title != tt.wantTitle {
				t.Errorf("title = %q, want %q", notif.title, tt.wantTitle)
			}
			if notif.dataType != tt.wantType {
				t.Errorf("dataType = %q, want %q", notif.dataType, tt.wantType)
			}
			if notif.body != tt.wantBody {
				t.Errorf("body = %q, want %q", notif.body, tt.wantBody)
			}
		})
	}
}

func TestArticleExcerptTruncates(t *testing.T) {
	long := strings.TrimSpace(strings.Repeat("mot ", 40))
	excerpt := articleExcerpt(&models.Article{Description: cnStr(long)})

	if !strings.HasSuffix(excerpt, "…") {
		t.Errorf("excerpt = %q, want a trailing ellipsis", excerpt)
	}
	if words := len(strings.Fields(excerpt)); words > excerptMaxWords {
		t.Errorf("excerpt has %d words, want at most %d", words, excerptMaxWords)
	}
	if runes := []rune(excerpt); len(runes) > excerptMaxChars+1 {
		t.Errorf("excerpt has %d runes, want at most %d", len(runes), excerptMaxChars+1)
	}
}
