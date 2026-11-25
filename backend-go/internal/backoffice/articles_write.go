package backoffice

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

// articleInput is a partial update: an absent field keeps its value, an empty
// one clears it.
type articleInput struct {
	Title           *string    `json:"title"`
	Subtitle        *string    `json:"subtitle"`
	SeoTitle        *string    `json:"seo_title"`
	Description     *string    `json:"description"`
	ArticleContent  *string    `json:"article_content"`
	Category        *string    `json:"category"`
	Tags            *[]string  `json:"tags"`
	FeaturedImage   *string    `json:"featuredImage"`
	Credit          *string    `json:"credit"`
	GameID          *int64     `json:"game_id"`   // 0 detaches the game
	AuthorID        *int64     `json:"author_id"` // read for members who may edit anyone's
	Status          *string    `json:"status"`
	ScheduledAt     *time.Time `json:"scheduled_at"`
	NotifyOnPublish *bool      `json:"notify_on_publish"`
	// Autosave: the editor saving a draft on its own. A run of those keeps one
	// version and one audit line.
	Autosave bool `json:"autosave"`
}

type actor struct {
	ID   int64
	Name string
}

var systemActor = actor{Name: "Système"}

// faultError carries a refusal to show as is.
type faultError struct {
	status int
	code   string
	msg    string
}

func (e *faultError) Error() string { return e.msg }

func refuse(status int, code, msg string) error {
	return &faultError{status: status, code: code, msg: msg}
}

func (m *Module) answer(c echo.Context, err error) error {
	var f *faultError
	if errors.As(err, &f) {
		return fail(c, f.status, f.code, f.msg)
	}
	return m.internal(c, err)
}

func trimmed(s string) string { return strings.TrimSpace(s) }

// overlay applies an input onto the current state. cur is nil for a new article.
func (m *Module) overlay(ctx context.Context, me *teamUser, cur *models.Article, in *articleInput) (articleSnapshot, error) {
	var s articleSnapshot
	if cur != nil {
		s = snapshotOf(cur)
	} else {
		s = articleSnapshot{Tags: []string{}, Author: me.Name, AuthorID: me.ID, Status: "",
			NotifyOnPublish: m.settingBool(ctx, SettingNotifyNewArticle, true)}
	}
	if in.Title != nil {
		s.Title = strings.Join(strings.Fields(*in.Title), " ")
	}
	if in.Subtitle != nil {
		s.Subtitle = trimmed(*in.Subtitle)
	}
	if in.SeoTitle != nil {
		s.SeoTitle = trimmed(*in.SeoTitle)
	}
	if in.Description != nil {
		s.Description = trimmed(*in.Description)
	}
	if in.ArticleContent != nil {
		s.Content = trimmed(*in.ArticleContent)
	}
	if in.Category != nil {
		s.Category = trimmed(*in.Category)
	}
	if in.Tags != nil {
		s.Tags = cleanTags(*in.Tags)
	}
	if in.FeaturedImage != nil {
		s.FeaturedImage = trimmed(*in.FeaturedImage)
	}
	if in.Credit != nil {
		s.Credit = trimmed(*in.Credit)
	}
	if in.NotifyOnPublish != nil {
		s.NotifyOnPublish = *in.NotifyOnPublish
	}
	if in.GameID != nil && *in.GameID != s.GameID {
		if *in.GameID < 0 {
			return s, refuse(http.StatusBadRequest, "invalid_input", "Jeu inconnu")
		}
		if *in.GameID > 0 {
			if _, err := m.gameName(ctx, *in.GameID); err != nil {
				return s, err
			}
		}
		s.GameID = *in.GameID
	}
	// An editor always signs as themself; choosing the author is for those who
	// may edit anyone's article.
	if in.AuthorID != nil && *in.AuthorID > 0 && *in.AuthorID != s.AuthorID && me.Role.Can(PermArticlesWriteAny) {
		author, err := m.userByID(ctx, *in.AuthorID)
		if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && !author.Role.Can(PermArticlesWrite)) {
			return s, refuse(http.StatusBadRequest, "invalid_input", "Cet auteur ne fait pas partie de la rédaction")
		}
		if err != nil {
			return s, err
		}
		s.Author, s.AuthorID = author.Name, author.ID
	}
	return s, nil
}

func (m *Module) gameName(ctx context.Context, id int64) (string, error) {
	var names []string
	err := m.db.WithContext(ctx).Raw(
		`SELECT COALESCE(NULLIF(full_name, ''), name, '') FROM games WHERE id = ?`, id).Scan(&names).Error
	if err != nil {
		return "", err
	}
	if len(names) == 0 {
		return "", refuse(http.StatusBadRequest, "invalid_input", "Jeu inconnu")
	}
	return names[0], nil
}

func nullable(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableID(id int64) interface{} {
	if id == 0 {
		return nil
	}
	return id
}

// everPublished: the address of the article may be indexed, its slug is frozen.
// The audit log remembers a publication the status no longer shows.
func (m *Module) everPublished(tx *gorm.DB, a *models.Article) (bool, error) {
	if a.Status == statusPublished {
		return true, nil
	}
	var n int64
	err := tx.Raw(`SELECT count(*) FROM bo_audit_log WHERE target_type = 'article' AND target_id = ?
		AND action IN ('article.published', 'article.unpublished')`, strconv.FormatInt(a.ID, 10)).Scan(&n).Error
	return n > 0, err
}

func uniqueSlug(tx *gorm.DB, title string, exceptID int64) (string, error) {
	if utils.GenerateSlug(title, 150, 0) == "" {
		title = "article"
	}
	return utils.GenerateUniqueSlug(title, 150, func(slug string) (bool, error) {
		var n int64
		err := tx.Raw("SELECT count(*) FROM articles WHERE slug = ? AND id <> ?", slug, exceptID).Scan(&n).Error
		return n > 0, err
	})
}

// articleWrite is one save, already validated and allowed.
type articleWrite struct {
	by       actor
	cur      *models.Article // nil creates
	after    articleSnapshot
	plan     transition
	label    string // replaces the computed version label (restore, bulk)
	autosave bool
	// frozen: nothing but the listed fields moves (restore keeps slug and dates).
	frozen bool
}

type articleWritten struct {
	article *models.Article
	changed bool
	created bool
	label   string
	// logged: false when the save joined the current run of autosaves.
	logged bool
}

var errStale = errors.New("article changed meanwhile")

// writeArticle stores the save and its version in one transaction. Dates follow
// the rules of the site: created_at is the publication date, updated_at only
// moves when a reader would see the change.
func (m *Module) writeArticle(ctx context.Context, w articleWrite) (articleWritten, error) {
	out := articleWritten{created: w.cur == nil}
	var before articleSnapshot
	if w.cur != nil {
		before = snapshotOf(w.cur)
	}
	fields, editorial := changedFields(before, w.after)
	if w.cur != nil && len(fields) == 0 && w.plan.Label == "" && sameSchedule(before.ScheduledAt, w.plan.ScheduledAt) {
		out.article = w.cur
		return out, nil
	}
	out.changed = true
	out.label = w.label
	if out.label == "" {
		out.label = versionLabel(out.created, w.plan, fields)
	}
	now := time.Now()

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		a, b := w.after, before
		cols := map[string]interface{}{"status": w.plan.Status, "scheduled_at": w.plan.ScheduledAt}
		// Only what changed is written: a column this code never touched keeps
		// the exact value an older tool gave it.
		set := func(column string, changed bool, value interface{}) {
			if out.created || changed {
				cols[column] = value
			}
		}
		set("title", a.Title != b.Title, a.Title)
		set("subtitle", a.Subtitle != b.Subtitle, nullable(a.Subtitle))
		set("seo_title", a.SeoTitle != b.SeoTitle, nullable(a.SeoTitle))
		set("description", a.Description != b.Description, nullable(a.Description))
		set("category", a.Category != b.Category, nullable(a.Category))
		set("tags", !sameStrings(a.Tags, b.Tags), models.StringArray(a.Tags))
		set("featuredImage", a.FeaturedImage != b.FeaturedImage, nullable(a.FeaturedImage))
		set("credit", a.Credit != b.Credit, nullable(a.Credit))
		set("game_id", a.GameID != b.GameID, nullableID(a.GameID))
		set("author", a.Author != b.Author, nullable(a.Author))
		set("author_id", a.AuthorID != b.AuthorID, nullableID(a.AuthorID))
		set("notify_on_publish", a.NotifyOnPublish != b.NotifyOnPublish, a.NotifyOnPublish)
		if out.created || a.Content != b.Content {
			// Same four columns as the editor of the site: the page renders the
			// per-theme copies.
			cols["article_content"] = a.Content
			cols["content"] = a.Content
			cols["content_white"] = utils.GenerateContentWhite(a.Content)
			cols["content_black"] = utils.GenerateContentBlack(a.Content)
		}

		var id int64
		if out.created {
			slug, err := uniqueSlug(tx, a.Title, 0)
			if err != nil {
				return err
			}
			row := models.Article{Title: &a.Title, Slug: &slug, Status: w.plan.Status}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			id = row.ID
		} else {
			id = w.cur.ID
			if !w.frozen && before.Title != a.Title {
				published, err := m.everPublished(tx, w.cur)
				if err != nil {
					return err
				}
				if !published {
					slug, err := uniqueSlug(tx, a.Title, id)
					if err != nil {
						return err
					}
					cols["slug"] = slug
				}
			}
			if editorial {
				cols["updated_at"] = now
			}
		}
		if w.plan.Publishes {
			cols["created_at"] = now
			cols["updated_at"] = now
		}

		// The status read before the save must still be the one in the table:
		// the scheduler may have published the article in between.
		res := tx.Model(&models.Article{}).Where("id = ? AND status = ?", id, statusBefore(w)).UpdateColumns(cols)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errStale
		}

		var saved models.Article
		if err := tx.First(&saved, id).Error; err != nil {
			return err
		}
		out.article = &saved
		// The version of a creation stays « brouillon »: the run of autosaves
		// that follows gets its own.
		logged, err := m.recordVersion(tx, &saved, w.by, out.label, w.autosave && !out.created)
		out.logged = logged
		return err
	})
	if errors.Is(err, errStale) {
		return out, refuse(http.StatusConflict, "stale", "L'article a changé entre-temps. Rechargez la page.")
	}
	if err != nil {
		return out, err
	}

	// Whatever the site cached under the old or the new address is stale as
	// soon as the article is, was or becomes visible.
	if before.Status == statusPublished || out.article.Status == statusPublished {
		m.articles.InvalidatePublicCaches(ctx, before.Slug, deref(out.article.Slug))
	}
	if w.plan.Publishes {
		m.notifyPublished(out.article)
	}
	return out, nil
}

func statusBefore(w articleWrite) string {
	if w.cur == nil {
		return w.plan.Status
	}
	return w.cur.Status
}

func sameSchedule(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return a.Equal(*b)
}

// notifyPublished sends the push of a publication, once. The request context
// ends with the response, hence a detached one.
func (m *Module) notifyPublished(a *models.Article) {
	if m.notifier == nil || !a.NotifyOnPublish || a.NotifiedAt != nil {
		return
	}
	// NotifyNewContent stamps NotifiedAt on what it is given.
	copied := *a
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		m.notifier.NotifyNewContent(ctx, &copied)
	}()
}

// recordVersion snapshots the article. Autosaves of one member within a few
// minutes share a version, or thirty versions would be thirty keystrokes.
func (m *Module) recordVersion(tx *gorm.DB, a *models.Article, by actor, label string, autosave bool) (bool, error) {
	snap := snapshotOf(a)
	snap.Autosave = autosave
	raw, err := json.Marshal(snap)
	if err != nil {
		return false, err
	}
	if autosave {
		var last struct {
			ID        int64
			ActorID   *int64
			Label     string
			CreatedAt time.Time
			Autosave  bool
		}
		err := tx.Raw(`SELECT id, actor_id, label, created_at, COALESCE((snapshot->>'autosave')::boolean, false) AS autosave
			FROM bo_article_version WHERE article_id = ? ORDER BY id DESC LIMIT 1`, a.ID).Scan(&last).Error
		if err != nil {
			return false, err
		}
		if last.ID != 0 && last.Autosave && last.ActorID != nil && *last.ActorID == by.ID && time.Since(last.CreatedAt) < autosaveWindow {
			return false, tx.Exec(`UPDATE bo_article_version SET snapshot = ?::jsonb, label = ? WHERE id = ?`,
				string(raw), mergeLabels(last.Label, label), last.ID).Error
		}
	}
	if err := tx.Exec(`INSERT INTO bo_article_version (article_id, actor_id, actor_name, label, snapshot)
		VALUES (?, ?, ?, ?, ?::jsonb)`, a.ID, nullableID(by.ID), clip(by.Name, 120), clip(label, 200), string(raw)).Error; err != nil {
		return false, err
	}
	return true, tx.Exec(`DELETE FROM bo_article_version WHERE article_id = ? AND id NOT IN (
		SELECT id FROM bo_article_version WHERE article_id = ? ORDER BY id DESC LIMIT ?)`, a.ID, a.ID, maxVersions).Error
}

func articleLabel(a *models.Article) string { return deref(a.Title) }

func articleRef(a *models.Article) string { return strconv.FormatInt(a.ID, 10) }

// auditSave writes the line of a save. A status move names the action; the
// rest is a plain update whose detail lists the fields.
func (m *Module) auditSave(c echo.Context, res articleWritten, plan transition) {
	if !res.changed || !res.logged {
		return
	}
	action, detail := plan.Action, res.label
	if action == "" {
		action = "article.updated"
	} else if detail == plan.Label {
		detail = ""
	} else {
		detail = strings.TrimPrefix(detail, plan.Label+", ")
	}
	if plan.Status == statusScheduled && plan.ScheduledAt != nil && plan.Action != "" {
		when := "pour le " + plan.ScheduledAt.In(parisTime()).Format("02/01/2006 à 15:04")
		if detail == "" {
			detail = when
		} else {
			detail = when + ", " + detail
		}
	}
	m.audit(c, action, "article", articleRef(res.article), articleLabel(res.article), detail)
}

func parisTime() *time.Location {
	if loc, err := time.LoadLocation("Europe/Paris"); err == nil {
		return loc
	}
	return time.UTC
}

func bindArticle(c echo.Context) (*articleInput, error) {
	var in articleInput
	if err := c.Bind(&in); err != nil {
		return nil, refuse(http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	return &in, nil
}

// planSave turns an input into a validated write.
func (m *Module) planSave(ctx context.Context, me *teamUser, cur *models.Article, in *articleInput) (articleWrite, error) {
	w := articleWrite{by: actor{ID: me.ID, Name: me.Name}, cur: cur, autosave: in.Autosave}
	after, err := m.overlay(ctx, me, cur, in)
	if err != nil {
		return w, err
	}
	from, to := "", ""
	var currentAt *time.Time
	if cur != nil {
		from, currentAt = cur.Status, cur.ScheduledAt
	}
	if in.Status != nil {
		to = *in.Status
	}
	plan, err := planTransition(from, to, currentAt, in.ScheduledAt, time.Now())
	switch {
	case errors.Is(err, errInvalidStatus):
		return w, refuse(http.StatusBadRequest, "invalid_input", "Statut inconnu")
	case errors.Is(err, errScheduleNeeded):
		return w, refuse(http.StatusBadRequest, "invalid_input", "Choisissez la date de publication")
	case errors.Is(err, errSchedulePast):
		return w, refuse(http.StatusBadRequest, "invalid_input", "La date de programmation doit être dans le futur")
	case err != nil:
		return w, err
	}
	after.Status, after.ScheduledAt = plan.Status, plan.ScheduledAt
	if msg := validateSnapshot(after); msg != "" {
		return w, refuse(http.StatusBadRequest, "invalid_input", msg)
	}
	// Only a draft saves itself: an autosave never reaches the site.
	if in.Autosave && (plan.Status != statusDraft || (cur != nil && cur.Status != statusDraft)) {
		return w, refuse(http.StatusBadRequest, "invalid_input", "Seul un brouillon s'enregistre automatiquement")
	}
	w.after, w.plan = after, plan
	return w, nil
}

func (m *Module) handleArticleCreate(c echo.Context) error {
	in, err := bindArticle(c)
	if err != nil {
		return m.answer(c, err)
	}
	ctx := c.Request().Context()
	w, err := m.planSave(ctx, sessionOf(c).User, nil, in)
	if err != nil {
		return m.answer(c, err)
	}
	res, err := m.writeArticle(ctx, w)
	if err != nil {
		return m.answer(c, err)
	}
	m.auditSave(c, res, w.plan)
	return c.JSON(http.StatusCreated, m.articleDetailOf(c, res.article))
}

const notYoursMessage = "Vous ne pouvez modifier que vos propres articles"

func (m *Module) handleArticleUpdate(c echo.Context) error {
	cur, err := m.loadArticle(c)
	if cur == nil {
		return err
	}
	me := sessionOf(c).User
	if !canEditArticle(me, cur) {
		return fail(c, http.StatusForbidden, "forbidden", notYoursMessage)
	}
	in, err := bindArticle(c)
	if err != nil {
		return m.answer(c, err)
	}
	ctx := c.Request().Context()
	w, err := m.planSave(ctx, me, cur, in)
	if err != nil {
		return m.answer(c, err)
	}
	res, err := m.writeArticle(ctx, w)
	if err != nil {
		return m.answer(c, err)
	}
	m.auditSave(c, res, w.plan)
	return c.JSON(http.StatusOK, m.articleDetailOf(c, res.article))
}

func (m *Module) deleteArticle(ctx context.Context, a *models.Article) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM bo_article_version WHERE article_id = ?", a.ID).Error; err != nil {
			return err
		}
		return tx.Exec("DELETE FROM articles WHERE id = ?", a.ID).Error
	})
	if err != nil {
		return err
	}
	m.articles.InvalidatePublicCaches(ctx, deref(a.Slug))
	return nil
}

func (m *Module) handleArticleDelete(c echo.Context) error {
	a, err := m.loadArticle(c)
	if a == nil {
		return err
	}
	if !canEditArticle(sessionOf(c).User, a) {
		return fail(c, http.StatusForbidden, "forbidden", "Vous ne pouvez supprimer que vos propres articles")
	}
	if err := m.deleteArticle(c.Request().Context(), a); err != nil {
		return m.internal(c, err)
	}
	m.audit(c, "article.deleted", "article", articleRef(a), articleLabel(a), statusWord(a.Status))
	return c.NoContent(http.StatusNoContent)
}

// handleArticlePurgeCache drops what the API keeps in Redis about an article.
// Every save already does it: this is for the day a page still shows an old
// version and nobody wants to edit the article to find out why.
func (m *Module) handleArticlePurgeCache(c echo.Context) error {
	a, err := m.loadArticle(c)
	if a == nil {
		return err
	}
	if !canEditArticle(sessionOf(c).User, a) {
		return fail(c, http.StatusForbidden, "forbidden", "Vous ne pouvez agir que sur vos propres articles")
	}
	m.articles.InvalidatePublicCaches(c.Request().Context(), deref(a.Slug))
	m.audit(c, "article.cache_purged", "article", articleRef(a), articleLabel(a), "")
	return c.NoContent(http.StatusNoContent)
}

func statusWord(status string) string {
	switch status {
	case statusDraft:
		return "brouillon"
	case statusScheduled:
		return "programmé"
	default:
		return "publié"
	}
}

type bulkInput struct {
	IDs      []int64 `json:"ids"`
	Action   string  `json:"action"`
	GameID   *int64  `json:"game_id"`
	Category *string `json:"category"`
}

const maxBulk = 200

// handleArticleBulk files many articles at once. Each one is checked against
// the member's rights; the answer says which were left alone.
func (m *Module) handleArticleBulk(c echo.Context) error {
	var in bulkInput
	if err := c.Bind(&in); err != nil || len(in.IDs) == 0 || len(in.IDs) > maxBulk {
		return fail(c, http.StatusBadRequest, "invalid_input", fmt.Sprintf("Sélectionnez entre 1 et %d articles", maxBulk))
	}
	ctx := c.Request().Context()
	me := sessionOf(c).User
	by := actor{ID: me.ID, Name: me.Name}

	var gameID int64
	detail := ""
	switch in.Action {
	case "set_game":
		if in.GameID == nil || *in.GameID < 0 {
			return fail(c, http.StatusBadRequest, "invalid_input", "Choisissez un jeu")
		}
		gameID, detail = *in.GameID, "Aucun jeu"
		if gameID > 0 {
			name, err := m.gameName(ctx, gameID)
			if err != nil {
				return m.answer(c, err)
			}
			detail = name
		}
	case "set_category":
		if in.Category == nil || trimmed(*in.Category) == "" {
			return fail(c, http.StatusBadRequest, "invalid_input", "Choisissez une catégorie")
		}
		detail = trimmed(*in.Category)
	case "delete":
	default:
		return fail(c, http.StatusBadRequest, "invalid_input", "Action inconnue")
	}

	var articles []models.Article
	if err := m.db.WithContext(ctx).Where("id IN ?", in.IDs).Find(&articles).Error; err != nil {
		return m.internal(c, err)
	}
	found := map[int64]bool{}
	refused, changed := []int64{}, 0
	for i := range articles {
		a := &articles[i]
		found[a.ID] = true
		if !canEditArticle(me, a) {
			refused = append(refused, a.ID)
			continue
		}
		if in.Action == "delete" {
			if err := m.deleteArticle(ctx, a); err != nil {
				return m.internal(c, err)
			}
			m.audit(c, "article.deleted", "article", articleRef(a), articleLabel(a), statusWord(a.Status))
			changed++
			continue
		}
		after := snapshotOf(a)
		label := "jeu"
		if in.Action == "set_game" {
			after.GameID = gameID
		} else {
			after.Category, label = detail, "catégorie"
		}
		res, err := m.writeArticle(ctx, articleWrite{
			by: by, cur: a, after: after, label: label,
			plan: transition{Status: a.Status, ScheduledAt: a.ScheduledAt},
		})
		if err != nil {
			return m.answer(c, err)
		}
		if res.changed {
			changed++
		}
	}
	missing := []int64{}
	for _, id := range in.IDs {
		if !found[id] {
			missing = append(missing, id)
		}
	}

	if changed > 0 && in.Action != "delete" {
		action := map[string]string{"set_game": "article.game_assigned", "set_category": "article.category_changed"}[in.Action]
		target := strconv.Itoa(changed) + " articles"
		if changed == 1 {
			target = "1 article"
		}
		m.audit(c, action, "article", "", target, detail)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"changed": changed, "refused": refused, "missing": missing})
}

type versionRow struct {
	ID        int64     `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	ActorID   *int64    `json:"actor_id"`
	ActorName string    `json:"actor_name"`
	Label     string    `json:"label"`
}

func (m *Module) handleArticleVersions(c echo.Context) error {
	a, err := m.loadArticle(c)
	if a == nil {
		return err
	}
	rows := []versionRow{}
	if err := m.db.WithContext(c.Request().Context()).Raw(
		`SELECT id, created_at, actor_id, actor_name, label FROM bo_article_version
		 WHERE article_id = ? ORDER BY id DESC LIMIT ?`, a.ID, maxVersions).Scan(&rows).Error; err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"versions": rows})
}

// handleArticleRestore puts the text of a version back. Status, address and
// publication date are not part of a version's reach.
func (m *Module) handleArticleRestore(c echo.Context) error {
	cur, err := m.loadArticle(c)
	if cur == nil {
		return err
	}
	me := sessionOf(c).User
	if !canEditArticle(me, cur) {
		return fail(c, http.StatusForbidden, "forbidden", notYoursMessage)
	}
	versionID, perr := strconv.ParseInt(c.Param("versionId"), 10, 64)
	if perr != nil || versionID <= 0 {
		return fail(c, http.StatusBadRequest, "invalid_input", "Version invalide")
	}
	ctx := c.Request().Context()
	var version struct {
		ID        int64
		CreatedAt time.Time
		Snapshot  string
	}
	if err := m.db.WithContext(ctx).Raw(
		`SELECT id, created_at, snapshot::text AS snapshot FROM bo_article_version WHERE id = ? AND article_id = ?`,
		versionID, cur.ID).Scan(&version).Error; err != nil {
		return m.internal(c, err)
	}
	if version.ID == 0 {
		return fail(c, http.StatusNotFound, "not_found", "Version introuvable")
	}
	var old articleSnapshot
	if err := json.Unmarshal([]byte(version.Snapshot), &old); err != nil {
		return m.internal(c, err)
	}

	after := snapshotOf(cur)
	after.Title, after.Subtitle, after.SeoTitle, after.Description = old.Title, old.Subtitle, old.SeoTitle, old.Description
	after.Content, after.Category, after.Tags = old.Content, old.Category, cleanTags(old.Tags)
	after.FeaturedImage, after.Credit = old.FeaturedImage, old.Credit
	after.Author, after.AuthorID = old.Author, old.AuthorID
	// A game or an author deleted since then can't come back.
	after.GameID = 0
	if old.GameID > 0 {
		if _, err := m.gameName(ctx, old.GameID); err == nil {
			after.GameID = old.GameID
		}
	}
	if after.AuthorID > 0 {
		if _, err := m.userByID(ctx, after.AuthorID); err != nil {
			after.AuthorID = 0
		}
	}
	if msg := validateSnapshot(after); msg != "" {
		return fail(c, http.StatusConflict, "invalid_version", "Cette version ne peut pas être restaurée sur un article "+statusWord(cur.Status)+" : "+strings.ToLower(msg[:1])+msg[1:])
	}

	res, err := m.writeArticle(ctx, articleWrite{
		by: actor{ID: me.ID, Name: me.Name}, cur: cur, after: after, frozen: true,
		label: "restauration",
		plan:  transition{Status: cur.Status, ScheduledAt: cur.ScheduledAt},
	})
	if err != nil {
		return m.answer(c, err)
	}
	if res.changed {
		m.audit(c, "article.restored", "article", articleRef(cur), articleLabel(res.article),
			"version du "+version.CreatedAt.In(parisTime()).Format("02/01/2006 à 15:04"))
	}
	return c.JSON(http.StatusOK, m.articleDetailOf(c, res.article))
}
