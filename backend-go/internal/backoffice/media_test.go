package backoffice

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/services/storagetest"
	"github.com/esportnews/backend/internal/utils"
)

var (
	pngBytes = append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte("p"), 2048)...)
	mp4Bytes = append([]byte("\x00\x00\x00\x18ftypmp42"), bytes.Repeat([]byte("v"), 2048)...)
)

func mediaTestModule(t *testing.T) (*Module, *storagetest.Bucket) {
	t.Helper()
	m, _ := adsTestModule(t)
	storage, bucket := storagetest.New(t)
	m.storage = storage
	return m, bucket
}

func uploadCall(e *echo.Echo, path, folder, filename string, content []byte) *httptest.ResponseRecorder {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if folder != "" {
		_ = w.WriteField("folder", folder)
	}
	if filename != "" {
		part, _ := w.CreateFormFile("file", filename)
		_, _ = part.Write(content)
	}
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func errorOf(t *testing.T, rec *httptest.ResponseRecorder) apiError {
	t.Helper()
	var e apiError
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &e), rec.Body.String())
	return e
}

func TestMediaKindReadsTheExtension(t *testing.T) {
	assert.Equal(t, "image", mediaKind("articles/covers/images/Photo.JPG"))
	assert.Equal(t, "image", mediaKind("a/b.webp"))
	assert.Equal(t, "video", mediaKind("articles/covers/videos/clip.mp4"))
	assert.Equal(t, "other", mediaKind("ads/images/notes.pdf"))
	assert.Equal(t, "other", mediaKind("ads/images/no-extension"))
}

func TestMediaListSaysWhenTheBucketIsNotConnected(t *testing.T) {
	m, _ := adsTestModule(t)
	e := boTestServer(m, RoleEditor)

	rec := call(e, http.MethodGet, "/api/bo/media", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"configured": false}`, rec.Body.String())

	assert.Equal(t, http.StatusServiceUnavailable, uploadCall(e, "/api/bo/upload/media", "ads/images", "a.png", pngBytes).Code)
	admin := boTestServer(m, RoleAdmin)
	assert.Equal(t, http.StatusServiceUnavailable, uploadCall(admin, "/api/bo/upload/ad", "", "a.png", pngBytes).Code)
	assert.Equal(t, http.StatusServiceUnavailable,
		call(admin, http.MethodDelete, "/api/bo/media", map[string]string{"url": storagetest.PublicURL + "/ads/images/a.png"}).Code)
}

type mediaListBody struct {
	Configured bool          `json:"configured"`
	Folder     string        `json:"folder"`
	Folders    []mediaFolder `json:"folders"`
	Items      []mediaItem   `json:"items"`
	NextCursor *string       `json:"next_cursor"`
}

func TestMediaListPagesAFolderNewestFirstWithinAPage(t *testing.T) {
	m, bucket := mediaTestModule(t)
	e := boTestServer(m, RoleEditor)
	day := time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC)
	bucket.Put("ads/images/a.png", pngBytes, day)
	bucket.Put("ads/images/b.mp4", mp4Bytes, day.Add(2*time.Hour))
	bucket.Put("ads/images/c.pdf", []byte("pdf"), day.Add(time.Hour))
	bucket.Put("articles/covers/images/cover.jpg", []byte("jpg"), day)
	bucket.Put("liq-images/logo.png", []byte("cache"), day)

	list := func(query string) mediaListBody {
		rec := call(e, http.MethodGet, "/api/bo/media"+query, nil)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var body mediaListBody
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		return body
	}

	first := list("?folder=ads/images&limit=2")
	assert.True(t, first.Configured)
	assert.Equal(t, "ads/images", first.Folder)
	require.Len(t, first.Items, 2)
	assert.Equal(t, []string{"ads/images/b.mp4", "ads/images/a.png"}, []string{first.Items[0].Key, first.Items[1].Key},
		"the page holds the first two keys, the most recent one on top")
	assert.Equal(t, mediaItem{
		Key: "ads/images/b.mp4", URL: storagetest.PublicURL + "/ads/images/b.mp4", Size: int64(len(mp4Bytes)),
		LastModified: day.Add(2 * time.Hour), Kind: "video",
	}, first.Items[0])
	require.NotNil(t, first.NextCursor)

	rest := list("?folder=ads/images&limit=2&cursor=" + *first.NextCursor)
	require.Len(t, rest.Items, 1)
	assert.Equal(t, "other", rest.Items[0].Kind)
	assert.Nil(t, rest.NextCursor)

	byDefault := list("")
	assert.Equal(t, "articles/covers/images", byDefault.Folder)
	require.Len(t, byDefault.Items, 1)
	var paths []string
	for _, f := range byDefault.Folders {
		paths = append(paths, f.Path)
	}
	assert.Equal(t, []string{"articles/covers/images", "articles/covers/videos", "articles/content/images", "ads/images", "avatars/users"}, paths)

	assert.Equal(t, http.StatusBadRequest, call(e, http.MethodGet, "/api/bo/media?folder=liq-images", nil).Code,
		"the image proxy's cache is not part of the library")

	bucket.Fail = true
	assert.Equal(t, http.StatusBadGateway, call(e, http.MethodGet, "/api/bo/media?folder=ads/images", nil).Code)
}

func TestMediaUploadStoresACheckedFile(t *testing.T) {
	m, bucket := mediaTestModule(t)
	e := boTestServer(m, RoleEditor)

	rec := uploadCall(e, "/api/bo/upload/media", "articles/content/images", "Ma Photo.PNG", pngBytes)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out struct {
		URL  string `json:"url"`
		Key  string `json:"key"`
		Kind string `json:"kind"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	assert.True(t, strings.HasPrefix(out.Key, "articles/content/images/"), out.Key)
	assert.True(t, strings.HasSuffix(out.Key, ".png"), "the stored name is generated, with a lower-case extension: %s", out.Key)
	assert.Equal(t, storagetest.PublicURL+"/"+out.Key, out.URL)
	assert.Equal(t, "image", out.Kind)
	stored, ok := bucket.Get(out.Key)
	require.True(t, ok)
	assert.Equal(t, pngBytes, stored.Body)
	assert.Equal(t, "image/png", stored.ContentType)

	var entry struct {
		Action      string
		TargetLabel string
		Detail      string
	}
	require.NoError(t, m.db.Raw("SELECT action, target_label, detail FROM bo_audit_log WHERE target_id = ?", out.Key).Scan(&entry).Error)
	assert.Equal(t, "media.uploaded", entry.Action)
	assert.Equal(t, "Ma Photo.PNG", entry.TargetLabel)
	assert.Equal(t, "Images dans les articles, 2 Ko", entry.Detail)

	refused := []struct {
		name     string
		folder   string
		filename string
		content  []byte
	}{
		{"no file", "ads/images", "", nil},
		{"unknown folder", "secrets", "a.png", pngBytes},
		{"cache folder", "liq-images", "a.png", pngBytes},
		{"read-only folder", "avatars/users", "a.png", pngBytes},
		{"extension not accepted", "ads/images", "page.html", []byte("<script>")},
		{"content is not what the extension says", "ads/images", "a.png", []byte("<script>alert(1)</script>")},
		{"a video in an image folder", "articles/content/images", "clip.mp4", mp4Bytes},
		{"an image in the video folder", "articles/covers/videos", "a.png", pngBytes},
		{"too heavy", "ads/images", "big.png", append([]byte("\x89PNG"), make([]byte, utils.MaxFileSize)...)},
	}
	before := len(bucket.Keys())
	for _, tc := range refused {
		t.Run(tc.name, func(t *testing.T) {
			rec := uploadCall(e, "/api/bo/upload/media", tc.folder, tc.filename, tc.content)
			assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
			assert.NotEmpty(t, errorOf(t, rec).Error)
		})
	}
	assert.Len(t, bucket.Keys(), before, "a refused file never reaches the bucket")

	bucket.Fail = true
	assert.Equal(t, http.StatusBadGateway, uploadCall(e, "/api/bo/upload/media", "ads/images", "a.png", pngBytes).Code)
}

func TestAdUploadReturnsTheMediaType(t *testing.T) {
	m, bucket := mediaTestModule(t)
	e := boTestServer(m, RoleAdmin)

	rec := uploadCall(e, "/api/bo/upload/ad", "", "spot.mp4", mp4Bytes)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	assert.Equal(t, "video", out["media_type"])
	assert.True(t, strings.HasPrefix(out["url"], storagetest.PublicURL+"/ads/images/"), out["url"])
	require.Len(t, bucket.Keys(), 1)
	stored, _ := bucket.Get(bucket.Keys()[0])
	assert.Equal(t, "video/mp4", stored.ContentType)

	rec = uploadCall(e, "/api/bo/upload/ad", "", "banner.png", pngBytes)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	assert.Equal(t, "image", out["media_type"])
}

func TestMediaUsagesFindWhereAFileIsShown(t *testing.T) {
	m, _ := mediaTestModule(t)
	ctx := context.Background()
	db := m.db
	cleanup := func() {
		require.NoError(t, db.Exec("DELETE FROM articles WHERE slug LIKE 'media-usage-%'").Error)
		require.NoError(t, db.Exec("DELETE FROM users WHERE email LIKE 'media-usage-%'").Error)
	}
	cleanup()
	t.Cleanup(cleanup)
	require.NoError(t, m.prepareAdSpots(ctx))

	// The cover was stored before the bucket got its own domain: same key, old host.
	require.NoError(t, db.Exec(`INSERT INTO articles (slug, title, "featuredImage") VALUES ('media-usage-cover', 'Finale des Worlds', ?)`,
		"https://pub-old.r2.dev/articles/covers/images/worlds.jpg").Error)
	require.NoError(t, db.Exec(`INSERT INTO articles (slug, title, "videoUrl") VALUES ('media-usage-video', 'Le clip', ?)`,
		storagetest.PublicURL+"/articles/covers/videos/clip.mp4").Error)
	require.NoError(t, db.Exec(`INSERT INTO articles (slug, title, article_content) VALUES ('media-usage-body', 'Guide 100%', ?)`,
		`<p>Texte</p><img src="`+storagetest.PublicURL+`/articles/content/images/guide_100%.png" alt="">`).Error)
	require.NoError(t, db.Exec(`UPDATE ad_spot SET media_url = ? WHERE key = 'sidebar-2'`, storagetest.PublicURL+"/ads/images/banner.png").Error)
	insertLegacyAd(t, db, 1, "Ancienne", "image", storagetest.PublicURL+"/ads/images/old.png", "https://partner.test/")
	require.NoError(t, db.Exec(`INSERT INTO users (name, email, password, avatar) VALUES ('Alex', 'media-usage-alex@test.local', 'x', ?)`,
		storagetest.PublicURL+"/avatars/users/3/avatar-3-1.jpg").Error)

	usages := func(key string) []mediaUsage {
		u, err := m.mediaUsages(ctx, key)
		require.NoError(t, err)
		return u
	}
	strip := func(list []mediaUsage) []mediaUsage {
		for i := range list {
			list[i].ID = ""
		}
		return list
	}

	assert.Equal(t, []mediaUsage{{Type: "article", Label: "Finale des Worlds", Where: "couverture"}}, strip(usages("articles/covers/images/worlds.jpg")))
	assert.Equal(t, []mediaUsage{{Type: "article", Label: "Le clip", Where: "vidéo"}}, strip(usages("articles/covers/videos/clip.mp4")))
	assert.Equal(t, []mediaUsage{{Type: "article", Label: "Guide 100%", Where: "contenu"}}, strip(usages("articles/content/images/guide_100%.png")))
	assert.Equal(t, []mediaUsage{{Type: "ad_spot", ID: "sidebar-2", Label: "Colonne droite, position 2", Where: "bannière"}}, usages("ads/images/banner.png"))
	assert.Equal(t, []mediaUsage{{Type: "ad", Label: "Ancienne", Where: "bannière"}}, strip(usages("ads/images/old.png")))
	assert.Equal(t, []mediaUsage{{Type: "user", Label: "Alex", Where: "avatar"}}, strip(usages("avatars/users/3/avatar-3-1.jpg")))

	assert.Empty(t, usages("articles/covers/images/unused.jpg"))
	assert.Empty(t, usages("articles/covers/images/orlds.jpg"), "a name that only ends like a used one")
	assert.Empty(t, usages("articles/content/images/guide_100X.png"), "LIKE wildcards in a key are literal")

	assert.Equal(t,
		"Ce média est encore utilisé : couverture de l'article « Finale des Worlds » ; emplacement publicitaire « Colonne droite, position 2 ». Retirez-le de là avant de le supprimer.",
		mediaInUseMessage([]mediaUsage{
			{Type: "article", Label: "Finale des Worlds", Where: "couverture"},
			{Type: "ad_spot", Label: "Colonne droite, position 2"},
		}))
}

func TestMediaDeleteRefusesAFileInUse(t *testing.T) {
	m, bucket := mediaTestModule(t)
	admin := boTestServer(m, RoleAdmin)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	now := time.Now()
	used, free := "ads/images/used.png", "ads/images/free.png"
	bucket.Put(used, pngBytes, now)
	bucket.Put(free, pngBytes, now)
	bucket.Put("liq-images/logo.png", pngBytes, now)
	require.NoError(t, m.db.Exec(`UPDATE ad_spot SET media_url = ? WHERE key = 'sidebar-1'`, storagetest.PublicURL+"/"+used).Error)

	del := func(e *echo.Echo, url string) *httptest.ResponseRecorder {
		return call(e, http.MethodDelete, "/api/bo/media", map[string]string{"url": url})
	}

	rec := del(admin, storagetest.PublicURL+"/"+used)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	var conflict struct {
		Error  string       `json:"error"`
		Code   string       `json:"code"`
		Usages []mediaUsage `json:"usages"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &conflict))
	assert.Equal(t, "media_in_use", conflict.Code)
	assert.Contains(t, conflict.Error, "emplacement publicitaire « Colonne droite, position 1 »")
	assert.Equal(t, []mediaUsage{{Type: "ad_spot", ID: "sidebar-1", Label: "Colonne droite, position 1", Where: "bannière"}}, conflict.Usages)

	for name, url := range map[string]string{
		"another site":      "https://i.postimg.cc/abc/banner.png",
		"the proxy's cache": storagetest.PublicURL + "/liq-images/logo.png",
		"outside a folder":  storagetest.PublicURL + "/ads/images/../../liq-images/logo.png",
		"empty":             "",
	} {
		assert.Equal(t, http.StatusBadRequest, del(admin, url).Code, name)
	}

	editor := boTestServer(m, RoleEditor)
	assert.Equal(t, http.StatusForbidden, del(editor, storagetest.PublicURL+"/"+free).Code, "an editor can't delete")
	assert.Equal(t, []string{free, used, "liq-images/logo.png"}, bucket.Keys(), "nothing left the bucket so far")

	assert.Equal(t, http.StatusNoContent, del(admin, storagetest.PublicURL+"/"+free).Code)
	assert.Equal(t, []string{used, "liq-images/logo.png"}, bucket.Keys())
	var actions []string
	require.NoError(t, m.db.Raw("SELECT action FROM bo_audit_log WHERE target_id = ?", free).Scan(&actions).Error)
	assert.Equal(t, []string{"media.deleted"}, actions)

	bucket.Fail = true
	bucket.Put("ads/images/stuck.png", pngBytes, now)
	assert.Equal(t, http.StatusBadGateway, del(admin, storagetest.PublicURL+"/ads/images/stuck.png").Code)
}

func TestMediaLibraryIsClosedToReaders(t *testing.T) {
	m, _ := mediaTestModule(t)
	e := boTestServer(m, RoleReader)
	assert.Equal(t, http.StatusForbidden, call(e, http.MethodGet, "/api/bo/media", nil).Code)
	assert.Equal(t, http.StatusForbidden, uploadCall(e, "/api/bo/upload/media", "ads/images", "a.png", pngBytes).Code)
	assert.Equal(t, http.StatusForbidden,
		call(e, http.MethodDelete, "/api/bo/media", map[string]string{"url": storagetest.PublicURL + "/ads/images/a.png"}).Code)
}
