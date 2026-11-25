package backoffice

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/utils"
)

const pendingTOTPTTL = 15 * time.Minute

func pendingTOTPKey(userID int64) string { return fmt.Sprintf("bo:totp:pending:%d", userID) }
func inviteKey(tokenHash string) string  { return "bo:invite:" + tokenHash }

const inviteTTL = 7 * 24 * time.Hour

type totpRow struct {
	UserID    int64      `gorm:"column:user_id"`
	Secret    string     `gorm:"column:secret"`
	EnabledAt *time.Time `gorm:"column:enabled_at"`
}

// totpSecret returns the active secret, or "" when two-factor is off.
func (m *Module) totpSecret(ctx context.Context, userID int64) (string, error) {
	var row totpRow
	if err := m.db.WithContext(ctx).Raw("SELECT user_id, secret, enabled_at FROM bo_totp WHERE user_id = ?", userID).Scan(&row).Error; err != nil {
		return "", err
	}
	if row.UserID == 0 || row.EnabledAt == nil {
		return "", nil
	}
	return m.open(row.Secret)
}

func totpDeadline(u *teamUser) time.Time {
	if u.TeamSince == nil {
		return time.Time{}
	}
	return u.TeamSince.Add(totpGrace)
}

func (m *Module) registerAuthRoutes(pub, priv *echo.Group) {
	pub.GET("/auth/config", m.handleAuthConfig)
	pub.POST("/auth/login", m.handleLogin)
	pub.POST("/auth/google", m.handleGoogleLogin)
	pub.POST("/auth/totp", m.handleTOTP)
	pub.POST("/auth/backup", m.handleBackupCode)
	pub.POST("/auth/enroll/start", m.handleEnrollStartChallenge)
	pub.POST("/auth/enroll/confirm", m.handleEnrollConfirmChallenge)
	pub.POST("/auth/forgot", m.handleForgot)
	pub.POST("/auth/reset", m.handleReset)
	pub.GET("/auth/invite", m.handleInviteInfo)
	pub.POST("/auth/invite", m.handleInviteAccept)

	priv.GET("/auth/me", m.handleMe)
	priv.POST("/auth/logout", m.handleLogout)
	priv.POST("/auth/reauth", m.handleReauth)
	priv.POST("/upload-ticket", m.handleUploadTicket)
	priv.POST("/account/totp/start", m.handleEnrollStartSession)
	priv.POST("/account/totp/confirm", m.handleEnrollConfirmSession)
	priv.POST("/account/backup-codes", m.handleRegenerateBackupCodes, m.requireSudo)
	priv.POST("/account/password", m.handleChangePassword)
	priv.GET("/account/devices", m.handleListTrustedDevices)
	priv.DELETE("/account/devices", m.handleForgetTrustedDevices)
}

func (m *Module) handleAuthConfig(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"google_client_id": m.cfg.GoogleClientID,
		"env":              m.cfg.Env,
	})
}

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

const invalidLogin = "Adresse e-mail ou mot de passe incorrect"

func (m *Module) handleLogin(c echo.Context) error {
	var in loginInput
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Email) == "" || in.Password == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Adresse e-mail et mot de passe requis")
	}
	ctx := c.Request().Context()
	email := strings.ToLower(strings.TrimSpace(in.Email))
	failKey := loginFailKey(hashToken(email))

	if n, _ := m.cache.GetClient().Get(ctx, failKey).Int(); n >= maxLoginFails {
		return fail(c, http.StatusTooManyRequests, "too_many_attempts", "Trop d'essais. Réessayez dans quelques minutes.")
	}

	user, err := m.userByEmail(ctx, email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Base de données indisponible")
	}
	if err != nil || utils.VerifyPassword(user.Password, in.Password) != nil {
		fails := m.countLoginFail(ctx, failKey)
		if user != nil && user.Role.IsTeam() && fails == 3 {
			m.writeAudit(auditEntry{
				ActorID: user.ID, ActorName: user.Name, Action: "auth.login_refused",
				TargetType: "account", TargetLabel: "son compte", Detail: "mot de passe faux, 3 fois", Client: clientOf(c),
			})
		}
		return fail(c, http.StatusUnauthorized, "invalid_credentials", invalidLogin)
	}
	if !user.Role.IsTeam() {
		return fail(c, http.StatusForbidden, "not_team", "Ce compte n'ouvre pas le back-office : il est réservé à l'équipe.")
	}
	m.cache.Del(ctx, failKey)
	return m.afterIdentity(c, user, cookieValue(c, deviceCookie))
}

func (m *Module) countLoginFail(ctx context.Context, key string) int64 {
	n, err := m.cache.Incr(ctx, key)
	if err != nil {
		return 0
	}
	if n == 1 {
		m.cache.Expire(ctx, key, loginFailWindow)
	}
	return n
}

type googleInput struct {
	Credential string `json:"credential"`
}

func (m *Module) handleGoogleLogin(c echo.Context) error {
	if m.cfg.GoogleClientID == "" {
		return fail(c, http.StatusNotImplemented, "google_disabled", "La connexion Google n'est pas configurée")
	}
	var in googleInput
	if err := c.Bind(&in); err != nil || in.Credential == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Jeton Google manquant")
	}
	ctx := c.Request().Context()
	payload, err := idtoken.Validate(ctx, in.Credential, m.cfg.GoogleClientID)
	if err != nil {
		return fail(c, http.StatusUnauthorized, "invalid_credentials", "Jeton Google refusé")
	}
	email, _ := payload.Claims["email"].(string)
	verified, _ := payload.Claims["email_verified"].(bool)
	if email == "" || !verified {
		return fail(c, http.StatusUnauthorized, "invalid_credentials", "Adresse Google non vérifiée")
	}
	user, err := m.userByEmail(ctx, email)
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && !user.Role.IsTeam()) {
		return fail(c, http.StatusForbidden, "not_team", "Ce compte Google n'appartient pas à l'équipe.")
	}
	if err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Base de données indisponible")
	}
	return m.afterIdentity(c, user, cookieValue(c, deviceCookie))
}

// afterIdentity decides what a proven identity still owes: a code, an
// enrolment, or nothing.
func (m *Module) afterIdentity(c echo.Context, user *teamUser, deviceToken string) error {
	ctx := c.Request().Context()
	secret, err := m.totpSecret(ctx, user.ID)
	if err != nil {
		return m.internal(c, err)
	}
	ci := clientOf(c)

	if secret == "" {
		if deadline := totpDeadline(user); !deadline.IsZero() && time.Now().Before(deadline) {
			return m.respondSession(c, user, ci, "")
		}
		id, err := m.newChallenge(ctx, user.ID, "enroll", ci)
		if err != nil {
			return m.internal(c, err)
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"step": "enroll", "challenge": id, "email": user.Email})
	}

	if deviceToken != "" && m.trustedDeviceValid(ctx, user.ID, deviceToken) {
		return m.respondSession(c, user, ci, "")
	}
	id, err := m.newChallenge(ctx, user.ID, "totp", ci)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"step": "totp", "challenge": id, "email": user.Email})
}

func (m *Module) respondSession(c echo.Context, user *teamUser, ci clientInfo, deviceToken string) error {
	ctx := c.Request().Context()
	token, s, err := m.openSession(ctx, user, ci)
	if err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
	}
	m.writeAudit(auditEntry{
		ActorID: user.ID, ActorName: user.Name, Action: "auth.login",
		TargetType: "account", TargetLabel: "son compte", Client: ci,
	})
	m.setCookie(c, sessionCookie, token, sessionTTL)
	if deviceToken != "" {
		m.setCookie(c, deviceCookie, deviceToken, trustedDeviceTTL)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"step": "done", "expires_at": s.ExpiresAt, "trusted": deviceToken != ""})
}

func (m *Module) newChallenge(ctx context.Context, userID int64, stage string, ci clientInfo) (string, error) {
	id, err := randomToken(24)
	if err != nil {
		return "", err
	}
	raw, _ := json.Marshal(challenge{UserID: userID, Stage: stage, IP: ci.IP, Device: ci.Device, City: ci.City})
	return id, m.cache.Set(ctx, challengeKey(id), string(raw), challengeTTL)
}

var errChallengeGone = errors.New("challenge expired")

// takeChallenge loads a challenge and counts the attempt. Too many and it is gone.
func (m *Module) takeChallenge(ctx context.Context, id, stage string) (*challenge, *teamUser, error) {
	if id == "" {
		return nil, nil, errChallengeGone
	}
	raw, err := m.cache.GetClient().Get(ctx, challengeKey(id)).Result()
	if err != nil {
		if isRedisNil(err) {
			return nil, nil, errChallengeGone
		}
		return nil, nil, err
	}
	var ch challenge
	if json.Unmarshal([]byte(raw), &ch) != nil || ch.Stage != stage {
		return nil, nil, errChallengeGone
	}
	ch.Attempts++
	if ch.Attempts > maxChallengeAttempts {
		m.cache.Del(ctx, challengeKey(id))
		return nil, nil, errChallengeGone
	}
	ttl, _ := m.cache.TTL(ctx, challengeKey(id))
	if ttl <= 0 {
		return nil, nil, errChallengeGone
	}
	updated, _ := json.Marshal(ch)
	if err := m.cache.Set(ctx, challengeKey(id), string(updated), ttl); err != nil {
		return nil, nil, err
	}
	user, err := m.userByID(ctx, ch.UserID)
	if err != nil || !user.Role.IsTeam() {
		return nil, nil, errChallengeGone
	}
	return &ch, user, nil
}

func (m *Module) challengeFailure(c echo.Context, err error) error {
	if errors.Is(err, errChallengeGone) {
		return fail(c, http.StatusUnauthorized, "challenge_expired", "Cette étape a expiré. Reconnectez-vous.")
	}
	return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
}

func (m *Module) wrongCode(c echo.Context, ch *challenge, user *teamUser) error {
	if ch.Attempts == 3 {
		m.writeAudit(auditEntry{
			ActorID: user.ID, ActorName: user.Name, Action: "auth.login_refused",
			TargetType: "account", TargetLabel: "son compte", Detail: "code de vérification faux, 3 fois",
			Client: clientInfo{IP: ch.IP, Device: ch.Device, City: ch.City},
		})
	}
	return fail(c, http.StatusUnauthorized, "invalid_code", "Code incorrect")
}

// consumeTOTP checks a code and burns it: the same six digits can't be replayed
// while their window is still open.
func (m *Module) consumeTOTP(ctx context.Context, userID int64, secret, code string) bool {
	counter, ok := matchTOTP(secret, code, time.Now())
	if !ok {
		return false
	}
	fresh, err := m.cache.SetNX(ctx, totpUsedKey(userID, counter), "1", 2*totpPeriod+totpPeriod)
	return err == nil && fresh
}

type codeInput struct {
	Challenge   string `json:"challenge"`
	Code        string `json:"code"`
	TrustDevice bool   `json:"trust_device"`
}

func (m *Module) handleTOTP(c echo.Context) error {
	var in codeInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	ch, user, err := m.takeChallenge(ctx, in.Challenge, "totp")
	if err != nil {
		return m.challengeFailure(c, err)
	}
	secret, err := m.totpSecret(ctx, user.ID)
	if err != nil || secret == "" {
		return m.challengeFailure(c, errChallengeGone)
	}
	if !m.consumeTOTP(ctx, user.ID, secret, in.Code) {
		return m.wrongCode(c, ch, user)
	}
	m.cache.Del(ctx, challengeKey(in.Challenge))
	return m.finishChallenge(c, ch, user, in.TrustDevice)
}

func (m *Module) handleBackupCode(c echo.Context) error {
	var in codeInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	ch, user, err := m.takeChallenge(ctx, in.Challenge, "totp")
	if err != nil {
		return m.challengeFailure(c, err)
	}
	res := m.db.WithContext(ctx).Exec(
		`UPDATE bo_backup_code SET used_at = now() WHERE id = (
			SELECT id FROM bo_backup_code WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1)`,
		user.ID, hashToken(normalizeBackupCode(in.Code)))
	if res.Error != nil {
		return m.internal(c, res.Error)
	}
	if res.RowsAffected == 0 {
		return m.wrongCode(c, ch, user)
	}
	m.cache.Del(ctx, challengeKey(in.Challenge))
	m.writeAudit(auditEntry{
		ActorID: user.ID, ActorName: user.Name, Action: "auth.backup_code_used",
		TargetType: "account", TargetLabel: "son compte",
		Client: clientInfo{IP: ch.IP, Device: ch.Device, City: ch.City},
	})
	return m.finishChallenge(c, ch, user, false)
}

func (m *Module) finishChallenge(c echo.Context, ch *challenge, user *teamUser, trust bool) error {
	ci := clientInfo{IP: ch.IP, Device: ch.Device, City: ch.City}
	deviceToken := ""
	if trust {
		if t, err := m.trustDevice(c.Request().Context(), user.ID, ci); err == nil {
			deviceToken = t
		}
	}
	return m.respondSession(c, user, ci, deviceToken)
}

// ---- trusted devices ----

func (m *Module) trustDevice(ctx context.Context, userID int64, ci clientInfo) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	label := strings.TrimSpace(strings.Join([]string{ci.City, ci.Device}, " · "))
	label = strings.Trim(label, " ·")
	err = m.db.WithContext(ctx).Exec(
		"INSERT INTO bo_trusted_device (user_id, token_hash, label, expires_at) VALUES (?, ?, ?, ?)",
		userID, hashToken(token), label, time.Now().Add(trustedDeviceTTL)).Error
	return token, err
}

func (m *Module) trustedDeviceValid(ctx context.Context, userID int64, token string) bool {
	var n int64
	err := m.db.WithContext(ctx).Raw(
		"SELECT count(*) FROM bo_trusted_device WHERE user_id = ? AND token_hash = ? AND expires_at > now()",
		userID, hashToken(token)).Scan(&n).Error
	return err == nil && n > 0
}

func (m *Module) handleListTrustedDevices(c echo.Context) error {
	s := sessionOf(c)
	type row struct {
		ID        int64     `json:"id"`
		Label     string    `json:"label"`
		CreatedAt time.Time `json:"created_at"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	rows := []row{}
	if err := m.db.WithContext(c.Request().Context()).Raw(
		"SELECT id, label, created_at, expires_at FROM bo_trusted_device WHERE user_id = ? AND expires_at > now() ORDER BY created_at DESC",
		s.User.ID).Scan(&rows).Error; err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"devices": rows})
}

func (m *Module) handleForgetTrustedDevices(c echo.Context) error {
	s := sessionOf(c)
	if err := m.db.WithContext(c.Request().Context()).Exec("DELETE FROM bo_trusted_device WHERE user_id = ?", s.User.ID).Error; err != nil {
		return m.internal(c, err)
	}
	m.setCookie(c, deviceCookie, "", 0)
	return c.NoContent(http.StatusNoContent)
}

// ---- enrolment ----

// startEnrolment keeps the new secret aside until a code proves the app holds
// it: the active secret, if any, keeps working meanwhile.
func (m *Module) startEnrolment(ctx context.Context, user *teamUser) (map[string]interface{}, error) {
	secret, err := newTOTPSecret()
	if err != nil {
		return nil, err
	}
	sealed, err := m.seal(secret)
	if err != nil {
		return nil, err
	}
	if err := m.cache.Set(ctx, pendingTOTPKey(user.ID), sealed, pendingTOTPTTL); err != nil {
		return nil, err
	}
	return map[string]interface{}{"secret": secret, "otpauth_url": otpauthURL(secret, user.Email)}, nil
}

var errNoPendingTOTP = errors.New("no pending enrolment")

func (m *Module) confirmEnrolment(ctx context.Context, user *teamUser, code string) ([]string, error) {
	sealed, err := m.cache.GetClient().Get(ctx, pendingTOTPKey(user.ID)).Result()
	if err != nil {
		if isRedisNil(err) {
			return nil, errNoPendingTOTP
		}
		return nil, err
	}
	secret, err := m.open(sealed)
	if err != nil {
		return nil, errNoPendingTOTP
	}
	if !m.consumeTOTP(ctx, user.ID, secret, code) {
		return nil, nil
	}

	var codes []string
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(
			`INSERT INTO bo_totp (user_id, secret, enabled_at) VALUES (?, ?, now())
			 ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, enabled_at = now()`,
			user.ID, sealed).Error; err != nil {
			return err
		}
		// A new authenticator voids what the old one vouched for.
		if err := tx.Exec("DELETE FROM bo_trusted_device WHERE user_id = ?", user.ID).Error; err != nil {
			return err
		}
		var err error
		codes, err = replaceBackupCodes(tx, user.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	m.cache.Del(ctx, pendingTOTPKey(user.ID))
	return codes, nil
}

func replaceBackupCodes(tx *gorm.DB, userID int64) ([]string, error) {
	if err := tx.Exec("DELETE FROM bo_backup_code WHERE user_id = ?", userID).Error; err != nil {
		return nil, err
	}
	codes := make([]string, 0, 10)
	for i := 0; i < 10; i++ {
		code, err := newBackupCode()
		if err != nil {
			return nil, err
		}
		if err := tx.Exec("INSERT INTO bo_backup_code (user_id, code_hash) VALUES (?, ?)", userID, hashToken(code)).Error; err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, nil
}

func (m *Module) handleEnrollStartChallenge(c echo.Context) error {
	var in codeInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	_, user, err := m.takeChallenge(ctx, in.Challenge, "enroll")
	if err != nil {
		return m.challengeFailure(c, err)
	}
	out, err := m.startEnrolment(ctx, user)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (m *Module) handleEnrollConfirmChallenge(c echo.Context) error {
	var in codeInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	ch, user, err := m.takeChallenge(ctx, in.Challenge, "enroll")
	if err != nil {
		return m.challengeFailure(c, err)
	}
	codes, err := m.confirmEnrolment(ctx, user, in.Code)
	if errors.Is(err, errNoPendingTOTP) {
		return fail(c, http.StatusConflict, "enrolment_expired", "La configuration a expiré, recommencez.")
	}
	if err != nil {
		return m.internal(c, err)
	}
	if codes == nil {
		return fail(c, http.StatusUnauthorized, "invalid_code", "Code incorrect")
	}
	m.cache.Del(ctx, challengeKey(in.Challenge))
	ci := clientInfo{IP: ch.IP, Device: ch.Device, City: ch.City}
	m.writeAudit(auditEntry{ActorID: user.ID, ActorName: user.Name, Action: "auth.totp_enabled", TargetType: "account", TargetLabel: "son compte", Client: ci})

	token, s, err := m.openSession(ctx, user, ci)
	if err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
	}
	m.setCookie(c, sessionCookie, token, sessionTTL)
	m.setCookie(c, deviceCookie, "", 0)
	return c.JSON(http.StatusOK, map[string]interface{}{"step": "done", "expires_at": s.ExpiresAt, "backup_codes": codes})
}

func (m *Module) handleEnrollStartSession(c echo.Context) error {
	s := sessionOf(c)
	ctx := c.Request().Context()
	secret, err := m.totpSecret(ctx, s.User.ID)
	if err != nil {
		return m.internal(c, err)
	}
	// Replacing a working authenticator is a heavy action.
	if secret != "" && time.Now().After(s.SudoUntil) {
		return fail(c, http.StatusForbidden, "reauth_required", "Confirmez votre identité pour continuer")
	}
	out, err := m.startEnrolment(ctx, s.User)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (m *Module) handleEnrollConfirmSession(c echo.Context) error {
	var in codeInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	s := sessionOf(c)
	codes, err := m.confirmEnrolment(c.Request().Context(), s.User, in.Code)
	if errors.Is(err, errNoPendingTOTP) {
		return fail(c, http.StatusConflict, "enrolment_expired", "La configuration a expiré, recommencez.")
	}
	if err != nil {
		return m.internal(c, err)
	}
	if codes == nil {
		return fail(c, http.StatusUnauthorized, "invalid_code", "Code incorrect")
	}
	m.audit(c, "auth.totp_enabled", "account", "", "son compte", "")
	// A new authenticator voids the devices the old one vouched for.
	m.setCookie(c, deviceCookie, "", 0)
	return c.JSON(http.StatusOK, map[string]interface{}{"backup_codes": codes})
}

func (m *Module) handleRegenerateBackupCodes(c echo.Context) error {
	s := sessionOf(c)
	var codes []string
	err := m.db.WithContext(c.Request().Context()).Transaction(func(tx *gorm.DB) error {
		var err error
		codes, err = replaceBackupCodes(tx, s.User.ID)
		return err
	})
	if err != nil {
		return m.internal(c, err)
	}
	m.audit(c, "auth.backup_codes_regenerated", "account", "", "son compte", "")
	return c.JSON(http.StatusOK, map[string]interface{}{"backup_codes": codes})
}

// ---- session ----

func (m *Module) handleMe(c echo.Context) error {
	s := sessionOf(c)
	ctx := c.Request().Context()
	secret, err := m.totpSecret(ctx, s.User.ID)
	if err != nil {
		return m.internal(c, err)
	}
	var backupLeft int64
	m.db.WithContext(ctx).Raw("SELECT count(*) FROM bo_backup_code WHERE user_id = ? AND used_at IS NULL", s.User.ID).Scan(&backupLeft)

	out := map[string]interface{}{
		"user":              s.User,
		"permissions":       rolePerms[s.User.Role],
		"totp_enabled":      secret != "",
		"backup_codes_left": backupLeft,
		"session": map[string]interface{}{
			"expires_at": s.ExpiresAt, "sudo_until": s.SudoUntil, "city": s.City, "device": s.Device,
		},
		"env":      m.cfg.Env,
		"site_url": m.cfg.SiteURL,
	}
	if secret == "" {
		out["totp_deadline"] = totpDeadline(s.User)
	}
	return c.JSON(http.StatusOK, out)
}

func (m *Module) handleLogout(c echo.Context) error {
	m.closeSession(c.Request().Context(), sessionOf(c))
	m.setCookie(c, sessionCookie, "", 0)
	return c.NoContent(http.StatusNoContent)
}

type reauthInput struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

// handleReauth reopens the ten-minute window for heavy actions. With two-factor
// on, only a code will do: a stolen session plus a guessed password is not enough.
func (m *Module) handleReauth(c echo.Context) error {
	var in reauthInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	s := sessionOf(c)
	ctx := c.Request().Context()
	secret, err := m.totpSecret(ctx, s.User.ID)
	if err != nil {
		return m.internal(c, err)
	}
	failKey := loginFailKey("reauth:" + hashToken(s.tokenHash))
	if n, _ := m.cache.GetClient().Get(ctx, failKey).Int(); n >= maxChallengeAttempts {
		m.closeSession(ctx, s)
		return fail(c, http.StatusUnauthorized, "session_expired", "Trop d'essais : reconnectez-vous.")
	}
	ok := false
	if secret != "" {
		ok = m.consumeTOTP(ctx, s.User.ID, secret, in.Code)
	} else {
		ok = in.Password != "" && utils.VerifyPassword(s.User.Password, in.Password) == nil
	}
	if !ok {
		m.countLoginFail(ctx, failKey)
		return fail(c, http.StatusUnauthorized, "invalid_code", "Code incorrect")
	}
	m.cache.Del(ctx, failKey)
	s.SudoUntil = time.Now().Add(sudoTTL)
	if err := m.saveSession(ctx, s); err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"sudo_until": s.SudoUntil, "method": map[bool]string{true: "totp", false: "password"}[secret != ""]})
}

type passwordInput struct {
	Current  string `json:"current"`
	Password string `json:"password"`
	Token    string `json:"token"`
	Email    string `json:"email"`
	Name     string `json:"name"`
}

func validPassword(p string) bool { return len(p) >= 10 && len(p) <= 200 }

const weakPassword = "Le mot de passe doit faire au moins 10 caractères"

func (m *Module) setPassword(ctx context.Context, userID int64, password string) error {
	hashed, err := utils.HashPassword(password)
	if err != nil {
		return err
	}
	if err := m.db.WithContext(ctx).Exec("UPDATE users SET password = ? WHERE id = ?", hashed, userID).Error; err != nil {
		return err
	}
	// The same account also signs in on the site and the app: those sessions
	// were opened with the old password.
	if err := m.auth.RevokeAllSessions(ctx, userID); err != nil {
		m.log.WithError(err).Warn("[BO] site sessions not revoked after a password change")
	}
	return nil
}

func (m *Module) handleChangePassword(c echo.Context) error {
	var in passwordInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	s := sessionOf(c)
	if utils.VerifyPassword(s.User.Password, in.Current) != nil {
		return fail(c, http.StatusUnauthorized, "invalid_credentials", "Mot de passe actuel incorrect")
	}
	if !validPassword(in.Password) {
		return fail(c, http.StatusBadRequest, "weak_password", weakPassword)
	}
	if err := m.setPassword(c.Request().Context(), s.User.ID, in.Password); err != nil {
		return m.internal(c, err)
	}
	m.audit(c, "auth.password_changed", "account", "", "son compte", "")
	return c.NoContent(http.StatusNoContent)
}

// handleForgot always answers 200: the form must not reveal who is on the team.
func (m *Module) handleForgot(c echo.Context) error {
	var in passwordInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	if user, err := m.userByEmail(ctx, in.Email); err == nil && user.Role.IsTeam() {
		token, _, err := m.auth.RequestPasswordReset(ctx, user.Email)
		if err != nil {
			m.log.WithError(err).Error("[BO] reset link not minted")
		} else if token != "" {
			link := strings.TrimRight(m.cfg.BackofficeURL, "/") + "/connexion/mot-de-passe?token=" + token
			body := mailLayout("Nouveau mot de passe",
				"Vous avez demandé à changer le mot de passe de votre accès au back-office d'Esport News.",
				"Choisir un nouveau mot de passe", link,
				"Ce lien est valable 1 heure et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.")
			if err := m.email.Send(ctx, user.Email, "Back-office Esport News : nouveau mot de passe", body); err != nil {
				m.log.WithError(err).Error("[BO] reset e-mail not sent")
			}
		}
	}
	return c.NoContent(http.StatusNoContent)
}

func (m *Module) handleReset(c echo.Context) error {
	var in passwordInput
	if err := c.Bind(&in); err != nil || in.Token == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Lien invalide")
	}
	if !validPassword(in.Password) {
		return fail(c, http.StatusBadRequest, "weak_password", weakPassword)
	}
	ctx := c.Request().Context()
	resp, err := m.auth.ResetPassword(ctx, in.Token, in.Password)
	if err != nil {
		return fail(c, http.StatusBadRequest, "invalid_token", "Ce lien a expiré ou a déjà servi.")
	}
	if resp != nil && resp.User != nil {
		m.closeUserSessions(ctx, resp.User.ID)
		// ResetPassword opens a site session nobody asked for here.
		_ = m.auth.RevokeAllSessions(ctx, resp.User.ID)
	}
	return c.NoContent(http.StatusNoContent)
}

// ---- invitations ----

type invitation struct {
	UserID int64 `json:"uid"`
}

func (m *Module) newInvitation(ctx context.Context, userID int64) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	raw, _ := json.Marshal(invitation{UserID: userID})
	if err := m.cache.Set(ctx, inviteKey(hashToken(token)), string(raw), inviteTTL); err != nil {
		return "", err
	}
	return strings.TrimRight(m.cfg.BackofficeURL, "/") + "/connexion/invitation?token=" + token, nil
}

func (m *Module) invitationUser(ctx context.Context, token string) (*teamUser, error) {
	raw, err := m.cache.GetClient().Get(ctx, inviteKey(hashToken(token))).Result()
	if err != nil {
		return nil, err
	}
	var inv invitation
	if json.Unmarshal([]byte(raw), &inv) != nil {
		return nil, errors.New("bad invitation")
	}
	user, err := m.userByID(ctx, inv.UserID)
	if err != nil || !user.Role.IsTeam() {
		return nil, errors.New("invitation no longer valid")
	}
	return user, nil
}

func (m *Module) handleInviteInfo(c echo.Context) error {
	user, err := m.invitationUser(c.Request().Context(), c.QueryParam("token"))
	if err != nil {
		return fail(c, http.StatusNotFound, "invalid_token", "Cette invitation a expiré ou a déjà servi.")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"email": user.Email, "name": user.Name, "role": user.Role})
}

func (m *Module) handleInviteAccept(c echo.Context) error {
	var in passwordInput
	if err := c.Bind(&in); err != nil || in.Token == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Lien invalide")
	}
	if !validPassword(in.Password) {
		return fail(c, http.StatusBadRequest, "weak_password", weakPassword)
	}
	ctx := c.Request().Context()
	user, err := m.invitationUser(ctx, in.Token)
	if err != nil {
		return fail(c, http.StatusNotFound, "invalid_token", "Cette invitation a expiré ou a déjà servi.")
	}
	// Claimed before the password is written: two tabs can't both use the link.
	if _, err := m.cache.GetDel(ctx, inviteKey(hashToken(in.Token))); err != nil {
		return fail(c, http.StatusNotFound, "invalid_token", "Cette invitation a expiré ou a déjà servi.")
	}
	if err := m.setPassword(ctx, user.ID, in.Password); err != nil {
		return m.internal(c, err)
	}
	m.writeAudit(auditEntry{ActorID: user.ID, ActorName: user.Name, Action: "team.invitation_accepted", TargetType: "account", TargetLabel: "son compte", Client: clientOf(c)})
	return c.NoContent(http.StatusNoContent)
}

func mailLayout(title, intro, cta, link, note string) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#FAFAFA;font-family:Inter,Arial,sans-serif;color:#18181B;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
<div style="font-weight:600;font-size:14px;margin-bottom:20px;">Esport News · Administration</div>
<div style="background:#fff;border:1px solid #E7E7EA;border-radius:12px;padding:24px;">
<h1 style="font-size:20px;margin:0 0 12px;">%s</h1>
<p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#3F3F46;">%s</p>
<a href="%s" style="display:inline-block;background:#D3194F;color:#fff;text-decoration:none;font-weight:500;font-size:14px;padding:10px 16px;border-radius:8px;">%s</a>
<p style="font-size:12px;line-height:1.6;margin:20px 0 0;color:#71717A;">%s</p>
<p style="font-size:12px;line-height:1.6;margin:12px 0 0;color:#71717A;word-break:break-all;">%s</p>
</div></div></body></html>`,
		html.EscapeString(title), html.EscapeString(intro), html.EscapeString(link), html.EscapeString(cta),
		html.EscapeString(note), html.EscapeString(link))
}
