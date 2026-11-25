package backoffice

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

func authorsModule(t *testing.T) *Module {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Article{}))
	require.NoError(t, EnsureSchema(db))
	reset := func() {
		require.NoError(t, db.Exec("TRUNCATE author").Error)
		require.NoError(t, db.Exec("DELETE FROM bo_setting WHERE key = ?", settingAuthorsSeeded).Error)
		require.NoError(t, db.Exec("DELETE FROM users WHERE email LIKE '%@authors.test'").Error)
		require.NoError(t, db.Exec("DELETE FROM articles WHERE slug LIKE 'authors-test-%'").Error)
	}
	reset()
	t.Cleanup(reset)
	m := analyticsModule(t, Config{})
	m.db = db
	return m
}

func (m *Module) testMember(t *testing.T, name, email string, role Role) *teamUser {
	t.Helper()
	require.NoError(t, m.db.Exec(
		"INSERT INTO users (created_at, name, email, password, admin, role, team_since) VALUES (now(), ?, ?, 'x', false, ?, now())",
		name, email, string(role)).Error)
	u, err := m.userByEmail(context.Background(), email)
	require.NoError(t, err)
	return u
}

func TestAuthorRegistrySeedsOnceAndLinksAccountsByName(t *testing.T) {
	m := authorsModule(t)
	ctx := context.Background()
	samuel := m.testMember(t, "Samuel COHEN", "samuel@authors.test", RoleEditor)
	m.testMember(t, "Quelqu'un d'autre", "autre@authors.test", RoleEditor)

	require.NoError(t, m.seedAuthors(ctx))
	rows, err := m.loadAuthors(ctx)
	require.NoError(t, err)
	require.Len(t, rows, len(seededAuthors))

	var linked *int64
	for _, r := range rows {
		if r.Slug == "samuel-cohen" {
			linked = r.UserID
			require.Equal(t, []string{"Samuel C"}, splitAliases(r.Aliases))
		} else {
			require.Nil(t, r.UserID, "%s must not be linked to anyone", r.Slug)
		}
	}
	require.NotNil(t, linked, "the account bearing the author's name, whatever its case, gets the page")
	require.Equal(t, samuel.ID, *linked)

	// A second boot must not bring back a page the team deleted.
	require.NoError(t, m.db.Exec("DELETE FROM author WHERE slug = 'shawn-a'").Error)
	require.NoError(t, m.seedAuthors(ctx))
	rows, _ = m.loadAuthors(ctx)
	require.Len(t, rows, len(seededAuthors)-1)
}

func TestAnAliasOfTheLinkedAuthorPageSignsForTheMember(t *testing.T) {
	m := authorsModule(t)
	ctx := context.Background()
	m.testMember(t, "Samuel Cohen", "samuel@authors.test", RoleEditor)
	other := m.testMember(t, "Nathan Guillemant", "nathan@authors.test", RoleEditor)
	require.NoError(t, m.seedAuthors(ctx))

	samuel, err := m.userByEmail(ctx, "samuel@authors.test")
	require.NoError(t, err)
	alias, own, foreign := "Samuel C", "samuel  cohen", "Kenan Altarac"
	require.True(t, canEdit(samuel, nil, &alias), "an old article signed « Samuel C » belongs to Samuel Cohen")
	require.True(t, canEdit(samuel, nil, &own))
	require.False(t, canEdit(samuel, nil, &foreign))
	other, err = m.userByEmail(ctx, "nathan@authors.test")
	require.NoError(t, err)
	require.False(t, canEdit(other, nil, &alias))
	// A linked account wins over any byline.
	require.False(t, canEdit(samuel, &other.ID, &alias))
}

func TestPublicAuthorsNeverNameTheAccount(t *testing.T) {
	m := authorsModule(t)
	m.testMember(t, "Samuel Cohen", "samuel@authors.test", RoleEditor)
	require.NoError(t, m.seedAuthors(context.Background()))

	e := echo.New()
	m.registerAuthorRoutes(e.Group("/api"), e.Group("/api/bo", asMember(RoleAdmin)))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/authors", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "user_id")
	var out struct {
		Authors []authorView `json:"authors"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out.Authors, len(seededAuthors))

	// The team sees the link, and a page still signing articles can't be deleted.
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/bo/authors", nil))
	require.Contains(t, rec.Body.String(), `"user_id"`)

	require.NoError(t, m.db.Exec("INSERT INTO articles (created_at, slug, title, author) VALUES (now(), 'authors-test-1', 'T', ' samuel  c ')").Error)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/bo/authors/samuel-cohen", nil))
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/bo/authors", strings.NewReader(`{"name":"Élodie Martin","aliases":["Elodie M","élodie martin"]}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), `"slug":"elodie-martin"`)
	rows, _ := m.loadAuthors(context.Background())
	for _, r := range rows {
		if r.Slug == "elodie-martin" {
			require.Equal(t, []string{"Elodie M"}, splitAliases(r.Aliases), "a spelling equal to the name is not an alias")
		}
	}
}
