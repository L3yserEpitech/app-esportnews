package backoffice

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// auditRetention is the « Conservé 1 an » of the screen.
const auditRetention = 365 * 24 * time.Hour

type auditRow struct {
	ID          int64     `json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	ActorID     *int64    `json:"actor_id"`
	ActorName   string    `json:"actor_name"`
	Action      string    `json:"action"`
	TargetType  string    `json:"target_type"`
	TargetID    string    `json:"target_id"`
	TargetLabel string    `json:"target_label"`
	Detail      string    `json:"detail"`
	Device      string    `json:"device"`
	City        string    `json:"city"`
}

func (m *Module) registerAuditRoutes(g *echo.Group) {
	a := g.Group("/audit", m.require(PermAuditRead))
	a.GET("", m.handleAuditList)
	a.GET("/export", m.handleAuditExport)
}

func (m *Module) auditQuery(c echo.Context) *gorm.DB {
	q := m.db.WithContext(c.Request().Context()).Table("bo_audit_log")
	if days, err := strconv.Atoi(c.QueryParam("days")); err == nil && days > 0 && days <= 366 {
		q = q.Where("created_at >= ?", time.Now().AddDate(0, 0, -days))
	}
	if actor, err := strconv.ParseInt(c.QueryParam("actor"), 10, 64); err == nil && actor > 0 {
		q = q.Where("actor_id = ?", actor)
	}
	if action := strings.TrimSpace(c.QueryParam("action")); action != "" {
		// "article" selects every article.* action.
		if strings.Contains(action, ".") {
			q = q.Where("action = ?", action)
		} else {
			q = q.Where("action LIKE ?", action+".%")
		}
	}
	if search := strings.TrimSpace(c.QueryParam("q")); search != "" {
		like := "%" + escapeLike(search) + "%"
		q = q.Where("(target_label ILIKE ? OR detail ILIKE ? OR target_id ILIKE ?)", like, like, like)
	}
	return q
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (m *Module) handleAuditList(c echo.Context) error {
	limit := 100
	q := m.auditQuery(c)
	if before, err := strconv.ParseInt(c.QueryParam("before"), 10, 64); err == nil && before > 0 {
		q = q.Where("id < ?", before)
	}
	rows := []auditRow{}
	if err := q.Order("id DESC").Limit(limit + 1).Scan(&rows).Error; err != nil {
		return m.internal(c, err)
	}
	more := len(rows) > limit
	if more {
		rows = rows[:limit]
	}

	type actor struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}
	actors := []actor{}
	m.db.WithContext(c.Request().Context()).Raw(
		`SELECT DISTINCT actor_id AS id, actor_name AS name FROM bo_audit_log
		 WHERE actor_id IS NOT NULL AND created_at >= now() - interval '90 days' ORDER BY name`).Scan(&actors)

	return c.JSON(http.StatusOK, map[string]interface{}{"entries": rows, "has_more": more, "actors": actors})
}

func (m *Module) handleAuditExport(c echo.Context) error {
	rows := []auditRow{}
	if err := m.auditQuery(c).Order("id DESC").Limit(20000).Scan(&rows).Error; err != nil {
		return m.internal(c, err)
	}
	m.audit(c, "audit.exported", "audit", "", "Journal d'audit", strconv.Itoa(len(rows))+" lignes")

	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="journal-audit.csv"`)
	c.Response().WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Response())
	w.Write([]string{"date", "membre", "action", "type", "cible", "identifiant", "detail", "ville", "appareil"})
	for _, r := range rows {
		w.Write([]string{
			r.CreatedAt.Format(time.RFC3339), r.ActorName, r.Action, r.TargetType,
			csvSafe(r.TargetLabel), r.TargetID, csvSafe(r.Detail), r.City, r.Device,
		})
	}
	w.Flush()
	return w.Error()
}

// csvSafe defuses a cell a spreadsheet would run as a formula.
func csvSafe(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

func (m *Module) purgeOldAudit() {
	if err := m.db.Exec("DELETE FROM bo_audit_log WHERE created_at < ?", time.Now().Add(-auditRetention)).Error; err != nil {
		m.log.WithError(err).Warn("[BO] audit retention purge failed")
	}
}
