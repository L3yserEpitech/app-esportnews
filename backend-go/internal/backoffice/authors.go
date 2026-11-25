package backoffice

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/utils"
)

// The author registry: one page of the site (/auteurs/<slug>) per journalist,
// every spelling of their byline, and the team account that signs as them. It
// used to be a list hardcoded in the site (frontend/app/lib/authors.ts).

func init() {
	schemaStatements = append(schemaStatements,
		`CREATE TABLE IF NOT EXISTS author (
			slug text PRIMARY KEY,
			name text NOT NULL,
			aliases text NOT NULL DEFAULT '',
			user_id bigint UNIQUE,
			created_at timestamptz NOT NULL DEFAULT now()
		)`,
	)
}

const (
	settingAuthorsSeeded = "authors.seeded"
	// aliasSeparator joins the spellings in one column: a byline never holds a line break.
	aliasSeparator = "\n"
)

// What the site's hardcoded registry held when it moved here. Aliases are the
// other spellings found in the bylines of production.
var seededAuthors = []struct{ slug, name, aliases string }{
	{"samuel-cohen", "Samuel Cohen", "Samuel C"},
	{"kenan-altarac", "Kenan Altarac", ""},
	{"nathan-guillemant", "Nathan Guillemant", ""},
	{"mickael-lemoult", "Mickael Lemoult", ""},
	{"alexandre-foumangoye", "Alexandre Foumangoye", ""},
	{"guillaume-vial", "Guillaume Vial", ""},
	{"haykel-el-abed", "Haykel El Abed", ""},
	{"jawed-aichouche", "Jawed Aichouche", ""},
	{"sami-zeroual", "Sami Zeroual", ""},
	{"thomas-noel", "Thomas Noël", ""},
	{"kenan-paris", "Kenan Paris", ""},
	{"shawn-a", "Shawn A", ""},
}

type authorRow struct {
	Slug    string `gorm:"column:slug"`
	Name    string `gorm:"column:name"`
	Aliases string `gorm:"column:aliases"`
	UserID  *int64 `gorm:"column:user_id"`
}

type authorView struct {
	Slug    string   `json:"slug"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
	UserID  *int64   `json:"user_id,omitempty"`
}

func splitAliases(raw string) []string {
	out := []string{}
	for _, a := range strings.Split(raw, aliasSeparator) {
		if a = strings.TrimSpace(a); a != "" {
			out = append(out, a)
		}
	}
	return out
}

func (r authorRow) view(withAccount bool) authorView {
	v := authorView{Slug: r.Slug, Name: r.Name, Aliases: splitAliases(r.Aliases)}
	if withAccount {
		v.UserID = r.UserID
	}
	return v
}

// seedAuthors copies the site's list once, then links each author to the team
// account that bears the same name.
func (m *Module) seedAuthors(ctx context.Context) error {
	if m.setting(ctx, settingAuthorsSeeded, "") != "" {
		return nil
	}
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, a := range seededAuthors {
			if err := tx.Exec("INSERT INTO author (slug, name, aliases) VALUES (?, ?, ?) ON CONFLICT (slug) DO NOTHING",
				a.slug, a.name, a.aliases).Error; err != nil {
				return err
			}
		}
		var members []struct {
			ID   int64
			Name string
		}
		if err := tx.Raw("SELECT id, name FROM users WHERE role <> 'user'").Scan(&members).Error; err != nil {
			return err
		}
		var authors []authorRow
		if err := tx.Raw("SELECT slug, name, aliases, user_id FROM author WHERE user_id IS NULL").Scan(&authors).Error; err != nil {
			return err
		}
		linked := map[int64]bool{}
		for _, a := range authors {
			for _, member := range members {
				if linked[member.ID] || bylineKey(member.Name) != bylineKey(a.Name) {
					continue
				}
				if err := tx.Exec("UPDATE author SET user_id = ? WHERE slug = ?", member.ID, a.Slug).Error; err != nil {
					return err
				}
				linked[member.ID] = true
				break
			}
		}
		return tx.Exec(`INSERT INTO bo_setting (key, value, updated_at) VALUES (?, ?, now())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			settingAuthorsSeeded, time.Now().UTC().Format(time.RFC3339)).Error
	})
}

func (m *Module) registerAuthorRoutes(api, g *echo.Group) {
	api.GET("/authors", m.handlePublicAuthors)

	a := g.Group("/authors", m.require(PermTeamManage))
	a.GET("", m.handleAuthorList)
	a.POST("", m.handleAuthorSave)
	a.PUT("/:slug", m.handleAuthorSave)
	a.DELETE("/:slug", m.handleAuthorDelete)
}

func (m *Module) loadAuthors(ctx context.Context) ([]authorRow, error) {
	rows := []authorRow{}
	err := m.db.WithContext(ctx).Raw("SELECT slug, name, aliases, user_id FROM author ORDER BY name").Scan(&rows).Error
	return rows, err
}

// handlePublicAuthors is what the site reads in place of its hardcoded list:
// slug, full name and every spelling, never the account behind.
func (m *Module) handlePublicAuthors(c echo.Context) error {
	ctx := c.Request().Context()
	c.Response().Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	if raw, err := m.cache.Get(ctx, cache.CacheAuthors); err == nil && raw != "" {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}
	rows, err := m.loadAuthors(ctx)
	if err != nil {
		return m.internal(c, err)
	}
	authors := make([]authorView, 0, len(rows))
	for _, r := range rows {
		authors = append(authors, r.view(false))
	}
	raw, _ := json.Marshal(map[string]interface{}{"authors": authors})
	m.cache.Set(ctx, cache.CacheAuthors, string(raw), time.Hour)
	return c.JSONBlob(http.StatusOK, raw)
}

func (m *Module) handleAuthorList(c echo.Context) error {
	rows, err := m.loadAuthors(c.Request().Context())
	if err != nil {
		return m.internal(c, err)
	}
	authors := make([]authorView, 0, len(rows))
	for _, r := range rows {
		authors = append(authors, r.view(true))
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"authors": authors})
}

type authorInput struct {
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
	// UserID: nil leaves the link alone, 0 removes it.
	UserID *int64 `json:"user_id"`
}

func (m *Module) handleAuthorSave(c echo.Context) error {
	var in authorInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	name := clip(in.Name, 80)
	if name == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Le nom est obligatoire")
	}
	aliases := []string{}
	for _, a := range in.Aliases {
		if a = clip(a, 80); a != "" && bylineKey(a) != bylineKey(name) {
			aliases = append(aliases, a)
		}
	}

	slug := c.Param("slug")
	creating := slug == ""
	if creating {
		// The slug is the address of the author page: set once, from the name.
		if slug = utils.GenerateSlug(name, 0, 0); slug == "" {
			return fail(c, http.StatusBadRequest, "invalid_input", "Ce nom ne donne pas d'adresse lisible")
		}
	}

	var link interface{}
	if in.UserID != nil && *in.UserID > 0 {
		member, err := m.userByID(ctx, *in.UserID)
		if err != nil || !member.Role.IsTeam() {
			return fail(c, http.StatusBadRequest, "invalid_input", "Ce compte ne fait pas partie de l'équipe")
		}
		link = member.ID
	}

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if link != nil {
			// One page per member: taking it frees the one they had.
			if err := tx.Exec("UPDATE author SET user_id = NULL WHERE user_id = ? AND slug <> ?", link, slug).Error; err != nil {
				return err
			}
		}
		if creating {
			res := tx.Exec("INSERT INTO author (slug, name, aliases, user_id) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING",
				slug, name, strings.Join(aliases, aliasSeparator), link)
			if res.Error == nil && res.RowsAffected == 0 {
				return errAuthorExists
			}
			return res.Error
		}
		res := tx.Exec("UPDATE author SET name = ?, aliases = ? WHERE slug = ?", name, strings.Join(aliases, aliasSeparator), slug)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		if in.UserID != nil {
			return tx.Exec("UPDATE author SET user_id = ? WHERE slug = ?", link, slug).Error
		}
		return nil
	})
	switch {
	case errors.Is(err, errAuthorExists):
		return fail(c, http.StatusConflict, "exists", "Une fiche auteur porte déjà ce nom")
	case errors.Is(err, gorm.ErrRecordNotFound):
		return fail(c, http.StatusNotFound, "not_found", "Fiche auteur introuvable")
	case err != nil:
		return m.internal(c, err)
	}
	m.cache.Del(ctx, cache.CacheAuthors)
	detail := "modifiée"
	if creating {
		detail = "créée"
	}
	m.audit(c, "team.author_saved", "author", slug, name, detail)
	return c.JSON(http.StatusOK, map[string]interface{}{"slug": slug})
}

var errAuthorExists = errors.New("author exists")

func (m *Module) handleAuthorDelete(c echo.Context) error {
	ctx := c.Request().Context()
	slug := c.Param("slug")
	var row authorRow
	if err := m.db.WithContext(ctx).Raw("SELECT slug, name, aliases, user_id FROM author WHERE slug = ?", slug).Scan(&row).Error; err != nil {
		return m.internal(c, err)
	}
	if row.Slug == "" {
		return fail(c, http.StatusNotFound, "not_found", "Fiche auteur introuvable")
	}
	// The page lists this author's articles: it must not vanish under them.
	var signed int64
	names := append(splitAliases(row.Aliases), row.Name)
	keys := make([]string, 0, len(names))
	for _, n := range names {
		keys = append(keys, strings.ToLower(strings.Join(strings.Fields(n), " ")))
	}
	if err := m.db.WithContext(ctx).Raw(
		`SELECT count(*) FROM articles WHERE LOWER(regexp_replace(TRIM(author), '\s+', ' ', 'g')) IN ?`, keys).Scan(&signed).Error; err != nil {
		return m.internal(c, err)
	}
	if signed > 0 {
		return fail(c, http.StatusConflict, "in_use", "Des articles portent cette signature : la fiche ne peut pas être supprimée")
	}
	if err := m.db.WithContext(ctx).Exec("DELETE FROM author WHERE slug = ?", slug).Error; err != nil {
		return m.internal(c, err)
	}
	m.cache.Del(ctx, cache.CacheAuthors)
	m.audit(c, "team.author_saved", "author", slug, row.Name, "supprimée")
	return c.NoContent(http.StatusNoContent)
}
