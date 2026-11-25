// Package backoffice is the API behind admin.esportnews.fr: team sessions with
// two-factor authentication, roles, the audit log and every screen of the
// back-office. Routes live under /api/bo and never share a session with the site.
package backoffice

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
)

type Role string

const (
	RoleUser   Role = "user"
	RoleReader Role = "reader"
	RoleEditor Role = "editor"
	RoleAdmin  Role = "admin"
)

func (r Role) IsTeam() bool { return r == RoleReader || r == RoleEditor || r == RoleAdmin }

func validRole(r Role) bool { return r == RoleUser || r.IsTeam() }

type Perm string

const (
	PermArticlesWrite    Perm = "articles.write"     // write and publish one's own articles
	PermArticlesWriteAny Perm = "articles.write_any" // edit or delete anyone's
	PermPushBroadcast    Perm = "push.broadcast"     // manual push to every device
	PermAnalyticsRead    Perm = "analytics.read"
	PermHealthRead       Perm = "health.read"
	PermUsersManage      Perm = "users.manage"
	PermTeamManage       Perm = "team.manage"
	PermAuditRead        Perm = "audit.read"
	PermMediaManage      Perm = "media.manage"
	PermAdsManage        Perm = "ads.manage"
)

// The matrix shown on the « Équipe et rôles » screen. Keep both in step.
var rolePerms = map[Role][]Perm{
	RoleAdmin: {
		PermArticlesWrite, PermArticlesWriteAny, PermPushBroadcast, PermAnalyticsRead, PermHealthRead,
		PermUsersManage, PermTeamManage, PermAuditRead, PermMediaManage, PermAdsManage,
	},
	RoleEditor: {PermArticlesWrite, PermAnalyticsRead, PermMediaManage},
	RoleReader: {PermAnalyticsRead, PermHealthRead},
}

func (r Role) Can(p Perm) bool {
	for _, have := range rolePerms[r] {
		if have == p {
			return true
		}
	}
	return false
}

// Config is everything the back-office reads from the environment.
type Config struct {
	Env            string
	Secret         string // BACKOFFICE_SECRET, falls back on the JWT secret
	BackofficeURL  string // where invitation and reset links point
	SiteURL        string
	GoogleClientID string

	VercelToken     string
	VercelProjectID string
	VercelTeamID    string

	GSCSiteURL         string // e.g. sc-domain:esportnews.fr
	GSCCredentialsJSON string // service account, inline JSON

	RailwayToken         string
	RailwayProjectID     string
	RailwayServiceID     string
	RailwayEnvironmentID string

	UpstashEmail      string
	UpstashAPIKey     string
	UpstashDatabaseID string

	ResendAPIKey string

	AppStoreKeyID      string
	AppStoreIssuerID   string
	AppStoreKeyContent string
	AppStoreVendorID   string
	AppStoreAppSKU     string

	PlayReportsBucket   string // gs://pubsite_prod_rev_…
	PlayCredentialsJSON string
	PlayPackage         string

	LiquipediaProxyURL string
}

type Deps struct {
	DB         *gorm.DB
	Cache      *cache.RedisCache
	Auth       *services.AuthService
	Articles   *services.ArticleService
	Storage    *services.StorageService
	Email      *services.EmailService
	Push       *services.ExpoPushService
	Notifier   *services.ContentNotificationService
	Liquipedia *services.LiquipediaService
	Logger     *logrus.Logger
	Config     Config
}

type Module struct {
	db         *gorm.DB
	cache      *cache.RedisCache
	auth       *services.AuthService
	articles   *services.ArticleService
	storage    *services.StorageService
	email      *services.EmailService
	push       *services.ExpoPushService
	notifier   *services.ContentNotificationService
	liquipedia *services.LiquipediaService
	log        *logrus.Logger
	cfg        Config
	aead       cipher.AEAD
	http       *http.Client
	startedAt  time.Time
}

func New(d Deps) (*Module, error) {
	secret := d.Config.Secret
	if secret == "" {
		secret = d.Auth.JWTSecret
	}
	key := sha256.Sum256([]byte("esportnews-backoffice|" + secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Module{
		db:         d.DB,
		cache:      d.Cache,
		auth:       d.Auth,
		articles:   d.Articles,
		storage:    d.Storage,
		email:      d.Email,
		push:       d.Push,
		notifier:   d.Notifier,
		liquipedia: d.Liquipedia,
		log:        d.Logger,
		cfg:        d.Config,
		aead:       aead,
		http:       &http.Client{Timeout: 12 * time.Second},
		startedAt:  time.Now(),
	}, nil
}

// teamUser is the slice of `users` the back-office needs. models.User is left
// alone: it is what the site and the app serialize.
type teamUser struct {
	ID            int64      `json:"id" gorm:"column:id"`
	Name          string     `json:"name" gorm:"column:name"`
	Email         string     `json:"email" gorm:"column:email"`
	Avatar        *string    `json:"avatar" gorm:"column:avatar"`
	Role          Role       `json:"role" gorm:"column:role"`
	Password      string     `json:"-" gorm:"column:password"`
	TeamSince     *time.Time `json:"team_since" gorm:"column:team_since"`
	LastBOLoginAt *time.Time `json:"last_login_at" gorm:"column:last_bo_login_at"`
}

const teamUserColumns = "id, name, email, avatar, role, password, team_since, last_bo_login_at"

func (m *Module) userByID(ctx context.Context, id int64) (*teamUser, error) {
	var u teamUser
	err := m.db.WithContext(ctx).Raw("SELECT "+teamUserColumns+" FROM users WHERE id = ?", id).Scan(&u).Error
	if err != nil {
		return nil, err
	}
	if u.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &u, nil
}

func (m *Module) userByEmail(ctx context.Context, email string) (*teamUser, error) {
	var u teamUser
	err := m.db.WithContext(ctx).
		Raw("SELECT "+teamUserColumns+" FROM users WHERE lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).
		Scan(&u).Error
	if err != nil {
		return nil, err
	}
	if u.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &u, nil
}

type apiError struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

func fail(c echo.Context, status int, code, msg string) error {
	return c.JSON(status, apiError{Error: msg, Code: code})
}

func (m *Module) internal(c echo.Context, err error) error {
	m.log.WithError(err).WithField("path", c.Path()).Error("[BO] request failed")
	return fail(c, http.StatusInternalServerError, "internal", "Erreur interne")
}

// deviceLabel turns a User-Agent into the word shown in the audit log.
func deviceLabel(ua string) string {
	l := strings.ToLower(ua)
	switch {
	case strings.Contains(l, "iphone"):
		return "iPhone"
	case strings.Contains(l, "ipad"):
		return "iPad"
	case strings.Contains(l, "android"):
		return "Android"
	case strings.Contains(l, "mac os") || strings.Contains(l, "macintosh"):
		return "Mac"
	case strings.Contains(l, "windows"):
		return "Windows"
	case strings.Contains(l, "linux"):
		return "Linux"
	default:
		return ""
	}
}

func clip(s string, max int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) > max {
		return string(r[:max])
	}
	return string(r)
}
