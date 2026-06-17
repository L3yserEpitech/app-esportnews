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
