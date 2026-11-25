package backoffice

import (
	"errors"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

const (
	statusDraft     = models.ArticleStatusDraft
	statusScheduled = models.ArticleStatusScheduled
	statusPublished = models.ArticleStatusPublished

	maxSeoTitle    = 60
	maxTitle       = 300
	maxTags        = 30
	maxTagLength   = 80
	maxVersions    = 30
	autosaveWindow = 10 * time.Minute
)

func validStatus(s string) bool {
	return s == statusDraft || s == statusScheduled || s == statusPublished
}

// bylineKey makes two spellings of a name comparable: case, accents and
// spacing are folded the way a slug folds them.
func bylineKey(name string) string { return utils.GenerateSlug(name, 0, 0) }

// ownsArticle: the linked account when there is one, else the byline. Articles
// written before the back-office only carry a byline.
func ownsArticle(u *teamUser, authorID *int64, byline *string) bool {
	if authorID != nil {
		return *authorID == u.ID
	}
	if byline == nil {
		return false
	}
	key := bylineKey(*byline)
	return key != "" && key == bylineKey(u.Name)
}

func canEdit(u *teamUser, authorID *int64, byline *string) bool {
	if u.Role.Can(PermArticlesWriteAny) {
		return true
	}
	return u.Role.Can(PermArticlesWrite) && ownsArticle(u, authorID, byline)
}

func canEditArticle(u *teamUser, a *models.Article) bool { return canEdit(u, a.AuthorID, a.Author) }

// articleSnapshot is the editable state of an article: what a save compares,
// what a version stores and what a restore puts back.
type articleSnapshot struct {
	Title           string     `json:"title"`
	Subtitle        string     `json:"subtitle"`
	SeoTitle        string     `json:"seo_title"`
	Description     string     `json:"description"`
	Content         string     `json:"article_content"`
	Category        string     `json:"category"`
	Tags            []string   `json:"tags"`
	FeaturedImage   string     `json:"featuredImage"`
	Credit          string     `json:"credit"`
	GameID          int64      `json:"game_id"` // 0 = no game
	Author          string     `json:"author"`
	AuthorID        int64      `json:"author_id"` // 0 = byline only
	NotifyOnPublish bool       `json:"notify_on_publish"`
	Status          string     `json:"status"`
	ScheduledAt     *time.Time `json:"scheduled_at,omitempty"`
	Slug            string     `json:"slug"`
	Autosave        bool       `json:"autosave,omitempty"`
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// articleBody is the HTML the editor works on. Older rows only fill `content`.
func articleBody(a *models.Article) string {
	if body := deref(a.ArticleContent); body != "" {
		return body
	}
	return deref(a.Content)
}

func snapshotOf(a *models.Article) articleSnapshot {
	s := articleSnapshot{
		Title:           deref(a.Title),
		Subtitle:        deref(a.Subtitle),
		SeoTitle:        deref(a.SeoTitle),
		Description:     deref(a.Description),
		Content:         articleBody(a),
		Category:        deref(a.Category),
		Tags:            append([]string{}, a.Tags...),
		FeaturedImage:   deref(a.FeaturedImage),
		Credit:          deref(a.Credit),
		Author:          deref(a.Author),
		NotifyOnPublish: a.NotifyOnPublish,
		Status:          a.Status,
		ScheduledAt:     a.ScheduledAt,
		Slug:            deref(a.Slug),
	}
	if a.GameID != nil {
		s.GameID = *a.GameID
	}
	if a.AuthorID != nil {
		s.AuthorID = *a.AuthorID
	}
	return s
}

type fieldChange struct {
	label     string
	editorial bool // moves updated_at, the dateModified the site publishes
	changed   func(a, b articleSnapshot) bool
}

// Order is the order of the labels in a version and in the audit log. A game,
// a category or the push toggle is filing, not a rewrite of the article.
var articleFields = []fieldChange{
	{"titre", true, func(a, b articleSnapshot) bool { return a.Title != b.Title }},
	{"chapô", true, func(a, b articleSnapshot) bool { return a.Subtitle != b.Subtitle }},
	{"contenu", true, func(a, b articleSnapshot) bool { return a.Content != b.Content }},
	{"image de couverture", true, func(a, b articleSnapshot) bool { return a.FeaturedImage != b.FeaturedImage }},
	{"crédit", true, func(a, b articleSnapshot) bool { return a.Credit != b.Credit }},
	{"mots-clés", true, func(a, b articleSnapshot) bool { return !sameStrings(a.Tags, b.Tags) }},
	{"catégorie", false, func(a, b articleSnapshot) bool { return a.Category != b.Category }},
	{"jeu", false, func(a, b articleSnapshot) bool { return a.GameID != b.GameID }},
	{"auteur", true, func(a, b articleSnapshot) bool { return a.Author != b.Author || a.AuthorID != b.AuthorID }},
	{"titre SEO", true, func(a, b articleSnapshot) bool { return a.SeoTitle != b.SeoTitle }},
	{"description", true, func(a, b articleSnapshot) bool { return a.Description != b.Description }},
	{"notification", false, func(a, b articleSnapshot) bool { return a.NotifyOnPublish != b.NotifyOnPublish }},
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// changedFields names what differs between two states, in French, and tells
// whether a reader of the site would see the difference.
func changedFields(before, after articleSnapshot) (labels []string, editorial bool) {
	for _, f := range articleFields {
		if f.changed(before, after) {
			labels = append(labels, f.label)
			editorial = editorial || f.editorial
		}
	}
	return labels, editorial
}

// transition is what a save does to the status of an article.
type transition struct {
	Status      string
	ScheduledAt *time.Time
	// Publishes: the article reaches the site now. created_at restarts (it is
	// the publication date everywhere) and the push may go.
	Publishes bool
	Action    string // audit action, "" when the status stays put
	Label     string // version label, "" when the status stays put
}

var (
	errInvalidStatus  = errors.New("invalid status")
	errScheduleNeeded = errors.New("schedule date required")
	errSchedulePast   = errors.New("schedule date in the past")
)

// planTransition decides the move from one status to another. `from` is ""
// for an article being created, `to` is "" when the save doesn't say.
func planTransition(from, to string, currentAt, wantedAt *time.Time, now time.Time) (transition, error) {
	if to == "" {
		to = from
		if to == "" {
			to = statusDraft
		}
	}
	if !validStatus(to) {
		return transition{}, errInvalidStatus
	}
	switch to {
	case statusPublished:
		t := transition{Status: statusPublished}
		if from != statusPublished {
			t.Publishes, t.Action, t.Label = true, "article.published", "publication"
		}
		return t, nil

	case statusScheduled:
		at := wantedAt
		if at == nil && from == statusScheduled {
			at = currentAt
		}
		if at == nil {
			return transition{}, errScheduleNeeded
		}
		moved := from != statusScheduled || currentAt == nil || !currentAt.Equal(*at)
		// A date already set is not re-judged on every save of the article.
		if moved && !at.After(now) {
			return transition{}, errSchedulePast
		}
		t := transition{Status: statusScheduled, ScheduledAt: at}
		if moved {
			t.Action, t.Label = "article.scheduled", "programmation"
		}
		return t, nil

	default:
		t := transition{Status: statusDraft}
		switch from {
		case statusPublished:
			t.Action, t.Label = "article.unpublished", "dépublication"
		case statusScheduled:
			t.Label = "déprogrammation"
		case "":
			t.Action, t.Label = "article.created", "brouillon"
		}
		return t, nil
	}
}

// versionLabel: the status move first, then the fields. A new article only
// says what it was born as.
func versionLabel(created bool, t transition, fields []string) string {
	if created {
		return t.Label
	}
	parts := fields
	if t.Label != "" {
		parts = append([]string{t.Label}, fields...)
	}
	return strings.Join(parts, ", ")
}

// mergeLabels keeps one line for a run of autosaves: every field touched since
// the run began, once each.
func mergeLabels(previous, next string) string {
	seen := map[string]bool{}
	var out []string
	for _, label := range append(strings.Split(previous, ", "), strings.Split(next, ", ")...) {
		if label != "" && !seen[label] {
			seen[label] = true
			out = append(out, label)
		}
	}
	return strings.Join(out, ", ")
}

func cleanTags(tags []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, tag := range tags {
		tag = clip(strings.Join(strings.Fields(tag), " "), maxTagLength)
		key := strings.ToLower(tag)
		if tag == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, tag)
		if len(out) == maxTags {
			break
		}
	}
	return out
}

var mediaMarkers = []string{"<img", "<video", "<iframe", "data-tweet-id"}

// emptyBody: no text and no media. Tiptap saves an empty document as "<p></p>".
func emptyBody(html string) bool {
	for _, marker := range mediaMarkers {
		if strings.Contains(html, marker) {
			return false
		}
	}
	var text strings.Builder
	inTag := false
	for _, r := range html {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			text.WriteRune(r)
		}
	}
	return strings.TrimSpace(strings.ReplaceAll(text.String(), "&nbsp;", " ")) == ""
}

func validImageURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
}

// validateSnapshot returns the message to show, "" when the article may be saved.
// A draft only needs a title; what reaches the site needs a body and a category:
// the site lists an article under « Actus » or under everything else, and one
// without a category would show in neither.
func validateSnapshot(s articleSnapshot) string {
	switch {
	case s.Title == "":
		return "Le titre est obligatoire"
	case utf8.RuneCountInString(s.Title) > maxTitle:
		return "Le titre est trop long"
	case utf8.RuneCountInString(s.SeoTitle) > maxSeoTitle:
		return "Le titre SEO dépasse 60 caractères"
	case s.FeaturedImage != "" && !validImageURL(s.FeaturedImage):
		return "L'adresse de l'image de couverture est invalide"
	}
	if s.Status == statusDraft {
		return ""
	}
	switch {
	case emptyBody(s.Content):
		return "Le contenu est obligatoire pour publier"
	case s.Category == "":
		return "Choisissez une catégorie avant de publier"
	}
	return ""
}

// publicPath mirrors articleHref of the site: the slug, then the publication
// day in UTC once there is one.
func publicPath(slug string, publishedAt *time.Time) string {
	if slug == "" {
		return ""
	}
	if publishedAt == nil {
		return "/article/" + slug
	}
	return "/article/" + slug + "/" + publishedAt.UTC().Format("02-01-2006")
}
