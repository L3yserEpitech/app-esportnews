package backoffice

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

const (
	mediaPageDefault = 60
	mediaPageMax     = 200
)

type mediaFolder struct {
	Path  string `json:"path"`
	Label string `json:"label"`
	// Kinds an upload from the library may put there; none = read only.
	Accept []string `json:"accept"`
}

// The key prefixes the application writes to. `liq-images` is left out on
// purpose: it is the image proxy's cache of Liquipedia logos, not media anyone
// chose, and it holds tens of thousands of objects.
var mediaFolders = []mediaFolder{
	{Path: "articles/covers/images", Label: "Couvertures d'articles", Accept: []string{"image"}},
	{Path: "articles/covers/videos", Label: "Vidéos de couverture", Accept: []string{"video"}},
	{Path: "articles/content/images", Label: "Images dans les articles", Accept: []string{"image"}},
	{Path: "ads/images", Label: "Publicités", Accept: []string{"image", "video"}},
	{Path: "avatars/users", Label: "Avatars des comptes", Accept: []string{}},
}

func mediaFolderByPath(p string) *mediaFolder {
	for i := range mediaFolders {
		if mediaFolders[i].Path == p {
			return &mediaFolders[i]
		}
	}
	return nil
}

func mediaFolderOfKey(key string) *mediaFolder {
	for i := range mediaFolders {
		if strings.HasPrefix(key, mediaFolders[i].Path+"/") {
			return &mediaFolders[i]
		}
	}
	return nil
}

func (f *mediaFolder) accepts(kind string) bool {
	for _, k := range f.Accept {
		if k == kind {
			return true
		}
	}
	return false
}

var mediaTypes = map[string]struct{ kind, mime string }{
	".jpg":  {"image", "image/jpeg"},
	".jpeg": {"image", "image/jpeg"},
	".png":  {"image", "image/png"},
	".webp": {"image", "image/webp"},
	".gif":  {"image", "image/gif"},
	".avif": {"image", "image/avif"},
	".svg":  {"image", "image/svg+xml"},
	".mp4":  {"video", "video/mp4"},
	".webm": {"video", "video/webm"},
	".mov":  {"video", "video/quicktime"},
}

func mediaKind(name string) string {
	if t, ok := mediaTypes[strings.ToLower(path.Ext(name))]; ok {
		return t.kind
	}
	return "other"
}

func (m *Module) registerMediaRoutes(g *echo.Group) {
	lib := g.Group("/media", m.require(PermMediaManage))
	lib.GET("", m.handleMediaList)
	// Removing a file can break a page someone else wrote: admins only.
	lib.DELETE("", m.handleMediaDelete, m.require(PermArticlesWriteAny))
	g.POST("/upload/media", m.handleMediaUpload, m.require(PermMediaManage))
}

type mediaItem struct {
	Key          string    `json:"key"`
	URL          string    `json:"url"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"last_modified"`
	Kind         string    `json:"kind"`
}

func (m *Module) handleMediaList(c echo.Context) error {
	if !m.storage.Enabled() {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": false})
	}
	folder := mediaFolderByPath(c.QueryParam("folder"))
	if c.QueryParam("folder") == "" {
		folder = &mediaFolders[0]
	}
	if folder == nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Dossier inconnu")
	}
	limit := mediaPageDefault
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil && n > 0 {
		limit = min(n, mediaPageMax)
	}
	ctx, cancel := context.WithTimeout(c.Request().Context(), 20*time.Second)
	defer cancel()
	objects, next, err := m.storage.List(ctx, folder.Path+"/", c.QueryParam("cursor"), int32(limit))
	if err != nil {
		m.log.WithError(err).Error("[BO] media listing failed")
		return fail(c, http.StatusBadGateway, "storage_error", "Le stockage n'a pas répondu")
	}
	// S3 lists in key order and can't sort: newest first holds within a page only.
	sort.SliceStable(objects, func(i, j int) bool { return objects[i].LastModified.After(objects[j].LastModified) })
	items := make([]mediaItem, 0, len(objects))
	for _, o := range objects {
		items = append(items, mediaItem{Key: o.Key, URL: o.URL, Size: o.Size, LastModified: o.LastModified, Kind: mediaKind(o.Key)})
	}
	var cursor *string
	if next != "" {
		cursor = &next
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"configured":  true,
		"folder":      folder.Path,
		"folders":     mediaFolders,
		"items":       items,
		"next_cursor": cursor,
	})
}

// uploadRefusal returns why a file is turned down, in French, or "".
func uploadRefusal(file *multipart.FileHeader) string {
	if file.Size > utils.MaxFileSize {
		return fmt.Sprintf("Fichier trop lourd : %d Mo au plus", utils.MaxFileSize>>20)
	}
	if _, ok := utils.AllowedFileTypes[strings.ToLower(filepath.Ext(file.Filename))]; !ok {
		return "Format non accepté : JPG, PNG, WebP, GIF ou MP4"
	}
	if err := utils.ValidateUploadedFile(file); err != nil {
		return "Le contenu du fichier ne correspond pas à son extension"
	}
	return ""
}

func sizeLabel(n int64) string {
	if n >= 1<<20 {
		return strings.Replace(fmt.Sprintf("%.1f Mo", float64(n)/(1<<20)), ".", ",", 1)
	}
	return fmt.Sprintf("%d Ko", max(1, n>>10))
}

type storedUpload struct {
	Key  string
	URL  string
	Kind string
	Size int64
}

// storeUpload validates the `file` of a multipart form and puts it in the
// bucket. A nil result means the refusal is already written to the response.
func (m *Module) storeUpload(c echo.Context, folderPath string) (*storedUpload, error) {
	if !m.storage.Enabled() {
		return nil, fail(c, http.StatusServiceUnavailable, "storage_unconfigured", "Le stockage des médias n'est pas connecté")
	}
	folder := mediaFolderByPath(folderPath)
	if folder == nil || len(folder.Accept) == 0 {
		return nil, fail(c, http.StatusBadRequest, "invalid_input", "Ce dossier ne reçoit pas de fichier")
	}
	file, err := c.FormFile("file")
	if err != nil {
		return nil, fail(c, http.StatusBadRequest, "invalid_input", "Aucun fichier reçu")
	}
	if reason := uploadRefusal(file); reason != "" {
		return nil, fail(c, http.StatusBadRequest, "invalid_file", reason)
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	kind := mediaTypes[ext].kind
	if !folder.accepts(kind) {
		return nil, fail(c, http.StatusBadRequest, "invalid_file", "Ce dossier ne reçoit pas ce type de fichier")
	}
	src, err := file.Open()
	if err != nil {
		return nil, m.internal(c, err)
	}
	defer src.Close()

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Minute)
	defer cancel()
	publicURL, err := m.storage.Upload(ctx, services.UploadOptions{
		Path:     folder.Path,
		Filename: services.GenerateFilename("f" + ext),
		// From the checked extension, never from what the browser claims.
		ContentType: mediaTypes[ext].mime,
		Body:        src,
		Size:        file.Size,
	})
	if err != nil {
		m.log.WithError(err).Error("[BO] media upload failed")
		return nil, fail(c, http.StatusBadGateway, "storage_error", "Le stockage a refusé le fichier")
	}
	key, _ := m.storage.KeyFromURL(publicURL)
	m.audit(c, "media.uploaded", "media", key, clip(file.Filename, 120), folder.Label+", "+sizeLabel(file.Size))
	return &storedUpload{Key: key, URL: publicURL, Kind: kind, Size: file.Size}, nil
}

func (m *Module) handleMediaUpload(c echo.Context) error {
	stored, err := m.storeUpload(c, c.FormValue("folder"))
	if err != nil || stored == nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"url": stored.URL, "key": stored.Key, "kind": stored.Kind, "size": stored.Size,
	})
}

type mediaUsage struct {
	Type  string `json:"type"` // article | ad_spot | ad | user
	ID    string `json:"id"`
	Label string `json:"label"`
	Where string `json:"where"`
}

func (u mediaUsage) sentence() string {
	switch u.Type {
	case "article":
		return u.Where + " de l'article « " + u.Label + " »"
	case "ad_spot":
		return "emplacement publicitaire « " + u.Label + " »"
	case "ad":
		return "bannière « " + u.Label + " » de la colonne du site"
	default:
		return "avatar du compte de " + u.Label
	}
}

// mediaUsages lists what still shows an object. It matches on the key, not the
// full URL: rows written before the bucket got its own domain carry the old host.
func (m *Module) mediaUsages(ctx context.Context, key string) ([]mediaUsage, error) {
	db := m.db.WithContext(ctx)
	exact := "%/" + escapeLike(key)
	inside := exact + "%"
	usages := []mediaUsage{}

	articles := []struct {
		ID    int64   `gorm:"column:id"`
		Title *string `gorm:"column:title"`
		Cover bool    `gorm:"column:cover"`
		Video bool    `gorm:"column:video"`
	}{}
	if err := db.Raw(
		`SELECT id, title,
		        coalesce("featuredImage" LIKE @exact, false) AS cover,
		        coalesce("videoUrl" LIKE @exact, false) AS video
		 FROM articles
		 WHERE "featuredImage" LIKE @exact OR "videoUrl" LIKE @exact
		    OR article_content LIKE @inside OR content LIKE @inside
		    OR content_black LIKE @inside OR content_white LIKE @inside
		 ORDER BY id DESC LIMIT 5`,
		map[string]interface{}{"exact": exact, "inside": inside}).Scan(&articles).Error; err != nil {
		return nil, err
	}
	for _, a := range articles {
		where := "contenu"
		if a.Cover {
			where = "couverture"
		} else if a.Video {
			where = "vidéo"
		}
		label := "sans titre"
		if a.Title != nil && *a.Title != "" {
			label = *a.Title
		}
		usages = append(usages, mediaUsage{Type: "article", ID: strconv.FormatInt(a.ID, 10), Label: label, Where: where})
	}

	spots := []adSpot{}
	if err := db.Raw("SELECT key, label FROM ad_spot WHERE media_url LIKE ? ORDER BY sort", exact).Scan(&spots).Error; err != nil {
		return nil, err
	}
	for _, s := range spots {
		usages = append(usages, mediaUsage{Type: "ad_spot", ID: s.Key, Label: s.Label, Where: "bannière"})
	}

	rows := []struct {
		ID    int64   `gorm:"column:id"`
		Label *string `gorm:"column:label"`
	}{}
	if err := db.Raw("SELECT id, title AS label FROM ads WHERE url LIKE ? ORDER BY id", exact).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		label := "sans titre"
		if r.Label != nil && *r.Label != "" {
			label = *r.Label
		}
		usages = append(usages, mediaUsage{Type: "ad", ID: strconv.FormatInt(r.ID, 10), Label: label, Where: "bannière"})
	}

	rows = rows[:0]
	if err := db.Raw("SELECT id, name AS label FROM users WHERE avatar LIKE ? ORDER BY id LIMIT 5", exact).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		label := "#" + strconv.FormatInt(r.ID, 10)
		if r.Label != nil && *r.Label != "" {
			label = *r.Label
		}
		usages = append(usages, mediaUsage{Type: "user", ID: strconv.FormatInt(r.ID, 10), Label: label, Where: "avatar"})
	}
	return usages, nil
}

func mediaInUseMessage(usages []mediaUsage) string {
	parts := make([]string, 0, len(usages))
	for _, u := range usages {
		parts = append(parts, u.sentence())
	}
	return "Ce média est encore utilisé : " + strings.Join(parts, " ; ") + ". Retirez-le de là avant de le supprimer."
}

type mediaDeleteInput struct {
	URL string `json:"url"`
}

func (m *Module) handleMediaDelete(c echo.Context) error {
	var in mediaDeleteInput
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.URL) == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Adresse du média requise")
	}
	if !m.storage.Enabled() {
		return fail(c, http.StatusServiceUnavailable, "storage_unconfigured", "Le stockage des médias n'est pas connecté")
	}
	key, ok := m.storage.KeyFromURL(strings.TrimSpace(in.URL))
	var folder *mediaFolder
	if ok {
		folder = mediaFolderOfKey(key)
	}
	if folder == nil || strings.Contains(key, "..") {
		return fail(c, http.StatusBadRequest, "invalid_input", "Ce fichier ne fait pas partie de la médiathèque")
	}
	ctx := c.Request().Context()
	usages, err := m.mediaUsages(ctx, key)
	if err != nil {
		return m.internal(c, err)
	}
	if len(usages) > 0 {
		return c.JSON(http.StatusConflict, map[string]interface{}{
			"error": mediaInUseMessage(usages), "code": "media_in_use", "usages": usages,
		})
	}
	if err := m.storage.Delete(ctx, strings.TrimSpace(in.URL)); err != nil {
		m.log.WithError(err).Error("[BO] media deletion failed")
		return fail(c, http.StatusBadGateway, "storage_error", "Le stockage n'a pas supprimé le fichier")
	}
	m.audit(c, "media.deleted", "media", key, path.Base(key), folder.Label)
	return c.NoContent(http.StatusNoContent)
}
