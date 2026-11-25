package backoffice

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/models"
)

func artPtr[T any](v T) *T { return &v }

func TestArticleOwnership(t *testing.T) {
	editor := &teamUser{ID: 7, Name: "Mickaël  Lemoult", Role: RoleEditor}
	admin := &teamUser{ID: 1, Name: "Kenan Altarac", Role: RoleAdmin}
	reader := &teamUser{ID: 9, Name: "Mickael Lemoult", Role: RoleReader}

	cases := []struct {
		name     string
		authorID *int64
		byline   *string
		editor   bool
	}{
		{"linked to the member", artPtr(int64(7)), artPtr("Someone Else"), true},
		{"linked to another member, same byline", artPtr(int64(8)), artPtr("Mickaël Lemoult"), false},
		{"byline only, exact", nil, artPtr("Mickaël Lemoult"), true},
		{"byline only, no accent, other case, extra spaces", nil, artPtr("  mickael   LEMOULT "), true},
		{"byline only, another name", nil, artPtr("Samuel Cohen"), false},
		{"byline only, shortened name", nil, artPtr("Mickael L"), false},
		{"no author at all", nil, nil, false},
		{"empty byline", nil, artPtr("  "), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := &models.Article{AuthorID: tc.authorID, Author: tc.byline}
			assert.Equal(t, tc.editor, canEditArticle(editor, a), "editor")
			assert.True(t, canEditArticle(admin, a), "an admin edits anyone's")
			assert.False(t, canEditArticle(reader, a), "a reader edits nothing, even under their name")
		})
	}
}

func TestEmptyBylineNeverMatchesAnEmptyName(t *testing.T) {
	nameless := &teamUser{ID: 3, Name: "", Role: RoleEditor}
	assert.False(t, canEditArticle(nameless, &models.Article{Author: artPtr("")}))
}

func TestPlanTransition(t *testing.T) {
	now := time.Date(2026, 11, 25, 10, 0, 0, 0, time.UTC)
	soon, later, past := now.Add(time.Hour), now.Add(48*time.Hour), now.Add(-time.Minute)

	cases := []struct {
		name      string
		from, to  string
		current   *time.Time
		wanted    *time.Time
		status    string
		at        *time.Time
		publishes bool
		action    string
		label     string
		err       error
	}{
		{name: "new, nothing said: draft", from: "", to: "", status: statusDraft, action: "article.created", label: "brouillon"},
		{name: "new draft", from: "", to: statusDraft, status: statusDraft, action: "article.created", label: "brouillon"},
		{name: "new, published at once", from: "", to: statusPublished, status: statusPublished, publishes: true, action: "article.published", label: "publication"},
		{name: "new, scheduled", from: "", to: statusScheduled, wanted: &soon, status: statusScheduled, at: &soon, action: "article.scheduled", label: "programmation"},
		{name: "draft saved again", from: statusDraft, to: statusDraft, status: statusDraft},
		{name: "draft, status not sent", from: statusDraft, to: "", status: statusDraft},
		{name: "draft published", from: statusDraft, to: statusPublished, status: statusPublished, publishes: true, action: "article.published", label: "publication"},
		{name: "draft scheduled", from: statusDraft, to: statusScheduled, wanted: &soon, status: statusScheduled, at: &soon, action: "article.scheduled", label: "programmation"},
		{name: "schedule without a date", from: statusDraft, to: statusScheduled, err: errScheduleNeeded},
		{name: "schedule in the past", from: statusDraft, to: statusScheduled, wanted: &past, err: errSchedulePast},
		{name: "schedule exactly now", from: statusDraft, to: statusScheduled, wanted: &now, err: errSchedulePast},
		{name: "scheduled, edited, date kept", from: statusScheduled, to: statusScheduled, current: &soon, status: statusScheduled, at: &soon},
		{name: "scheduled, same date sent again", from: statusScheduled, to: statusScheduled, current: &soon, wanted: &soon, status: statusScheduled, at: &soon},
		{name: "scheduled, status not sent", from: statusScheduled, to: "", current: &soon, status: statusScheduled, at: &soon},
		{name: "scheduled, date moved", from: statusScheduled, to: statusScheduled, current: &soon, wanted: &later, status: statusScheduled, at: &later, action: "article.scheduled", label: "programmation"},
		{name: "scheduled, date moved into the past", from: statusScheduled, to: statusScheduled, current: &soon, wanted: &past, err: errSchedulePast},
		{name: "scheduled, due but not yet picked up, edited", from: statusScheduled, to: statusScheduled, current: &past, status: statusScheduled, at: &past},
		{name: "scheduled published by hand", from: statusScheduled, to: statusPublished, current: &soon, status: statusPublished, publishes: true, action: "article.published", label: "publication"},
		{name: "scheduled back to draft", from: statusScheduled, to: statusDraft, current: &soon, status: statusDraft, label: "déprogrammation"},
		{name: "published updated", from: statusPublished, to: statusPublished, status: statusPublished},
		{name: "published, status not sent", from: statusPublished, to: "", status: statusPublished},
		{name: "published, a stray date is ignored", from: statusPublished, to: statusPublished, wanted: &soon, status: statusPublished},
		{name: "unpublished", from: statusPublished, to: statusDraft, status: statusDraft, action: "article.unpublished", label: "dépublication"},
		{name: "published rescheduled", from: statusPublished, to: statusScheduled, wanted: &soon, status: statusScheduled, at: &soon, action: "article.scheduled", label: "programmation"},
		{name: "unknown status", from: statusDraft, to: "archived", err: errInvalidStatus},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := planTransition(tc.from, tc.to, tc.current, tc.wanted, now)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.status, got.Status)
			assert.Equal(t, tc.publishes, got.Publishes, "publishes")
			assert.Equal(t, tc.action, got.Action)
			assert.Equal(t, tc.label, got.Label)
			if tc.at == nil {
				assert.Nil(t, got.ScheduledAt)
			} else {
				require.NotNil(t, got.ScheduledAt)
				assert.True(t, tc.at.Equal(*got.ScheduledAt))
			}
		})
	}
}

// Only a move to « published » restarts created_at and may send the push.
func TestOnlyBecomingPublishedPublishes(t *testing.T) {
	now := time.Now()
	at := now.Add(time.Hour)
	for _, from := range []string{"", statusDraft, statusScheduled, statusPublished} {
		for _, to := range []string{statusDraft, statusScheduled, statusPublished} {
			got, err := planTransition(from, to, nil, &at, now)
			require.NoError(t, err)
			assert.Equal(t, to == statusPublished && from != statusPublished, got.Publishes, "%q → %q", from, to)
		}
	}
}

func TestChangedFields(t *testing.T) {
	base := articleSnapshot{
		Title: "Titre", Subtitle: "Chapô", SeoTitle: "SEO", Description: "Desc", Content: "<p>Corps</p>",
		Category: "Actus", Tags: []string{"a", "b"}, FeaturedImage: "https://cdn/x.jpg", Credit: "©",
		GameID: 3, Author: "Kenan Altarac", AuthorID: 10, NotifyOnPublish: true, Status: statusDraft,
	}
	with := func(edit func(*articleSnapshot)) articleSnapshot {
		s := base
		s.Tags = append([]string{}, base.Tags...)
		edit(&s)
		return s
	}

	cases := []struct {
		name      string
		after     articleSnapshot
		labels    []string
		editorial bool
	}{
		{"nothing", with(func(s *articleSnapshot) {}), nil, false},
		{"title", with(func(s *articleSnapshot) { s.Title = "Autre" }), []string{"titre"}, true},
		{"seo title", with(func(s *articleSnapshot) { s.SeoTitle = "" }), []string{"titre SEO"}, true},
		{"body", with(func(s *articleSnapshot) { s.Content = "<p>Autre</p>" }), []string{"contenu"}, true},
		{"game is filing", with(func(s *articleSnapshot) { s.GameID = 0 }), []string{"jeu"}, false},
		{"category is filing", with(func(s *articleSnapshot) { s.Category = "Analyse" }), []string{"catégorie"}, false},
		{"push toggle is filing", with(func(s *articleSnapshot) { s.NotifyOnPublish = false }), []string{"notification"}, false},
		{"tag order", with(func(s *articleSnapshot) { s.Tags = []string{"b", "a"} }), []string{"mots-clés"}, true},
		{"tag added", with(func(s *articleSnapshot) { s.Tags = append(s.Tags, "c") }), []string{"mots-clés"}, true},
		{"author by account only", with(func(s *articleSnapshot) { s.AuthorID = 11 }), []string{"auteur"}, true},
		{"cover and credit", with(func(s *articleSnapshot) { s.FeaturedImage, s.Credit = "", "" }), []string{"image de couverture", "crédit"}, true},
		{"status and slug are not fields", with(func(s *articleSnapshot) { s.Status, s.Slug = statusPublished, "x" }), nil, false},
		{
			"several, in the order of the form",
			with(func(s *articleSnapshot) { s.Description, s.GameID, s.Title, s.Subtitle = "D2", 4, "T2", "C2" }),
			[]string{"titre", "chapô", "jeu", "description"}, true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			labels, editorial := changedFields(base, tc.after)
			assert.Equal(t, tc.labels, labels)
			assert.Equal(t, tc.editorial, editorial)
		})
	}
}

func TestVersionLabel(t *testing.T) {
	publish := transition{Label: "publication"}
	assert.Equal(t, "brouillon", versionLabel(true, transition{Label: "brouillon"}, []string{"titre", "contenu"}))
	assert.Equal(t, "publication", versionLabel(true, publish, nil))
	assert.Equal(t, "publication", versionLabel(false, publish, nil))
	assert.Equal(t, "publication, titre, contenu", versionLabel(false, publish, []string{"titre", "contenu"}))
	assert.Equal(t, "titre SEO, contenu", versionLabel(false, transition{}, []string{"titre SEO", "contenu"}))
	assert.Equal(t, "", versionLabel(false, transition{}, nil))
}

func TestMergeLabels(t *testing.T) {
	assert.Equal(t, "titre, contenu", mergeLabels("titre", "contenu"))
	assert.Equal(t, "titre, contenu, chapô", mergeLabels("titre, contenu", "contenu, chapô"))
	assert.Equal(t, "contenu", mergeLabels("", "contenu"))
	assert.Equal(t, "contenu", mergeLabels("contenu", ""))
}

func TestCleanTags(t *testing.T) {
	got := cleanTags([]string{"  Rainbow  Six ", "rainbow six", "", "Ubisoft", "ubisoft", "DOOM"})
	assert.Equal(t, []string{"Rainbow Six", "Ubisoft", "DOOM"}, got)
	assert.Equal(t, []string{}, cleanTags(nil))

	many := make([]string, 0, 50)
	for i := 0; i < 50; i++ {
		many = append(many, string(rune('a'+i%26))+string(rune('a'+i/26)))
	}
	assert.Len(t, cleanTags(many), maxTags)
}

func TestEmptyBody(t *testing.T) {
	for _, html := range []string{"", "<p></p>", "<p> </p><p><br></p>", "<h2>&nbsp;</h2>"} {
		assert.True(t, emptyBody(html), html)
	}
	for _, html := range []string{
		"<p>Texte</p>",
		`<img src="https://cdn/x.jpg">`,
		`<video src="https://cdn/x.mp4"></video>`,
		`<div data-tweet-id="1234567890123" class="twitter-embed-placeholder"></div>`,
	} {
		assert.False(t, emptyBody(html), html)
	}
}

func TestValidateSnapshot(t *testing.T) {
	ready := articleSnapshot{Title: "Titre", Content: "<p>Corps</p>", Category: "Actus", Status: statusPublished}
	assert.Equal(t, "", validateSnapshot(ready))

	draft := articleSnapshot{Title: "Titre", Status: statusDraft}
	assert.Equal(t, "", validateSnapshot(draft), "a draft only needs a title")

	noTitle := draft
	noTitle.Title = ""
	assert.NotEqual(t, "", validateSnapshot(noTitle))

	for _, status := range []string{statusPublished, statusScheduled} {
		noBody := ready
		noBody.Status, noBody.Content = status, "<p></p>"
		assert.Contains(t, validateSnapshot(noBody), "contenu", status)

		noCategory := ready
		noCategory.Status, noCategory.Category = status, ""
		assert.Contains(t, validateSnapshot(noCategory), "catégorie", status)
	}

	seo := draft
	seo.SeoTitle = strings.Repeat("é", 60)
	assert.Equal(t, "", validateSnapshot(seo), "60 characters, counted as characters")
	seo.SeoTitle += "x"
	assert.Contains(t, validateSnapshot(seo), "60")

	cover := draft
	cover.FeaturedImage = "javascript:alert(1)"
	assert.NotEqual(t, "", validateSnapshot(cover))
	cover.FeaturedImage = "https://pub-example.r2.dev/articles/covers/images/a.jpg"
	assert.Equal(t, "", validateSnapshot(cover))
}

func TestSnapshotReadsTheBodyWhereverItIs(t *testing.T) {
	legacy := &models.Article{Content: artPtr("<p>Ancien</p>")}
	assert.Equal(t, "<p>Ancien</p>", snapshotOf(legacy).Content)

	both := &models.Article{Content: artPtr("<p>Ancien</p>"), ArticleContent: artPtr("<p>Éditeur</p>")}
	assert.Equal(t, "<p>Éditeur</p>", snapshotOf(both).Content)

	assert.Equal(t, []string{}, snapshotOf(&models.Article{}).Tags, "never null in a version")
}

func TestPublicPath(t *testing.T) {
	// 23:30 UTC on the 18th is already the 19th in Paris: the site builds the
	// address in UTC, so does the back-office.
	published := time.Date(2026, 11, 18, 23, 30, 0, 0, time.UTC).In(time.FixedZone("CET", 3600))
	assert.Equal(t, "/article/mon-article/18-11-2026", publicPath("mon-article", &published))
	assert.Equal(t, "/article/mon-article", publicPath("mon-article", nil))
	assert.Equal(t, "", publicPath("", &published))
}

func TestCheckUploadKinds(t *testing.T) {
	assert.Equal(t, "image", uploadKinds[".webp"])
	assert.Equal(t, "video", uploadKinds[".mp4"])
	assert.Equal(t, "", uploadKinds[".svg"], "an SVG can carry a script and the bucket is public")
	assert.Equal(t, "", uploadKinds[".html"])
}
