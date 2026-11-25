package backoffice

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/utils"
)

func (m *Module) registerArticleRoutes(g *echo.Group) {
	write := m.require(PermArticlesWrite)

	g.GET("/articles", m.handleArticleList)
	g.GET("/articles/meta", m.handleArticleMeta)
	g.GET("/articles/:id", m.handleArticleGet)
	g.GET("/articles/:id/versions", m.handleArticleVersions)

	g.POST("/articles", m.handleArticleCreate, write)
	g.PUT("/articles/:id", m.handleArticleUpdate, write)
	g.DELETE("/articles/:id", m.handleArticleDelete, write)
	g.POST("/articles/bulk", m.handleArticleBulk, write)
	g.POST("/articles/:id/versions/:versionId/restore", m.handleArticleRestore, write)

	g.POST("/upload/article-cover", m.handleArticleUpload("articles/covers", "couverture d'article"), write)
	g.POST("/upload/article-content", m.handleArticleUpload("articles/content", "contenu d'article"), write)
}

// The categories the site has pages and labels for. The list of an article also
// offers any other value already in use.
var siteCategories = []string{"Actus", "Analyse", "Compétition", "Enquête", "Gaming", "Guide", "Interview", "Portrait", "Test produit"}

type articleListRow struct {
	ID              int64      `json:"id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	Status          string     `json:"status"`
	Category        string     `json:"category"`
	GameID          *int64     `json:"game_id"`
	Author          string     `json:"author"`
	AuthorID        *int64     `json:"author_id"`
	CreatedAt       time.Time  `json:"created_at"`
	ScheduledAt     *time.Time `json:"scheduled_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Views           int64      `json:"views"`
	NotifiedAt      *time.Time `json:"notified_at"`
	NotifyOnPublish bool       `json:"notify_on_publish"`
	CanEdit         bool       `json:"can_edit" gorm:"-"`
}

const articleListColumns = `id, COALESCE(title, '') AS title, COALESCE(slug, '') AS slug, status,
	COALESCE(category, '') AS category, game_id, COALESCE(author, '') AS author, author_id,
	created_at, scheduled_at, updated_at, COALESCE(views, 0) AS views, notified_at, notify_on_publish`

// What « Trié par date de publication » means across statuses: the day a
// scheduled article goes out, the last edit of a draft.
const articleListOrder = `CASE status WHEN 'scheduled' THEN COALESCE(scheduled_at, created_at)
	WHEN 'draft' THEN COALESCE(updated_at, created_at) ELSE created_at END DESC, id DESC`

var spaces = regexp.MustCompile(`\s+`)

// articleFilters applies every filter of the list but the status, so the tabs
// can count each status under the same selection.
func articleFilters(c echo.Context, q *gorm.DB) *gorm.DB {
	if search := strings.TrimSpace(c.QueryParam("q")); search != "" {
		like := "%" + escapeLike(search) + "%"
		cond := "title ILIKE ? OR slug ILIKE ? OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE ?)"
		args := []interface{}{like, like, like}
		// A slug carries no accent: matching it folded finds « équipe » typed « equipe ».
		if folded := utils.GenerateSlug(search, 0, 0); folded != "" {
			cond += " OR slug LIKE ?"
			args = append(args, "%"+escapeLike(folded)+"%")
		}
		q = q.Where("("+cond+")", args...)
	}
	if category := strings.TrimSpace(c.QueryParam("category")); category != "" {
		q = q.Where("category = ?", category)
	}
	if c.QueryParam("no_game") == "1" {
		q = q.Where("game_id IS NULL")
	} else if gameID, err := strconv.ParseInt(c.QueryParam("game_id"), 10, 64); err == nil && gameID > 0 {
		q = q.Where("game_id = ?", gameID)
	}
	if author := strings.ToLower(spaces.ReplaceAllString(strings.TrimSpace(c.QueryParam("author")), " ")); author != "" {
		q = q.Where(`LOWER(regexp_replace(TRIM(author), '\s+', ' ', 'g')) = ?`, author)
	}
	return q
}

func (m *Module) handleArticleList(c echo.Context) error {
	ctx := c.Request().Context()
	limit, offset := 25, 0
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil && n > 0 {
		limit = min(n, 100)
	}
	if n, err := strconv.Atoi(c.QueryParam("offset")); err == nil && n > 0 {
		offset = n
	}
	status := c.QueryParam("status")

	var counts struct {
		All       int64 `json:"all" gorm:"column:total"`
		Published int64 `json:"published"`
		Scheduled int64 `json:"scheduled"`
		Draft     int64 `json:"draft"`
	}
	err := articleFilters(c, m.db.WithContext(ctx).Table("articles")).Select(
		`count(*) AS total,
		 count(*) FILTER (WHERE status = 'published') AS published,
		 count(*) FILTER (WHERE status = 'scheduled') AS scheduled,
		 count(*) FILTER (WHERE status = 'draft') AS draft`).Scan(&counts).Error
	if err != nil {
		return m.internal(c, err)
	}

	q := articleFilters(c, m.db.WithContext(ctx).Table("articles"))
	total := counts.All
	if validStatus(status) {
		q = q.Where("status = ?", status)
		total = map[string]int64{statusPublished: counts.Published, statusScheduled: counts.Scheduled, statusDraft: counts.Draft}[status]
	}
	rows := []articleListRow{}
	if err := q.Select(articleListColumns).Order(articleListOrder).Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return m.internal(c, err)
	}
	me := sessionOf(c).User
	for i := range rows {
		rows[i].CanEdit = canEdit(me, rows[i].AuthorID, &rows[i].Author)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"articles": rows, "total": total, "counts": counts})
}

func (m *Module) handleArticleMeta(c echo.Context) error {
	ctx := c.Request().Context()
	db := m.db.WithContext(ctx)

	inUse := []string{}
	if err := db.Raw(`SELECT category FROM articles WHERE COALESCE(category, '') <> ''
		GROUP BY category ORDER BY count(*) DESC, category`).Scan(&inUse).Error; err != nil {
		return m.internal(c, err)
	}
	categories := append([]string{}, inUse...)
	for _, known := range siteCategories {
		found := false
		for _, used := range inUse {
			found = found || used == known
		}
		if !found {
			categories = append(categories, known)
		}
	}

	type option struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Acronym string `json:"acronym,omitempty"`
	}
	authors := []option{}
	if err := db.Raw(`SELECT id, name FROM users WHERE role IN ('admin', 'editor') ORDER BY name`).Scan(&authors).Error; err != nil {
		return m.internal(c, err)
	}
	bylines := []string{}
	if err := db.Raw(`SELECT DISTINCT TRIM(author) AS byline FROM articles WHERE TRIM(COALESCE(author, '')) <> '' ORDER BY byline`).
		Scan(&bylines).Error; err != nil {
		return m.internal(c, err)
	}
	games := []option{}
	if err := db.Raw(`SELECT id, COALESCE(NULLIF(full_name, ''), name, '') AS name, COALESCE(acronym, '') AS acronym
		FROM games ORDER BY id`).Scan(&games).Error; err != nil {
		return m.internal(c, err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"categories":     categories,
		"authors":        authors,
		"bylines":        bylines,
		"games":          games,
		"notify_default": m.settingBool(ctx, SettingNotifyNewArticle, true),
	})
}

type articlePush struct {
	Status    string     `json:"status"` // "sent" or "none"
	SentAt    *time.Time `json:"sent_at"`
	Sent      *int       `json:"sent"`
	Delivered *int       `json:"delivered"`
	Failed    *int       `json:"failed"`
}

// articleDetail is the editor's view of an article: one body field, whatever
// column the row stores it in, and none of the per-theme copies.
type articleDetail struct {
	ID              int64      `json:"id"`
	Slug            string     `json:"slug"`
	Title           string     `json:"title"`
	Subtitle        string     `json:"subtitle"`
	SeoTitle        string     `json:"seo_title"`
	Description     string     `json:"description"`
	ArticleContent  string     `json:"article_content"`
	Category        string     `json:"category"`
	Tags            []string   `json:"tags"`
	FeaturedImage   string     `json:"featuredImage"`
	VideoURL        string     `json:"videoUrl"`
	VideoType       string     `json:"videoType"`
	Credit          string     `json:"credit"`
	GameID          *int64     `json:"game_id"`
	Author          string     `json:"author"`
	AuthorID        *int64     `json:"author_id"`
	Status          string     `json:"status"`
	ScheduledAt     *time.Time `json:"scheduled_at"`
	NotifyOnPublish bool       `json:"notify_on_publish"`
	NotifiedAt      *time.Time `json:"notified_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Views           int32      `json:"views"`

	Push       articlePush `json:"push"`
	CanEdit    bool        `json:"can_edit"`
	PublicPath string      `json:"public_path"`
	PublicURL  string      `json:"public_url,omitempty"`
}

func (m *Module) articleDetailOf(c echo.Context, a *models.Article) articleDetail {
	s := snapshotOf(a)
	d := articleDetail{
		ID: a.ID, Slug: s.Slug, Title: s.Title, Subtitle: s.Subtitle, SeoTitle: s.SeoTitle,
		Description: s.Description, ArticleContent: s.Content, Category: s.Category, Tags: s.Tags,
		FeaturedImage: s.FeaturedImage, VideoURL: deref(a.VideoURL), VideoType: deref(a.VideoType),
		Credit: s.Credit, GameID: a.GameID, Author: s.Author, AuthorID: a.AuthorID,
		Status: a.Status, ScheduledAt: a.ScheduledAt, NotifyOnPublish: a.NotifyOnPublish,
		NotifiedAt: a.NotifiedAt, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt, Views: a.Views,
		Push:       m.articlePushOf(c, a),
		CanEdit:    canEditArticle(sessionOf(c).User, a),
		PublicPath: publicPath(s.Slug, nil),
	}
	if a.Status == statusPublished {
		d.PublicPath = publicPath(s.Slug, &a.CreatedAt)
		d.PublicURL = strings.TrimRight(m.cfg.SiteURL, "/") + d.PublicPath
	}
	return d
}

// articlePushOf reads what the push module logged for this article. An article
// notified before that log existed only has its date.
func (m *Module) articlePushOf(c echo.Context, a *models.Article) articlePush {
	var row struct {
		CreatedAt time.Time
		Sent      int
		Delivered int
		Failed    int
	}
	err := m.db.WithContext(c.Request().Context()).Raw(
		`SELECT created_at, sent, delivered, failed FROM bo_push_log
		 WHERE kind = 'article' AND ref = ? ORDER BY id DESC LIMIT 1`, strconv.FormatInt(a.ID, 10)).Scan(&row).Error
	if err != nil {
		m.log.WithError(err).Warn("[BO] push log unreadable for an article")
	}
	switch {
	case err == nil && !row.CreatedAt.IsZero():
		return articlePush{Status: "sent", SentAt: &row.CreatedAt, Sent: &row.Sent, Delivered: &row.Delivered, Failed: &row.Failed}
	case a.NotifiedAt != nil:
		return articlePush{Status: "sent", SentAt: a.NotifiedAt}
	default:
		return articlePush{Status: "none"}
	}
}

var errArticleNotFound = errors.New("article not found")

func (m *Module) articleByID(c echo.Context, id int64) (*models.Article, error) {
	var a models.Article
	err := m.db.WithContext(c.Request().Context()).First(&a, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errArticleNotFound
	}
	return &a, err
}

// loadArticle answers the 400/404/500 itself and returns nil when it did.
func (m *Module) loadArticle(c echo.Context) (*models.Article, error) {
	id, ok := idParam(c)
	if !ok {
		return nil, fail(c, http.StatusBadRequest, "invalid_input", "Identifiant invalide")
	}
	a, err := m.articleByID(c, id)
	if errors.Is(err, errArticleNotFound) {
		return nil, fail(c, http.StatusNotFound, "not_found", "Article introuvable")
	}
	if err != nil {
		return nil, m.internal(c, err)
	}
	return a, nil
}

func (m *Module) handleArticleGet(c echo.Context) error {
	a, err := m.loadArticle(c)
	if a == nil {
		return err
	}
	return c.JSON(http.StatusOK, m.articleDetailOf(c, a))
}
