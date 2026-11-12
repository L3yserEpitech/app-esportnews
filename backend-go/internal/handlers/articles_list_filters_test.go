package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/testdb"
)

// Vide toute la table : ces tests couvrent aussi les requêtes sans catégorie.
func articleListServer(t *testing.T) (*echo.Echo, *gorm.DB) {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.Article{}))

	cleanup := func() { require.NoError(t, db.Exec(`DELETE FROM articles`).Error) }
	cleanup()
	t.Cleanup(cleanup)

	h := &ArticleHandler{service: services.NewArticleServiceWithGORM(&database.Database{DB: db}, testCache(t))}
	e := echo.New()
	h.RegisterRoutes(e.Group("/api"))
	return e, db
}

type listSeed struct {
	slug     string
	category string
	author   string
	game     int64 // 0 = aucun jeu
}

var listSeedBase = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

// Le premier de la liste est le plus récent, comme dans une réponse de l'API.
func seedArticleList(t *testing.T, db *gorm.DB, seeds []listSeed) {
	t.Helper()
	for i, s := range seeds {
		slug, title := s.slug, "Titre "+s.slug
		a := models.Article{Slug: &slug, Title: &title, CreatedAt: listSeedBase.Add(-time.Duration(i) * time.Hour)}
		if s.category != "" {
			category := s.category
			a.Category = &category
		}
		if s.author != "" {
			author := s.author
			a.Author = &author
		}
		if s.game != 0 {
			game := s.game
			a.GameID = &game
		}
		require.NoError(t, db.Create(&a).Error)
	}
}

type listResult struct {
	status int
	header http.Header
	raw    string
	slugs  []string
	rows   []models.Article
}

func listGet(t *testing.T, srv http.Handler, path string) listResult {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	res := listResult{status: rec.Code, header: rec.Header(), raw: strings.TrimSpace(rec.Body.String())}
	if rec.Code == http.StatusOK && strings.HasPrefix(path, "/api/articles") {
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res.rows), "path=%s body=%s", path, res.raw)
		for _, a := range res.rows {
			res.slugs = append(res.slugs, *a.Slug)
		}
	}
	return res
}

func listCount(t *testing.T, srv http.Handler, query string) int64 {
	t.Helper()
	res := listGet(t, srv, "/api/count-articles?"+query)
	require.Equal(t, http.StatusOK, res.status, "query=%s", query)
	var body map[string]int64
	require.NoError(t, json.Unmarshal([]byte(res.raw), &body))
	return body["count"]
}

// a1..a10, du plus récent au plus ancien.
var filterMatrixSeeds = []listSeed{
	{"a1", "Actus", "Samuel C", 3},
	{"a2", "Actus", "Samuel Cohen", 3},
	{"a3", "Actus", "  samuel   COHEN ", 3},
	{"a4", "Actus", "Kenan", 3},
	{"a5", "Actus", "Kenan", 5},
	{"a6", "Actus", "Kenan", 0},
	{"a7", "Analyse", "Samuel Cohen", 3},
	{"a8", "Analyse", "Kenan", 5},
	{"a9", "Analyse", "Kenan", 0},
	{"a10", "Interview", "Samuel C", 3},
}

func TestGameIDRejectedValues(t *testing.T) {
	srv, db := articleListServer(t)
	seedArticleList(t, db, filterMatrixSeeds)

	for _, value := range []string{"abc", "0", "-3", "9223372036854775808"} {
		for _, route := range []string{"/api/articles", "/api/count-articles"} {
			t.Run(route+"/"+value, func(t *testing.T) {
				res := listGet(t, srv, route+"?game_id="+value)
				assert.Equal(t, http.StatusBadRequest, res.status)
				assert.Contains(t, res.raw, "Invalid game_id")
				assert.Empty(t, res.header.Get("Cache-Control"), "un 400 ne doit pas être mis en cache public")
				assert.Empty(t, res.header.Get("X-Total-Count"))
			})
		}
	}
}

func TestListArticlesFilterMatrix(t *testing.T) {
	srv, db := articleListServer(t)
	seedArticleList(t, db, filterMatrixSeeds)

	samuel := url.QueryEscape("Samuel C,Samuel Cohen")
	cases := []struct {
		name  string
		query string
		slugs []string
	}{
		{"aucun filtre", "", []string{"a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"}},
		{"jeu seul, toutes catégories", "game_id=3", []string{"a1", "a2", "a3", "a4", "a7", "a10"}},
		{"catégorie + jeu", "category=Actus&game_id=3", []string{"a1", "a2", "a3", "a4"}},
		{"catégorie + jeu sans intersection", "category=Interview&game_id=5", []string{}},
		{"excludeNews + jeu", "excludeNews=true&game_id=3", []string{"a7", "a10"}},
		{"excludeNews=false ne filtre pas", "excludeNews=false&game_id=5", []string{"a5", "a8"}},
		{"catégorie prime sur excludeNews, avec jeu", "category=Actus&excludeNews=true&game_id=5", []string{"a5"}},
		{"excludeNews écarte aussi les sans jeu sans filtre", "excludeNews=true", []string{"a7", "a8", "a9", "a10"}},
		{"auteur + jeu, alias et espaces", "author=" + samuel + "&game_id=3", []string{"a1", "a2", "a3", "a7", "a10"}},
		{"auteur + jeu sans intersection", "author=" + samuel + "&game_id=5", []string{}},
		{"auteur + catégorie + jeu", "author=" + samuel + "&category=Actus&game_id=3", []string{"a1", "a2", "a3"}},
		{"auteur + excludeNews + jeu", "author=" + samuel + "&excludeNews=true&game_id=3", []string{"a7", "a10"}},
		{"auteur inconnu + jeu", "author=Personne&game_id=3", []string{}},
		{"auteur réduit à une virgule + jeu", "author=,&game_id=3", []string{}},
		{"auteur blanc = aucun filtre d'auteur", "author=%20&game_id=5", []string{"a5", "a8"}},
		{"catégorie inconnue + jeu", "category=Nope&game_id=3", []string{}},
		{"catégorie avec apostrophe", "category=" + url.QueryEscape("l'équipe") + "&game_id=3", []string{}},
		{"jeu inexistant", "game_id=999", []string{}},
		{"game_id vide = aucun filtre", "game_id=", []string{"a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := listGet(t, srv, "/api/articles?"+tc.query)
			require.Equal(t, http.StatusOK, res.status, res.raw)
			if len(tc.slugs) == 0 {
				assert.Equal(t, "[]", res.raw, "une liste vide doit rester un tableau JSON")
			} else {
				assert.Equal(t, tc.slugs, res.slugs)
			}
			assert.Equal(t, fmt.Sprint(len(tc.slugs)), res.header.Get("X-Total-Count"))
			assert.Equal(t, int64(len(tc.slugs)), listCount(t, srv, tc.query), "count-articles doit dire pareil")
			assert.Equal(t, "public, max-age=60, stale-while-revalidate=300", res.header.Get("Cache-Control"))
		})
	}
}

func TestListArticlesExposesGameIDOfEachRow(t *testing.T) {
	srv, db := articleListServer(t)
	seedArticleList(t, db, filterMatrixSeeds)

	for _, row := range listGet(t, srv, "/api/articles?game_id=5").rows {
		require.NotNil(t, row.GameID)
		assert.Equal(t, int64(5), *row.GameID)
	}
	raw := listGet(t, srv, "/api/articles?category=Actus&limit=1&offset=5").raw
	assert.Contains(t, raw, `"game_id":null`, "un article sans jeu expose null, pas un champ absent")
}

func TestListArticlesLimitAndOffsetWithGame(t *testing.T) {
	srv, db := articleListServer(t)
	var seeds []listSeed
	for i := 0; i < 25; i++ {
		seeds = append(seeds, listSeed{slug: fmt.Sprintf("g%02d", i), category: "Actus", game: 3})
	}
	seeds = append(seeds, listSeed{slug: "autre", category: "Actus", game: 5})
	seedArticleList(t, db, seeds)

	cases := []struct {
		name  string
		query string
		rows  int
		first string
	}{
		{"limite par défaut", "", 20, "g00"},
		{"limit=1", "limit=1", 1, "g00"},
		{"limit=101 retombe sur le défaut, pas sur le plafond", "limit=101", 20, "g00"},
		{"dernière ligne", "limit=9&offset=24", 1, "g24"},
		{"juste après la dernière ligne", "limit=9&offset=25", 0, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := listGet(t, srv, "/api/articles?game_id=3&"+tc.query)
			require.Equal(t, http.StatusOK, res.status, res.raw)
			assert.Len(t, res.rows, tc.rows)
			assert.Equal(t, "25", res.header.Get("X-Total-Count"), "le total ne dépend ni de limit ni d'offset")
			if tc.rows > 0 {
				assert.Equal(t, tc.first, res.slugs[0])
			} else {
				assert.Equal(t, "[]", res.raw)
			}
		})
	}
}
