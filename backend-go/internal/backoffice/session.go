package backoffice

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const (
	sessionTTL       = 12 * time.Hour
	sudoTTL          = 10 * time.Minute
	challengeTTL     = 10 * time.Minute
	trustedDeviceTTL = 30 * 24 * time.Hour
	// A new member has a day to turn two-factor on; after that the login
	// itself walks them through it.
	totpGrace = 24 * time.Hour

	maxChallengeAttempts = 5
	loginFailWindow      = 15 * time.Minute
	maxLoginFails        = 8

	ctxSession = "bo_session"
)

func sessionKey(tokenHash string) string   { return "bo:session:" + tokenHash }
func userSessionsKey(userID int64) string  { return "bo:sessions:" + strconv.FormatInt(userID, 10) }
func challengeKey(id string) string        { return "bo:challenge:" + id }
func loginFailKey(emailHash string) string { return "bo:login:fail:" + emailHash }
func totpUsedKey(userID int64, counter uint64) string {
	return "bo:totp:used:" + strconv.FormatInt(userID, 10) + ":" + strconv.FormatUint(counter, 10)
}

type Session struct {
	UserID    int64     `json:"uid"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	SudoUntil time.Time `json:"sudo_until"`
	IP        string    `json:"ip"`
	Device    string    `json:"device"`
	City      string    `json:"city"`

	tokenHash string
	User      *teamUser `json:"-"`
}

type challenge struct {
	UserID   int64  `json:"uid"`
	Stage    string `json:"stage"` // "totp" or "enroll"
	Attempts int    `json:"attempts"`
	IP       string `json:"ip"`
	Device   string `json:"device"`
	City     string `json:"city"`
}

type clientInfo struct{ IP, Device, City string }

func clientOf(c echo.Context) clientInfo {
	return clientInfo{
		IP:     c.RealIP(),
		Device: deviceLabel(c.Request().UserAgent()),
		// The back-office app reads the city from its host's geolocation
		// header and passes it on: display only, never a control.
		City: clip(c.Request().Header.Get("X-BO-City"), 60),
	}
}

func (m *Module) openSession(ctx context.Context, user *teamUser, ci clientInfo) (string, *Session, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", nil, err
	}
	now := time.Now()
	s := &Session{
		UserID:    user.ID,
		CreatedAt: now,
		ExpiresAt: now.Add(sessionTTL),
		// Fresh credentials were just given: heavy actions don't ask again right away.
		SudoUntil: now.Add(sudoTTL),
		IP:        ci.IP,
		Device:    ci.Device,
		City:      ci.City,
		tokenHash: hashToken(token),
		User:      user,
	}
	if err := m.saveSession(ctx, s); err != nil {
		return "", nil, err
	}
	rdb := m.cache.GetClient()
	rdb.SAdd(ctx, userSessionsKey(user.ID), s.tokenHash)
	rdb.Expire(ctx, userSessionsKey(user.ID), sessionTTL)
	m.db.WithContext(ctx).Exec("UPDATE users SET last_bo_login_at = now() WHERE id = ?", user.ID)
	return token, s, nil
}

func (m *Module) saveSession(ctx context.Context, s *Session) error {
	ttl := time.Until(s.ExpiresAt)
	if ttl <= 0 {
		return errors.New("session expired")
	}
	raw, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return m.cache.Set(ctx, sessionKey(s.tokenHash), string(raw), ttl)
}

func (m *Module) closeSession(ctx context.Context, s *Session) {
	m.cache.Del(ctx, sessionKey(s.tokenHash))
	m.cache.GetClient().SRem(ctx, userSessionsKey(s.UserID), s.tokenHash)
}

// closeUserSessions ends every back-office session of a user: role change,
// two-factor reset, removal from the team.
func (m *Module) closeUserSessions(ctx context.Context, userID int64) {
	rdb := m.cache.GetClient()
	hashes, err := rdb.SMembers(ctx, userSessionsKey(userID)).Result()
	if err != nil {
		m.log.WithError(err).Warn("[BO] could not list sessions to close")
		return
	}
	for _, h := range hashes {
		m.cache.Del(ctx, sessionKey(h))
	}
	rdb.Del(ctx, userSessionsKey(userID))
}

func bearer(c echo.Context) string {
	h := c.Request().Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(h[7:])
}

// requireSession reads the role from the database on every request, like
// RequireAdmin: a demotion applies at once.
func (m *Module) requireSession(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		token := bearer(c)
		if token == "" {
			return fail(c, http.StatusUnauthorized, "unauthenticated", "Connexion requise")
		}
		ctx, cancel := context.WithTimeout(c.Request().Context(), 5*time.Second)
		defer cancel()

		hash := hashToken(token)
		raw, err := m.cache.GetClient().Get(ctx, sessionKey(hash)).Result()
		if err != nil {
			if isRedisNil(err) {
				return fail(c, http.StatusUnauthorized, "session_expired", "Session expirée")
			}
			return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
		}
		var s Session
		if err := json.Unmarshal([]byte(raw), &s); err != nil || time.Now().After(s.ExpiresAt) {
			return fail(c, http.StatusUnauthorized, "session_expired", "Session expirée")
		}
		s.tokenHash = hash

		user, err := m.userByID(ctx, s.UserID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			m.closeSession(ctx, &s)
			return fail(c, http.StatusUnauthorized, "session_expired", "Session expirée")
		}
		if err != nil {
			return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Base de données indisponible")
		}
		if !user.Role.IsTeam() {
			m.closeSession(ctx, &s)
			return fail(c, http.StatusForbidden, "not_team", "Ce compte n'ouvre pas le back-office")
		}
		s.User = user
		c.Set(ctxSession, &s)
		return next(c)
	}
}

func sessionOf(c echo.Context) *Session {
	s, _ := c.Get(ctxSession).(*Session)
	return s
}

func (m *Module) require(p Perm) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			s := sessionOf(c)
			if s == nil || !s.User.Role.Can(p) {
				return fail(c, http.StatusForbidden, "forbidden", "Votre rôle ne permet pas cette action")
			}
			return next(c)
		}
	}
}

// requireSudo guards the heavy actions (account deletion, role change, push to
// everyone): credentials must have been given in the last ten minutes.
func (m *Module) requireSudo(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		s := sessionOf(c)
		if s == nil || time.Now().After(s.SudoUntil) {
			return fail(c, http.StatusForbidden, "reauth_required", "Confirmez votre identité pour continuer")
		}
		return next(c)
	}
}

func isRedisNil(err error) bool { return errors.Is(err, redis.Nil) }

// ---- audit log ----

type auditEntry struct {
	ActorID     int64
	ActorName   string
	Action      string
	TargetType  string
	TargetID    string
	TargetLabel string
	Detail      string
	Client      clientInfo
}

func (m *Module) writeAudit(e auditEntry) {
	var actor interface{}
	if e.ActorID != 0 {
		actor = e.ActorID
	}
	err := m.db.Exec(
		`INSERT INTO bo_audit_log (actor_id, actor_name, action, target_type, target_id, target_label, detail, ip, device, city)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		actor, clip(e.ActorName, 120), e.Action, e.TargetType, clip(e.TargetID, 120),
		clip(e.TargetLabel, 300), clip(e.Detail, 500), e.Client.IP, e.Client.Device, e.Client.City,
	).Error
	if err != nil {
		// The action already happened: losing its trace must be loud.
		m.log.WithError(err).WithField("action", e.Action).Error("[BO] audit entry lost")
	}
}

// audit records an action of the signed-in member. The city and device are
// those of the session, read once at login.
func (m *Module) audit(c echo.Context, action, targetType, targetID, targetLabel, detail string) {
	s := sessionOf(c)
	if s == nil {
		return
	}
	m.writeAudit(auditEntry{
		ActorID: s.User.ID, ActorName: s.User.Name, Action: action,
		TargetType: targetType, TargetID: targetID, TargetLabel: targetLabel, Detail: detail,
		Client: clientInfo{IP: c.RealIP(), Device: s.Device, City: s.City},
	})
}
