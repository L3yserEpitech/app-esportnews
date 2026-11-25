package backoffice

import (
	"context"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

const scheduleTick = time.Minute

// startArticleJobs publishes the scheduled articles when their time comes.
func (m *Module) startArticleJobs(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(scheduleTick)
		defer ticker.Stop()
		m.publishDue(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.publishDue(ctx)
			}
		}
	}()
}

// publishDue claims the due articles in one statement: a second instance of
// the backend running the same tick gets none of them, so each is published,
// logged and pushed once.
func (m *Module) publishDue(parent context.Context) {
	ctx, cancel := context.WithTimeout(parent, 30*time.Second)
	defer cancel()

	var ids []int64
	err := m.db.WithContext(ctx).Raw(
		`UPDATE articles SET status = 'published', created_at = now(), updated_at = now(), scheduled_at = NULL
		 WHERE status = 'scheduled' AND scheduled_at <= now() RETURNING id`).Scan(&ids).Error
	if err != nil {
		m.log.WithError(err).Error("[BO] scheduled publication failed")
		return
	}
	for _, id := range ids {
		var a models.Article
		if err := m.db.WithContext(ctx).First(&a, id).Error; err != nil {
			m.log.WithError(err).WithField("article", id).Error("[BO] published article unreadable")
			continue
		}
		m.articles.InvalidatePublicCaches(ctx, deref(a.Slug))
		err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			_, err := m.recordVersion(tx, &a, systemActor, "publication programmée", false)
			return err
		})
		if err != nil {
			m.log.WithError(err).WithField("article", id).Warn("[BO] version of a scheduled publication not kept")
		}
		m.writeAudit(auditEntry{
			ActorName: systemActor.Name, Action: "article.published",
			TargetType: "article", TargetID: articleRef(&a), TargetLabel: articleLabel(&a),
			Detail: "publication programmée",
		})
		m.notifyPublished(&a)
		m.log.WithField("article", id).Info("[BO] scheduled article published")
	}
}

const (
	maxImageUpload = 25 << 20
	maxVideoUpload = 500 << 20
)

var uploadKinds = map[string]string{
	".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".gif": "image", ".avif": "image",
	".mp4": "video", ".webm": "video", ".mov": "video",
}

// checkUpload returns "image" or "video", or the reason the file is refused.
// The extension decides: it is what the public bucket will serve it as.
func checkUpload(file *multipart.FileHeader) (kind, refusal string) {
	kind = uploadKinds[strings.ToLower(filepath.Ext(file.Filename))]
	contentType := strings.ToLower(file.Header.Get("Content-Type"))
	switch {
	case kind == "" || !strings.HasPrefix(contentType, kind+"/"):
		return "", "Format non pris en charge. Images : JPG, PNG, WebP, GIF, AVIF. Vidéos : MP4, WebM, MOV."
	case kind == "image" && file.Size > maxImageUpload:
		return "", "Image trop lourde (25 Mo maximum)"
	case kind == "video" && file.Size > maxVideoUpload:
		return "", "Vidéo trop lourde (500 Mo maximum)"
	}
	return kind, ""
}

// handleArticleUpload stores a file of the editor under the same R2 folders as
// the editor of the site: <base>/images or <base>/videos for a cover, and
// articles/content/images for anything placed in the body.
func (m *Module) handleArticleUpload(base, what string) echo.HandlerFunc {
	return func(c echo.Context) error {
		if !m.storage.Enabled() {
			return fail(c, http.StatusServiceUnavailable, "storage_unavailable",
				"Le stockage des médias n'est pas configuré sur ce serveur : l'envoi de fichiers est indisponible.")
		}
		file, err := c.FormFile("file")
		if err != nil {
			return fail(c, http.StatusBadRequest, "invalid_input", "Aucun fichier reçu")
		}
		kind, refusal := checkUpload(file)
		if refusal != "" {
			return fail(c, http.StatusBadRequest, "invalid_input", refusal)
		}
		folder := base + "/images"
		if kind == "video" && base == "articles/covers" {
			folder = base + "/videos"
		}
		slug := utils.GenerateSlug(c.FormValue("slug"), 80, 0)
		if slug == "" {
			slug = "article"
		}

		src, err := file.Open()
		if err != nil {
			return m.internal(c, err)
		}
		defer src.Close()
		ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Minute)
		defer cancel()
		publicURL, err := m.storage.Upload(ctx, services.UploadOptions{
			Path:        folder,
			Filename:    services.GenerateSlugFilename(slug, strings.ToLower(filepath.Ext(file.Filename))),
			ContentType: file.Header.Get("Content-Type"),
			Body:        src,
			Size:        file.Size,
		})
		if err != nil {
			m.log.WithError(err).Error("[BO] article upload failed")
			return fail(c, http.StatusBadGateway, "upload_failed", "L'envoi du fichier a échoué. Réessayez.")
		}
		m.audit(c, "media.uploaded", "media", publicURL, clip(file.Filename, 200), what)
		return c.JSON(http.StatusOK, map[string]interface{}{"url": publicURL, "type": kind})
	}
}
