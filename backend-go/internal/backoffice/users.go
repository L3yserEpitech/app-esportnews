package backoffice

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	usersPageSize    = 25
	usersPageMax     = 100
	usersExportLimit = 50000

	// How close the end of a paid period must be for « Expire dans N j ».
	premiumExpiringWindow = 3 * 24 * time.Hour

	// Mirrors of handlers.FreeMatchSubLimit and FreeTournamentSubLimit, checked
	// by a test: importing handlers here would tie the two packages together.
	freeMatchLimit      = 5
	freeTournamentLimit = 3
)

func (m *Module) registerUserRoutes(g *echo.Group) {
	u := g.Group("/users", m.require(PermUsersManage))
	u.GET("", m.handleUserList)
	u.GET("/stats", m.handleUserStats)
	u.GET("/export", m.handleUserListExport, m.requireSudo)
	u.GET("/:id", m.handleUserDetail)
	u.GET("/:id/follows", m.handleUserFollows)
	u.GET("/:id/history", m.handleUserHistory)
	u.GET("/:id/export", m.handleUserExport)
	u.POST("/:id/logout-all", m.handleUserLogoutAll)
	u.PATCH("/:id/role", m.handleUserRole, m.requireSudo)
	u.PUT("/:id/premium-gift", m.handleUserPremiumGift)
	u.DELETE("/:id", m.handleUserDelete, m.requireSudo)
}

// ---- premium ----

const (
	sourceAppStore   = "app_store"
	sourceGooglePlay = "google_play"
	sourceStripe     = "stripe"
	sourceGift       = "gift"
)

// premiumFacts is what `users` knows about an account's Premium.
type premiumFacts struct {
	Premium          bool       `gorm:"column:premium"`
	Gifted           bool       `gorm:"column:premium_gifted"`
	IAPPlatform      *string    `gorm:"column:iap_platform"`
	IAPExpiresAt     *time.Time `gorm:"column:iap_expires_at"`
	HasStripe        bool       `gorm:"column:has_stripe"`
	StripeStatus     *string    `gorm:"column:subscription_status"`
	StripePeriodEnd  *time.Time `gorm:"column:subscription_current_period_end"`
	StripeCanceledAt *time.Time `gorm:"column:subscription_canceled_at"`
}

const premiumFactColumns = `COALESCE(u.premium, false) AS premium, u.premium_gifted, u.iap_platform, u.iap_expires_at,
	(u.stripe_customer_id IS NOT NULL OR u.stripe_subscription_id IS NOT NULL) AS has_stripe,
	u.subscription_status, u.subscription_current_period_end, u.subscription_canceled_at`

// The SQL twins of premiumFacts.state, used by the list filters and by the
// removal of a gift. A test holds the two together.
const (
	sqlPremiumActive = `(COALESCE(u.premium, false) OR u.premium_gifted)`
	// COALESCE keeps these two-valued: they are negated and written into a column.
	// A purchase check that failed leaves a platform and no expiry: not valid.
	sqlIAPValid    = `(COALESCE(u.iap_platform, '') IN ('ios', 'android') AND COALESCE(u.iap_expires_at > now(), false))`
	sqlStripeValid = `(COALESCE(u.subscription_status, '') IN ('active', 'past_due'))`
	sqlPaidSource  = `(` + sqlPremiumActive + ` AND (` + sqlIAPValid + ` OR ` + sqlStripeValid + ` OR (NOT u.premium_gifted AND (
		COALESCE(u.iap_platform, '') IN ('ios', 'android') OR u.stripe_customer_id IS NOT NULL OR u.stripe_subscription_id IS NOT NULL))))`
	sqlPremiumExpiring = `(` + sqlPremiumActive + ` AND (
		(` + sqlIAPValid + ` AND u.iap_expires_at <= now() + interval '3 days')
		OR (NOT ` + sqlIAPValid + ` AND ` + sqlStripeValid + ` AND u.subscription_canceled_at IS NOT NULL
			AND u.subscription_current_period_end > now() AND u.subscription_current_period_end <= now() + interval '3 days')))`
)

type premiumState struct {
	Active    bool       `json:"active"`
	Source    *string    `json:"source"`
	ExpiresAt *time.Time `json:"expires_at"`
	Gifted    bool       `json:"gifted"`
	// Expiring: the paid period ends within premiumExpiringWindow and nothing
	// on record says it renews.
	Expiring bool `json:"expiring"`
	// WillRenew is only known for Stripe; the stores' auto-renew flag isn't stored.
	WillRenew *bool `json:"will_renew"`
}

func storeOf(platform *string) string {
	if platform == nil {
		return ""
	}
	switch *platform {
	case "ios":
		return sourceAppStore
	case "android":
		return sourceGooglePlay
	}
	return ""
}

// state names where an account's Premium comes from. A subscription still
// running wins over a gift, a gift over a subscription that has lapsed.
func (f premiumFacts) state(now time.Time) premiumState {
	st := premiumState{Active: f.Premium || f.Gifted, Gifted: f.Gifted}
	if !st.Active {
		return st
	}
	store := storeOf(f.IAPPlatform)
	iapValid := store != "" && f.IAPExpiresAt != nil && f.IAPExpiresAt.After(now)
	stripeValid := f.StripeStatus != nil && (*f.StripeStatus == "active" || *f.StripeStatus == "past_due")
	soon := func(t *time.Time) bool {
		return t != nil && t.After(now) && !t.After(now.Add(premiumExpiringWindow))
	}

	fromStore := func() {
		st.Source = &store
		st.ExpiresAt = f.IAPExpiresAt
		st.Expiring = iapValid && soon(f.IAPExpiresAt)
	}
	fromStripe := func() {
		source := sourceStripe
		st.Source = &source
		st.ExpiresAt = f.StripePeriodEnd
		if stripeValid {
			renews := f.StripeCanceledAt == nil
			st.WillRenew = &renews
			st.Expiring = !renews && soon(f.StripePeriodEnd)
		}
	}
	switch {
	case iapValid:
		fromStore()
	case stripeValid:
		fromStripe()
	case f.Gifted:
		source := sourceGift
		st.Source = &source
	case store != "":
		fromStore()
	case f.HasStripe:
		fromStripe()
	}
	return st
}

// ---- list ----

type userListRow struct {
	ID                  int64      `gorm:"column:id"`
	Email               string     `gorm:"column:email"`
	Name                string     `gorm:"column:name"`
	Role                Role       `gorm:"column:role"`
	CreatedAt           *time.Time `gorm:"column:created_at"`
	LastSeenAt          *time.Time `gorm:"column:last_seen_at"`
	Devices             int64      `gorm:"column:devices"`
	MatchesFollowed     int64      `gorm:"column:matches_followed"`
	TournamentsFollowed int64      `gorm:"column:tournaments_followed"`
	// Named: GORM only fills exported fields, an embedded unexported type isn't one.
	Facts premiumFacts `gorm:"embedded"`
}

type userListItem struct {
	ID                  int64        `json:"id"`
	Email               string       `json:"email"`
	Name                string       `json:"name"`
	Role                Role         `json:"role"`
	Premium             premiumState `json:"premium"`
	Devices             int64        `json:"devices"`
	MatchesFollowed     int64        `json:"matches_followed"`
	TournamentsFollowed int64        `json:"tournaments_followed"`
	CreatedAt           *time.Time   `json:"created_at"`
	LastSeenAt          *time.Time   `json:"last_seen_at"`
}

type deletedAccount struct {
	UserID       int64      `json:"user_id"`
	RegisteredAt *time.Time `json:"registered_at"`
	DeletedAt    time.Time  `json:"deleted_at"`
	DeletedBy    string     `json:"deleted_by"`
	Reason       string     `json:"reason"`
}

// What the free plan counts: explicit likes of matches not yet over. Rows a
// followed tournament or a favorite team created don't use the allowance.
const (
	sqlActiveSubscription = `COALESCE(s.status, '') NOT IN ('finished', 'canceled')`
	sqlCountedMatch       = `s.match2_id IS NOT NULL AND s.match2_id <> '' AND s.from_tournament IS NULL AND s.from_team IS NULL AND ` + sqlActiveSubscription
)

const userListColumns = `u.id, u.email, u.name, u.role, u.created_at, u.last_seen_at, ` + premiumFactColumns + `,
	(SELECT count(*) FROM push_token p WHERE p.user_id = u.id AND p.active) AS devices,
	(SELECT count(*) FROM match_subscription s WHERE s.user_id = u.id AND ` + sqlCountedMatch + `) AS matches_followed,
	(SELECT count(*) FROM tournament_subscription s WHERE s.user_id = u.id AND ` + sqlActiveSubscription + `) AS tournaments_followed`

type sqlFilter struct {
	conds []string
	args  []interface{}
}

func (f *sqlFilter) add(cond string, args ...interface{}) {
	f.conds = append(f.conds, cond)
	f.args = append(f.args, args...)
}

func (f sqlFilter) where() string {
	if len(f.conds) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(f.conds, " AND ")
}

type userQuery struct {
	View     string
	Search   string
	Role     string
	Premium  string
	Platform string
	Since    int
}

// parseUserQuery reads the filters of the list; ok is false on a value the
// screen never sends.
func parseUserQuery(get func(string) string) (q userQuery, ok bool) {
	q = userQuery{
		View:     get("view"),
		Search:   strings.TrimSpace(get("q")),
		Role:     get("role"),
		Premium:  get("premium"),
		Platform: get("platform"),
	}
	if q.View == "" {
		q.View = "all"
	}
	switch q.View {
	case "all", "premium", "team", "deleted":
	default:
		return q, false
	}
	if q.Role != "" && !validRole(Role(q.Role)) {
		return q, false
	}
	switch q.Premium {
	case "", "store", "gifted", "expiring", "none":
	default:
		return q, false
	}
	switch q.Platform {
	case "", "ios", "android", "none":
	default:
		return q, false
	}
	if raw := get("since"); raw != "" {
		days, err := strconv.Atoi(raw)
		if err != nil || (days != 7 && days != 28 && days != 90) {
			return q, false
		}
		q.Since = days
	}
	return q, true
}

func (q userQuery) filter() sqlFilter {
	var f sqlFilter
	switch q.View {
	case "premium":
		f.add(sqlPremiumActive)
	case "team":
		f.add("u.role <> 'user'")
	}
	if q.Search != "" {
		like := "%" + escapeLike(q.Search) + "%"
		if id, err := strconv.ParseInt(q.Search, 10, 64); err == nil {
			f.add("(u.id = ? OR u.email ILIKE ?)", id, like)
		} else {
			f.add("u.email ILIKE ?", like)
		}
	}
	if q.Role != "" {
		f.add("u.role = ?", q.Role)
	}
	switch q.Premium {
	case "store":
		f.add(sqlPaidSource)
	case "gifted":
		f.add("u.premium_gifted")
	case "expiring":
		f.add(sqlPremiumExpiring)
	case "none":
		f.add("NOT " + sqlPremiumActive)
	}
	switch q.Platform {
	case "ios", "android":
		f.add("EXISTS (SELECT 1 FROM push_token p WHERE p.user_id = u.id AND p.active AND p.platform = ?)", q.Platform)
	case "none":
		f.add("NOT EXISTS (SELECT 1 FROM push_token p WHERE p.user_id = u.id AND p.active)")
	}
	if q.Since > 0 {
		f.add("u.created_at >= ?", time.Now().AddDate(0, 0, -q.Since))
	}
	return f
}

// deletedFilter: tombstones carry no address, only the identifier can be searched.
func (q userQuery) deletedFilter() sqlFilter {
	var f sqlFilter
	if q.Search != "" {
		id, err := strconv.ParseInt(q.Search, 10, 64)
		if err != nil {
			id = -1
		}
		f.add("user_id = ?", id)
	}
	if q.Since > 0 {
		f.add("deleted_at >= ?", time.Now().AddDate(0, 0, -q.Since))
	}
	return f
}

func pageParams(c echo.Context) (limit, offset int) {
	limit = usersPageSize
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil && n > 0 {
		limit = n
	}
	if limit > usersPageMax {
		limit = usersPageMax
	}
	if n, err := strconv.Atoi(c.QueryParam("offset")); err == nil && n > 0 {
		offset = n
	}
	return limit, offset
}

func (m *Module) loadUsers(c echo.Context, f sqlFilter, limit, offset int) ([]userListItem, error) {
	rows := []userListRow{}
	args := append(append([]interface{}{}, f.args...), limit, offset)
	err := m.db.WithContext(c.Request().Context()).Raw(
		"SELECT "+userListColumns+" FROM users u"+f.where()+" ORDER BY u.created_at DESC NULLS LAST, u.id DESC LIMIT ? OFFSET ?",
		args...).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	now := time.Now()
	items := make([]userListItem, len(rows))
	for i, r := range rows {
		items[i] = userListItem{
			ID: r.ID, Email: r.Email, Name: r.Name, Role: r.Role, Premium: r.Facts.state(now),
			Devices: r.Devices, MatchesFollowed: r.MatchesFollowed, TournamentsFollowed: r.TournamentsFollowed,
			CreatedAt: r.CreatedAt, LastSeenAt: r.LastSeenAt,
		}
	}
	return items, nil
}

func (m *Module) loadDeleted(c echo.Context, f sqlFilter, limit, offset int) ([]deletedAccount, error) {
	rows := []deletedAccount{}
	args := append(append([]interface{}{}, f.args...), limit, offset)
	err := m.db.WithContext(c.Request().Context()).Raw(
		"SELECT user_id, registered_at, deleted_at, deleted_by, reason FROM bo_deleted_account"+f.where()+
			" ORDER BY deleted_at DESC, id DESC LIMIT ? OFFSET ?", args...).Scan(&rows).Error
	return rows, err
}

func (m *Module) handleUserList(c echo.Context) error {
	q, ok := parseUserQuery(c.QueryParam)
	if !ok {
		return fail(c, http.StatusBadRequest, "invalid_input", "Filtre invalide")
	}
	limit, offset := pageParams(c)
	db := m.db.WithContext(c.Request().Context())
	var total int64

	if q.View == "deleted" {
		f := q.deletedFilter()
		if err := db.Raw("SELECT count(*) FROM bo_deleted_account"+f.where(), f.args...).Scan(&total).Error; err != nil {
			return m.internal(c, err)
		}
		deleted, err := m.loadDeleted(c, f, limit, offset)
		if err != nil {
			return m.internal(c, err)
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"users": []userListItem{}, "deleted": deleted, "total": total})
	}

	f := q.filter()
	if err := db.Raw("SELECT count(*) FROM users u"+f.where(), f.args...).Scan(&total).Error; err != nil {
		return m.internal(c, err)
	}
	users, err := m.loadUsers(c, f, limit, offset)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"users": users, "total": total})
}

func (m *Module) handleUserStats(c echo.Context) error {
	var stats struct {
		Accounts         int64 `json:"accounts"`
		PremiumActive    int64 `json:"premium_active"`
		ReachableDevices int64 `json:"reachable_devices"`
		Signups28d       int64 `json:"signups_28d" gorm:"column:signups_28d"`
	}
	err := m.db.WithContext(c.Request().Context()).Raw(`SELECT
		(SELECT count(*) FROM users) AS accounts,
		(SELECT count(*) FROM users u WHERE ` + sqlPremiumActive + `) AS premium_active,
		(SELECT count(*) FROM push_token WHERE active) AS reachable_devices,
		(SELECT count(*) FROM users WHERE created_at >= now() - interval '28 days') AS signups_28d`).Scan(&stats).Error
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, stats)
}

var premiumSourceLabels = map[string]string{
	sourceAppStore: "App Store", sourceGooglePlay: "Google Play", sourceStripe: "Stripe", sourceGift: "Offert",
}

func csvTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

func csvBool(b bool) string {
	if b {
		return "oui"
	}
	return "non"
}

func (m *Module) handleUserListExport(c echo.Context) error {
	q, ok := parseUserQuery(c.QueryParam)
	if !ok {
		return fail(c, http.StatusBadRequest, "invalid_input", "Filtre invalide")
	}

	var header []string
	var lines [][]string
	filename := "utilisateurs.csv"
	if q.View == "deleted" {
		deleted, err := m.loadDeleted(c, q.deletedFilter(), usersExportLimit, 0)
		if err != nil {
			return m.internal(c, err)
		}
		filename = "comptes-supprimes.csv"
		header = []string{"identifiant", "inscrit_le", "supprime_le", "supprime_par", "motif"}
		for _, d := range deleted {
			lines = append(lines, []string{
				strconv.FormatInt(d.UserID, 10), csvTime(d.RegisteredAt), d.DeletedAt.Format(time.RFC3339),
				csvSafe(d.DeletedBy), csvSafe(d.Reason),
			})
		}
	} else {
		users, err := m.loadUsers(c, q.filter(), usersExportLimit, 0)
		if err != nil {
			return m.internal(c, err)
		}
		header = []string{
			"identifiant", "email", "nom", "role", "premium", "source_premium", "echeance_premium", "premium_offert",
			"appareils", "matchs_suivis", "tournois_suivis", "inscrit_le", "derniere_visite",
		}
		for _, u := range users {
			source := ""
			if u.Premium.Source != nil {
				source = premiumSourceLabels[*u.Premium.Source]
			}
			lines = append(lines, []string{
				strconv.FormatInt(u.ID, 10), csvSafe(u.Email), csvSafe(u.Name), roleLabels[u.Role],
				csvBool(u.Premium.Active), source, csvTime(u.Premium.ExpiresAt), csvBool(u.Premium.Gifted),
				strconv.FormatInt(u.Devices, 10), strconv.FormatInt(u.MatchesFollowed, 10),
				strconv.FormatInt(u.TournamentsFollowed, 10), csvTime(u.CreatedAt), csvTime(u.LastSeenAt),
			})
		}
	}
	m.audit(c, "users.exported", "users", "", "Liste des utilisateurs", q.describe(len(lines)))

	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="`+filename+`"`)
	c.Response().WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Response())
	w.Write(header)
	for _, line := range lines {
		w.Write(line)
	}
	w.Flush()
	return w.Error()
}

// describe is the audit detail of an export: how much left, under which filters.
// The search text stays out: it may be someone's address.
func (q userQuery) describe(lines int) string {
	parts := []string{strconv.Itoa(lines) + " lignes"}
	views := map[string]string{"premium": "vue Premium", "team": "vue Équipe", "deleted": "vue Supprimés"}
	if v := views[q.View]; v != "" {
		parts = append(parts, v)
	}
	if q.Search != "" {
		parts = append(parts, "recherche")
	}
	if q.Role != "" {
		parts = append(parts, "rôle "+roleLabels[Role(q.Role)])
	}
	if q.Premium != "" {
		parts = append(parts, "premium "+q.Premium)
	}
	if q.Platform != "" {
		parts = append(parts, "plateforme "+q.Platform)
	}
	if q.Since > 0 {
		parts = append(parts, "inscrits depuis "+strconv.Itoa(q.Since)+" j")
	}
	return strings.Join(parts, ", ")
}
