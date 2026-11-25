package backoffice

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/utils"
)

var roleLabels = map[Role]string{
	RoleUser: "Utilisateur", RoleReader: "Lecteur", RoleEditor: "Rédacteur", RoleAdmin: "Admin",
}

func (m *Module) registerTeamRoutes(g *echo.Group) {
	t := g.Group("/team", m.require(PermTeamManage))
	t.GET("", m.handleTeamList)
	t.POST("/invite", m.handleTeamInvite, m.requireSudo)
	t.PATCH("/:id", m.handleTeamRole, m.requireSudo)
	t.POST("/:id/reset-totp", m.handleTeamResetTOTP, m.requireSudo)
	t.POST("/:id/invite", m.handleTeamResendInvite)
}

type teamMember struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	Email         string     `json:"email"`
	Avatar        *string    `json:"avatar"`
	Role          Role       `json:"role"`
	TeamSince     *time.Time `json:"team_since"`
	LastLoginAt   *time.Time `json:"last_login_at" gorm:"column:last_bo_login_at"`
	TOTPEnabledAt *time.Time `json:"totp_enabled_at" gorm:"column:totp_enabled_at"`
	TOTPDeadline  *time.Time `json:"totp_deadline" gorm:"-"`
}

func (m *Module) handleTeamList(c echo.Context) error {
	members := []teamMember{}
	err := m.db.WithContext(c.Request().Context()).Raw(
		`SELECT u.id, u.name, u.email, u.avatar, u.role, u.team_since, u.last_bo_login_at, t.enabled_at AS totp_enabled_at
		 FROM users u LEFT JOIN bo_totp t ON t.user_id = u.id
		 WHERE u.role <> 'user'
		 ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name`).Scan(&members).Error
	if err != nil {
		return m.internal(c, err)
	}
	for i := range members {
		if members[i].TOTPEnabledAt == nil && members[i].TeamSince != nil {
			d := members[i].TeamSince.Add(totpGrace)
			members[i].TOTPDeadline = &d
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"members": members})
}

func idParam(c echo.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	return id, err == nil && id > 0
}

type inviteInput struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  Role   `json:"role"`
}

func (m *Module) handleTeamInvite(c echo.Context) error {
	var in inviteInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if _, err := mail.ParseAddress(email); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Adresse e-mail invalide")
	}
	if !in.Role.IsTeam() {
		return fail(c, http.StatusBadRequest, "invalid_input", "Rôle invalide")
	}
	name := clip(in.Name, 80)
	ctx := c.Request().Context()

	user, err := m.userByEmail(ctx, email)
	created := false
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		if name == "" {
			return fail(c, http.StatusBadRequest, "invalid_input", "Nom requis pour un nouveau compte")
		}
		// Nobody knows this password: the invitation link is the only way in.
		random, rerr := randomToken(24)
		if rerr != nil {
			return m.internal(c, rerr)
		}
		hashed, herr := utils.HashPassword(random)
		if herr != nil {
			return m.internal(c, herr)
		}
		if err := m.db.WithContext(ctx).Exec(
			`INSERT INTO users (created_at, name, email, password, admin, role, team_since, signup_source)
			 VALUES (now(), ?, ?, ?, ?, ?, now(), 'invitation')`,
			name, email, hashed, in.Role == RoleAdmin, string(in.Role)).Error; err != nil {
			return m.internal(c, err)
		}
		if user, err = m.userByEmail(ctx, email); err != nil {
			return m.internal(c, err)
		}
		created = true
	case err != nil:
		return m.internal(c, err)
	default:
		if user.Role.IsTeam() {
			return fail(c, http.StatusConflict, "already_member", "Cette personne fait déjà partie de l'équipe")
		}
		if err := m.setRole(ctx, user.ID, in.Role); err != nil {
			return m.internal(c, err)
		}
	}

	sent := m.sendInvitation(ctx, user, in.Role, sessionOf(c).User.Name)
	detail := roleLabels[in.Role]
	if !created {
		detail += ", compte existant"
	}
	m.audit(c, "team.invited", "user", strconv.FormatInt(user.ID, 10), user.Name, detail)
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": user.ID, "created": created, "email_sent": sent})
}

func (m *Module) sendInvitation(ctx context.Context, user *teamUser, role Role, by string) bool {
	link, err := m.newInvitation(ctx, user.ID)
	if err != nil {
		m.log.WithError(err).Error("[BO] invitation link not minted")
		return false
	}
	body := mailLayout("Bienvenue dans l'équipe",
		by+" vous a ajouté au back-office d'Esport News avec le rôle « "+roleLabels[role]+" ». Choisissez votre mot de passe pour y accéder.",
		"Choisir mon mot de passe", link,
		"Ce lien est valable 7 jours. La double authentification vous sera demandée à la première connexion ou dans les 24 heures.")
	if err := m.email.Send(ctx, user.Email, "Votre accès au back-office d'Esport News", body); err != nil {
		m.log.WithError(err).Error("[BO] invitation e-mail not sent")
		return false
	}
	return true
}

func (m *Module) handleTeamResendInvite(c echo.Context) error {
	id, ok := idParam(c)
	if !ok {
		return fail(c, http.StatusBadRequest, "invalid_input", "Identifiant invalide")
	}
	ctx := c.Request().Context()
	user, err := m.userByID(ctx, id)
	if err != nil || !user.Role.IsTeam() {
		return fail(c, http.StatusNotFound, "not_found", "Membre introuvable")
	}
	if !m.sendInvitation(ctx, user, user.Role, sessionOf(c).User.Name) {
		return fail(c, http.StatusBadGateway, "email_failed", "L'e-mail n'a pas pu être envoyé")
	}
	m.audit(c, "team.invited", "user", strconv.FormatInt(user.ID, 10), user.Name, "invitation renvoyée")
	return c.NoContent(http.StatusNoContent)
}

// setRole keeps `admin`, the flag the site reads, in step with the role.
func (m *Module) setRole(ctx context.Context, userID int64, role Role) error {
	if role == RoleUser {
		return m.db.WithContext(ctx).Exec(
			"UPDATE users SET role = 'user', admin = false, team_since = NULL WHERE id = ?", userID).Error
	}
	return m.db.WithContext(ctx).Exec(
		"UPDATE users SET role = ?, admin = ?, team_since = COALESCE(team_since, now()) WHERE id = ?",
		string(role), role == RoleAdmin, userID).Error
}

var errLastAdmin = errors.New("last admin")

// changeRole is shared by the team screen and the user page.
func (m *Module) changeRole(c echo.Context, target *teamUser, role Role) error {
	s := sessionOf(c)
	ctx := c.Request().Context()
	if target.ID == s.User.ID {
		return fail(c, http.StatusConflict, "self_change", "Vous ne pouvez pas changer votre propre rôle")
	}
	if target.Role == role {
		return c.NoContent(http.StatusNoContent)
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
	if err := m.setRole(ctx, target.ID, role); err != nil {
		return m.internal(c, err)
	}
	// The next request would refuse them anyway; closing the sessions also
	// drops what a demoted member's browser still holds.
	m.closeUserSessions(ctx, target.ID)
	if !role.IsTeam() {
		m.db.WithContext(ctx).Exec("DELETE FROM bo_totp WHERE user_id = ?", target.ID)
		m.db.WithContext(ctx).Exec("DELETE FROM bo_backup_code WHERE user_id = ?", target.ID)
		m.db.WithContext(ctx).Exec("DELETE FROM bo_trusted_device WHERE user_id = ?", target.ID)
	}
	m.audit(c, "user.role_changed", "user", strconv.FormatInt(target.ID, 10), target.Name,
		roleLabels[target.Role]+" → "+roleLabels[role])
	return c.NoContent(http.StatusNoContent)
}

type roleInput struct {
	Role Role `json:"role"`
}

func (m *Module) handleTeamRole(c echo.Context) error {
	id, ok := idParam(c)
	var in roleInput
	if !ok || c.Bind(&in) != nil || !validRole(in.Role) {
		return fail(c, http.StatusBadRequest, "invalid_input", "Rôle invalide")
	}
	target, err := m.userByID(c.Request().Context(), id)
	if err != nil {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	return m.changeRole(c, target, in.Role)
}

func (m *Module) handleTeamResetTOTP(c echo.Context) error {
	id, ok := idParam(c)
	if !ok {
		return fail(c, http.StatusBadRequest, "invalid_input", "Identifiant invalide")
	}
	ctx := c.Request().Context()
	target, err := m.userByID(ctx, id)
	if err != nil || !target.Role.IsTeam() {
		return fail(c, http.StatusNotFound, "not_found", "Membre introuvable")
	}
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, stmt := range []string{
			"DELETE FROM bo_totp WHERE user_id = ?",
			"DELETE FROM bo_backup_code WHERE user_id = ?",
			"DELETE FROM bo_trusted_device WHERE user_id = ?",
			// A fresh day to set it up again.
			"UPDATE users SET team_since = now() WHERE id = ?",
		} {
			if err := tx.Exec(stmt, target.ID).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return m.internal(c, err)
	}
	m.closeUserSessions(ctx, target.ID)
	m.audit(c, "team.totp_reset", "user", strconv.FormatInt(target.ID, 10), target.Name, "double authentification réinitialisée")
	return c.NoContent(http.StatusNoContent)
}
