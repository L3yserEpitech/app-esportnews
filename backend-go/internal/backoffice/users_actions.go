package backoffice

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
)

func (m *Module) targetUser(c echo.Context) (*teamUser, bool) {
	id, ok := idParam(c)
	if !ok {
		return nil, false
	}
	target, err := m.userByID(c.Request().Context(), id)
	return target, err == nil
}

func devicesLabel(n int) string {
	if n > 1 {
		return strconv.Itoa(n) + " appareils"
	}
	return strconv.Itoa(n) + " appareil"
}

type reasonInput struct {
	Reason string `json:"reason"`
}

func (m *Module) handleUserLogoutAll(c echo.Context) error {
	target, ok := m.targetUser(c)
	if !ok {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	var in reasonInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()

	sessions := m.siteSessions(ctx, target.ID)
	asked := time.Now().UnixMilli()
	if err := m.auth.RevokeAllSessions(ctx, target.ID); err != nil {
		// The revocation mark is what signs devices out; the sweep of the
		// refresh keys that follows it is cleanup and may run out of time.
		mark, _ := m.cache.Get(ctx, cache.SessionsRevokedBeforeKey(target.ID))
		if at, perr := strconv.ParseInt(mark, 10, 64); perr != nil || at < asked {
			m.log.WithError(err).Error("[BO] sessions not revoked")
			return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible, réessayez")
		}
		m.log.WithError(err).Warn("[BO] sessions revoked, refresh keys left to expire")
	}
	m.closeUserSessions(ctx, target.ID)

	detail := "tous les appareils"
	if sessions != nil {
		detail = devicesLabel(*sessions)
	}
	if reason := clip(in.Reason, 300); reason != "" {
		detail += " · " + reason
	}
	m.audit(c, "user.logout_forced", "user", strconv.FormatInt(target.ID, 10), target.Email, detail)
	return c.JSON(http.StatusOK, map[string]interface{}{"sessions": sessions})
}

func (m *Module) handleUserRole(c echo.Context) error {
	var in roleInput
	if c.Bind(&in) != nil || !validRole(in.Role) {
		return fail(c, http.StatusBadRequest, "invalid_input", "Rôle invalide")
	}
	target, ok := m.targetUser(c)
	if !ok {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	return m.changeRole(c, target, in.Role)
}

type giftInput struct {
	Gifted bool   `json:"gifted"`
	Note   string `json:"note"`
}

// setPremiumGift turns the hand-granted Premium on or off. Off, `premium` falls
// back on what a store or Stripe subscription still gives the account.
func (m *Module) setPremiumGift(ctx context.Context, userID int64, gifted bool, note string) error {
	if gifted {
		return m.db.WithContext(ctx).Exec(
			"UPDATE users SET premium_gifted = true, premium = true, premium_gift_note = ? WHERE id = ?", note, userID).Error
	}
	return m.db.WithContext(ctx).Exec(
		"UPDATE users u SET premium_gifted = false, premium_gift_note = NULL, premium = ("+sqlIAPValid+" OR "+sqlStripeValid+") WHERE u.id = ?",
		userID).Error
}

func (m *Module) handleUserPremiumGift(c echo.Context) error {
	var in giftInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	note := clip(in.Note, 300)
	if in.Gifted && note == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Indiquez pourquoi ce Premium est offert")
	}
	target, ok := m.targetUser(c)
	if !ok {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	ctx := c.Request().Context()
	if err := m.setPremiumGift(ctx, target.ID, in.Gifted, note); err != nil {
		return m.internal(c, err)
	}
	action := "user.premium_gifted"
	if !in.Gifted {
		action = "user.premium_gift_removed"
	}
	m.audit(c, action, "user", strconv.FormatInt(target.ID, 10), target.Email, note)
	return c.NoContent(http.StatusNoContent)
}

func (m *Module) handleUserDelete(c echo.Context) error {
	var in reasonInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	reason := clip(in.Reason, 300)
	if reason == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Indiquez le motif de la suppression")
	}
	target, ok := m.targetUser(c)
	if !ok {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	s := sessionOf(c)
	ctx := c.Request().Context()
	if target.ID == s.User.ID {
		return fail(c, http.StatusConflict, "self_delete", "Vous ne pouvez pas supprimer votre propre compte depuis le back-office")
	}
	if target.Role == RoleAdmin {
		var admins int64
		if err := m.db.WithContext(ctx).Raw("SELECT count(*) FROM users WHERE role = 'admin'").Scan(&admins).Error; err != nil {
			return m.internal(c, err)
		}
		if admins <= 1 {
			return fail(c, http.StatusConflict, "last_admin", "Il doit rester au moins un administrateur")
		}
	}

	err := m.auth.PurgeAccount(ctx, target.ID, s.User.Name, reason)
	if errors.Is(err, services.ErrUserNotFound) {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	if err != nil {
		return m.internal(c, err)
	}
	m.closeUserSessions(ctx, target.ID)
	// The label names no one: the journal outlives the account by a year.
	id := strconv.FormatInt(target.ID, 10)
	m.audit(c, "user.deleted", "user", id, "Compte n° "+id, reason)
	return c.NoContent(http.StatusNoContent)
}
