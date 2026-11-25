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
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

type userRecord struct {
	ID                       int64             `gorm:"column:id"`
	Email                    string            `gorm:"column:email"`
	Name                     string            `gorm:"column:name"`
	Avatar                   *string           `gorm:"column:avatar"`
	Role                     Role              `gorm:"column:role"`
	CreatedAt                *time.Time        `gorm:"column:created_at"`
	LastSeenAt               *time.Time        `gorm:"column:last_seen_at"`
	SignupSource             *string           `gorm:"column:signup_source"`
	Age                      *int64            `gorm:"column:age"`
	FavoriteTeams            models.Int64Array `gorm:"column:favorite_teams"`
	GiftNote                 *string           `gorm:"column:premium_gift_note"`
	IAPProductID             *string           `gorm:"column:iap_product_id"`
	IAPTransactionID         *string           `gorm:"column:iap_transaction_id"`
	IAPOriginalTransactionID *string           `gorm:"column:iap_original_transaction_id"`
	IAPCheckedAt             *time.Time        `gorm:"column:iap_checked_at"`
	Facts                    premiumFacts      `gorm:"embedded"`
}

func (m *Module) userRecord(ctx context.Context, id int64) (*userRecord, error) {
	var u userRecord
	err := m.db.WithContext(ctx).Raw(`SELECT u.id, u.email, u.name, u.avatar, u.role, u.created_at, u.last_seen_at,
		u.signup_source, u.age, u.favorite_teams, u.premium_gift_note, u.iap_product_id, u.iap_transaction_id,
		u.iap_original_transaction_id, u.iap_checked_at, `+premiumFactColumns+` FROM users u WHERE u.id = ?`, id).Scan(&u).Error
	if err != nil {
		return nil, err
	}
	if u.ID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &u, nil
}

// maskReference keeps the last four characters of a store reference: enough to
// match it against a receipt, useless to anyone reading over a shoulder.
func maskReference(ref string) string {
	r := []rune(strings.TrimSpace(ref))
	if len(r) == 0 {
		return ""
	}
	if len(r) <= 4 {
		return strings.Repeat("•", len(r))
	}
	return strings.Repeat("•", 7) + string(r[len(r)-4:])
}

type accountView struct {
	ID            int64          `json:"id"`
	Email         string         `json:"email"`
	Name          string         `json:"name"`
	Avatar        *string        `json:"avatar"`
	Role          Role           `json:"role"`
	CreatedAt     *time.Time     `json:"created_at"`
	LastSeenAt    *time.Time     `json:"last_seen_at"`
	SignupSource  *string        `json:"signup_source"`
	Age           *int64         `json:"age"`
	FavoriteTeams []favoriteTeam `json:"favorite_teams"`
	// Sessions is nil when Redis couldn't be walked in time.
	Sessions *int `json:"sessions"`
}

type premiumView struct {
	premiumState
	Product *string `json:"product"`
	// Transaction is the store reference, masked; its kind tells which one.
	Transaction     *string `json:"transaction"`
	TransactionKind *string `json:"transaction_kind"`
	// LastVerifiedAt is the stores' last answer; nil for a purchase validated
	// before the date was kept.
	LastVerifiedAt *time.Time `json:"last_verified_at"`
	GiftNote       *string    `json:"gift_note"`
}

type deviceView struct {
	ID        int64      `json:"id"`
	Platform  string     `json:"platform"`
	Active    bool       `json:"active"`
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

type followedMatch struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name" gorm:"column:match_name"`
	Tournament    string     `json:"tournament" gorm:"column:tournament_name"`
	GameAcronym   string     `json:"game_acronym"`
	Game          string     `json:"game" gorm:"-"`
	Status        string     `json:"status"`
	BeginAt       *time.Time `json:"begin_at"`
	NotifiedStart bool       `json:"notified_start"`
	// Origin: "like", or the "tournament" / "team" follow that created the row.
	Origin    string     `json:"origin"`
	CreatedAt *time.Time `json:"created_at"`
}

type followedTournament struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name" gorm:"column:tournament_name"`
	GameAcronym string     `json:"game_acronym"`
	Game        string     `json:"game" gorm:"-"`
	Status      string     `json:"status"`
	BeginAt     *time.Time `json:"begin_at"`
	EndAt       *time.Time `json:"end_at"`
	CreatedAt   *time.Time `json:"created_at"`
}

type followLimit struct {
	Used  int64 `json:"used"`
	Limit int   `json:"limit"`
}

type followsView struct {
	Matches     []followedMatch      `json:"matches"`
	Tournaments []followedTournament `json:"tournaments"`
	// Totals count every row, the limits only what the free plan counts.
	MatchesTotal     int64       `json:"matches_total"`
	TournamentsTotal int64       `json:"tournaments_total"`
	MatchLimit       followLimit `json:"match_limit"`
	TournamentLimit  followLimit `json:"tournament_limit"`
	// Unlimited: Premium lifts both limits.
	Unlimited bool `json:"unlimited"`
}

const followedMatchColumns = `s.id, COALESCE(s.match_name, '') AS match_name, COALESCE(s.tournament_name, '') AS tournament_name,
	COALESCE(s.game_acronym, '') AS game_acronym, COALESCE(s.status, '') AS status, s.begin_at,
	COALESCE(s.notified_start, false) AS notified_start, s.created_at,
	CASE WHEN s.from_tournament IS NOT NULL THEN 'tournament' WHEN s.from_team IS NOT NULL THEN 'team' ELSE 'like' END AS origin`

const followedTournamentColumns = `s.id, COALESCE(s.tournament_name, '') AS tournament_name, COALESCE(s.game_acronym, '') AS game_acronym,
	COALESCE(s.status, '') AS status, s.begin_at, s.end_at, s.created_at`

// Still to come first, in the order they will be played; what is over goes last.
const followOrder = ` ORDER BY (COALESCE(s.status, '') IN ('finished', 'canceled')), s.begin_at ASC NULLS LAST, s.id DESC`

// gameNames maps whatever a subscription stored as its game (acronym, app slug
// or wiki) to the name shown on the site.
func (m *Module) gameNames(ctx context.Context) func(string) string {
	var games []struct {
		Acronym string
		Label   string
	}
	m.db.WithContext(ctx).Raw(
		`SELECT COALESCE(acronym, '') AS acronym, COALESCE(NULLIF(full_name, ''), name, '') AS label FROM games`).Scan(&games)
	byAcronym := make(map[string]string, len(games))
	for _, g := range games {
		byAcronym[g.Acronym] = g.Label
	}
	return func(id string) string {
		if label := byAcronym[id]; label != "" {
			return label
		}
		if wiki, ok := models.ResolveWiki(id); ok {
			if label := byAcronym[models.WikiToAcronym[wiki]]; label != "" {
				return label
			}
		}
		return id
	}
}

// loadFollows reads a user's follows; a positive limit keeps the first rows of
// each list (the overview), zero returns everything.
func (m *Module) loadFollows(ctx context.Context, userID int64, unlimited bool, matchLimit, tournamentLimit int) (*followsView, error) {
	db := m.db.WithContext(ctx)
	view := &followsView{
		Matches: []followedMatch{}, Tournaments: []followedTournament{}, Unlimited: unlimited,
		MatchLimit: followLimit{Limit: freeMatchLimit}, TournamentLimit: followLimit{Limit: freeTournamentLimit},
	}
	var counts struct {
		MatchesTotal     int64
		MatchesUsed      int64
		TournamentsTotal int64
		TournamentsUsed  int64
	}
	err := db.Raw(`SELECT
		(SELECT count(*) FROM match_subscription s WHERE s.user_id = @id) AS matches_total,
		(SELECT count(*) FROM match_subscription s WHERE s.user_id = @id AND `+sqlCountedMatch+`) AS matches_used,
		(SELECT count(*) FROM tournament_subscription s WHERE s.user_id = @id) AS tournaments_total,
		(SELECT count(*) FROM tournament_subscription s WHERE s.user_id = @id AND `+sqlActiveSubscription+`) AS tournaments_used`,
		map[string]interface{}{"id": userID}).Scan(&counts).Error
	if err != nil {
		return nil, err
	}
	view.MatchesTotal, view.TournamentsTotal = counts.MatchesTotal, counts.TournamentsTotal
	view.MatchLimit.Used, view.TournamentLimit.Used = counts.MatchesUsed, counts.TournamentsUsed

	limitSQL := func(n int) string {
		if n > 0 {
			return " LIMIT " + strconv.Itoa(n)
		}
		return " LIMIT 1000"
	}
	if err := db.Raw("SELECT "+followedMatchColumns+" FROM match_subscription s WHERE s.user_id = ?"+followOrder+limitSQL(matchLimit),
		userID).Scan(&view.Matches).Error; err != nil {
		return nil, err
	}
	if err := db.Raw("SELECT "+followedTournamentColumns+" FROM tournament_subscription s WHERE s.user_id = ?"+followOrder+limitSQL(tournamentLimit),
		userID).Scan(&view.Tournaments).Error; err != nil {
		return nil, err
	}

	game := m.gameNames(ctx)
	for i := range view.Matches {
		view.Matches[i].Game = game(view.Matches[i].GameAcronym)
	}
	for i := range view.Tournaments {
		view.Tournaments[i].Game = game(view.Tournaments[i].GameAcronym)
	}
	return view, nil
}

// siteSessions counts the devices signed in on the site and the app: one
// refresh key each. Nil when Redis couldn't be walked within the deadline.
func (m *Module) siteSessions(ctx context.Context, userID int64) *int {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	rdb := m.cache.GetClient()
	seen := map[string]struct{}{}
	iter := rdb.Scan(ctx, 0, cache.RefreshTokenPattern(userID), 1000).Iterator()
	for iter.Next(ctx) {
		seen[iter.Val()] = struct{}{}
	}
	if iter.Err() != nil {
		return nil
	}
	n := len(seen)
	if legacy, err := rdb.Exists(ctx, cache.LegacyRefreshTokenKey(userID)).Result(); err == nil {
		n += int(legacy)
	}
	return &n
}

type favoriteTeam struct {
	ID   int64   `json:"id"`
	Name *string `json:"name"`
}

// favoriteTeams names the teams whose page is already in the Liquipedia cache
// and leaves the others as bare ids: this screen never spends a call on the
// rate-limited outbound pipe.
func (m *Module) favoriteTeams(ctx context.Context, ids []int64) []favoriteTeam {
	teams := make([]favoriteTeam, len(ids))
	for i, id := range ids {
		teams[i].ID = id
	}
	if len(ids) == 0 {
		return teams
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	// A pageid only means something inside its wiki; the hint written when the
	// team was last resolved says which one.
	hintKeys := make([]string, len(ids))
	for i, id := range ids {
		hintKeys[i] = cache.LiqWikiHintKey(strconv.FormatInt(id, 10))
	}
	wikis, err := m.cache.MGet(ctx, hintKeys...)
	if err != nil {
		return teams
	}
	var teamKeys []string
	var owners []int
	for i, wiki := range wikis {
		if wiki == "" {
			continue
		}
		key := cache.LiqTeamPageIDKey(wiki, strconv.FormatInt(ids[i], 10))
		teamKeys = append(teamKeys, key, cache.StaleKey(key))
		owners = append(owners, i, i)
	}
	if len(teamKeys) == 0 {
		return teams
	}
	payloads, err := m.cache.MGet(ctx, teamKeys...)
	if err != nil {
		return teams
	}
	for k, raw := range payloads {
		if raw == "" || teams[owners[k]].Name != nil {
			continue
		}
		if name := cachedTeamName(raw); name != "" {
			teams[owners[k]].Name = &name
		}
	}
	return teams
}

func cachedTeamName(raw string) string {
	var payload struct {
		Result []struct {
			Name string `json:"name"`
		} `json:"result"`
	}
	if json.Unmarshal([]byte(raw), &payload) != nil || len(payload.Result) == 0 {
		return ""
	}
	return strings.TrimSpace(payload.Result[0].Name)
}

func (u *userRecord) premiumView(now time.Time) premiumView {
	view := premiumView{premiumState: u.Facts.state(now), GiftNote: u.GiftNote}
	if view.Source == nil || (*view.Source != sourceAppStore && *view.Source != sourceGooglePlay) {
		return view
	}
	view.Product = u.IAPProductID
	view.LastVerifiedAt = u.IAPCheckedAt
	ref, kind := "", "original_transaction"
	if u.IAPOriginalTransactionID != nil {
		ref = *u.IAPOriginalTransactionID
	}
	// On Android the only reference kept is the purchase token.
	if ref == "" && u.IAPTransactionID != nil {
		ref = *u.IAPTransactionID
		if *view.Source == sourceGooglePlay {
			kind = "purchase_token"
		}
	}
	if masked := maskReference(ref); masked != "" {
		view.Transaction, view.TransactionKind = &masked, &kind
	}
	return view
}

func (m *Module) userOr404(c echo.Context) (*userRecord, error) {
	id, ok := idParam(c)
	if !ok {
		return nil, fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	u, err := m.userRecord(c.Request().Context(), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	if err != nil {
		return nil, m.internal(c, err)
	}
	return u, nil
}

func (m *Module) handleUserDetail(c echo.Context) error {
	u, err := m.userOr404(c)
	if u == nil {
		return err
	}
	ctx := c.Request().Context()
	now := time.Now()
	premium := u.premiumView(now)

	devices := []deviceView{}
	if err := m.db.WithContext(ctx).Raw(
		`SELECT id, COALESCE(platform, '') AS platform, COALESCE(active, false) AS active, created_at, updated_at
		 FROM push_token WHERE user_id = ? ORDER BY COALESCE(active, false) DESC, updated_at DESC NULLS LAST, id DESC`,
		u.ID).Scan(&devices).Error; err != nil {
		return m.internal(c, err)
	}
	follows, err := m.loadFollows(ctx, u.ID, premium.Active, 4, freeTournamentLimit)
	if err != nil {
		return m.internal(c, err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user": accountView{
			ID: u.ID, Email: u.Email, Name: u.Name, Avatar: u.Avatar, Role: u.Role, CreatedAt: u.CreatedAt,
			LastSeenAt: u.LastSeenAt, SignupSource: u.SignupSource, Age: u.Age,
			FavoriteTeams: m.favoriteTeams(ctx, u.FavoriteTeams), Sessions: m.siteSessions(ctx, u.ID),
		},
		"premium": premium,
		"devices": devices,
		"follows": follows,
	})
}

func (m *Module) handleUserFollows(c echo.Context) error {
	u, err := m.userOr404(c)
	if u == nil {
		return err
	}
	follows, err := m.loadFollows(c.Request().Context(), u.ID, u.Facts.state(time.Now()).Active, 0, 0)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, follows)
}

func (m *Module) handleUserHistory(c echo.Context) error {
	id, ok := idParam(c)
	if !ok {
		return fail(c, http.StatusNotFound, "not_found", "Compte introuvable")
	}
	rows := []auditRow{}
	err := m.db.WithContext(c.Request().Context()).Table("bo_audit_log").
		Where("target_type = 'user' AND target_id = ?", strconv.FormatInt(id, 10)).
		Order("id DESC").Limit(200).Scan(&rows).Error
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"entries": rows})
}

// Everything the database holds about an account, section by section. Secrets
// stay out: the password hash, the two-factor secret, token and code hashes.
// @label is the id as text, for the journal's text column: GORM ends a named
// argument on a space, a comma or a parenthesis only, so no `@id::text`.
var accountExportSections = []struct{ name, query string }{
	{"push_tokens", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM push_token t WHERE t.user_id = @id`},
	{"match_subscriptions", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM match_subscription t WHERE t.user_id = @id`},
	{"tournament_subscriptions", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM tournament_subscription t WHERE t.user_id = @id`},
	{"notification_preferences", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM notifications t WHERE t.user_id = @id`},
	{"page_views", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM page_views t WHERE t.user_id = @id`},
	{"articles", `SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'title', t.title, 'created_at', t.created_at) ORDER BY t.id), '[]'::jsonb)
		FROM articles t WHERE t.author_id = @id`},
	{"two_factor", `SELECT COALESCE((SELECT jsonb_build_object('created_at', t.created_at, 'enabled_at', t.enabled_at) FROM bo_totp t WHERE t.user_id = @id), 'null'::jsonb)`},
	{"backup_codes", `SELECT jsonb_build_object('total', count(*), 'used', count(t.used_at)) FROM bo_backup_code t WHERE t.user_id = @id`},
	{"trusted_devices", `SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'token_hash' ORDER BY t.id), '[]'::jsonb) FROM bo_trusted_device t WHERE t.user_id = @id`},
	{"back_office_actions", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM bo_audit_log t WHERE t.actor_id = @id`},
	{"back_office_history", `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM bo_audit_log t
		WHERE t.target_type = 'user' AND t.target_id = @label`},
}

func (m *Module) handleUserExport(c echo.Context) error {
	u, err := m.userOr404(c)
	if u == nil {
		return err
	}
	db := m.db.WithContext(c.Request().Context())
	args := map[string]interface{}{"id": u.ID, "label": strconv.FormatInt(u.ID, 10)}

	type section struct {
		Name string
		Data json.RawMessage
	}
	var account string
	if err := db.Raw(`SELECT (to_jsonb(u) - 'password')::text FROM users u WHERE u.id = @id`, args).Scan(&account).Error; err != nil {
		return m.internal(c, err)
	}
	sections := []section{{"account", json.RawMessage(account)}}
	for _, s := range accountExportSections {
		var data string
		if err := db.Raw(`SELECT (`+s.query+`)::text`, args).Scan(&data).Error; err != nil {
			return m.internal(c, err)
		}
		sections = append(sections, section{s.name, json.RawMessage(data)})
	}

	// Written by hand to keep the sections in this order in the file.
	var out strings.Builder
	out.WriteString("{\n")
	out.WriteString(`  "exported_at": "` + time.Now().UTC().Format(time.RFC3339) + `"`)
	for _, s := range sections {
		pretty, err := json.MarshalIndent(s.Data, "  ", "  ")
		if err != nil {
			return m.internal(c, err)
		}
		out.WriteString(",\n  " + strconv.Quote(s.Name) + ": " + string(pretty))
	}
	out.WriteString("\n}\n")

	m.audit(c, "user.exported", "user", strconv.FormatInt(u.ID, 10), u.Email, "export JSON des données du compte")
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="compte-`+strconv.FormatInt(u.ID, 10)+`.json"`)
	return c.Blob(http.StatusOK, "application/json; charset=utf-8", []byte(out.String()))
}
