package backoffice

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/services"
)

const (
	settingStoreLastApple  = "push.store_last_apple"
	settingStoreLastGoogle = "push.store_last_google"

	// What iOS and Android show before cutting: the limits of the form.
	maxPushTitle = 65
	maxPushBody  = 178

	storeSilenceAfter = 48 * time.Hour
	manualPushLockTTL = time.Minute
	manualPushTimeout = 3 * time.Minute
)

type pushAudience struct {
	Platform string // "" = every device
	Label    string
}

var pushAudiences = map[string]pushAudience{
	"all":     {Label: services.PushAudienceAll},
	"ios":     {Platform: "ios", Label: "iOS seulement"},
	"android": {Platform: "android", Label: "Android seulement"},
}

func (m *Module) registerPushRoutes(g *echo.Group) {
	p := g.Group("/push")
	p.GET("/stats", m.handlePushStats)
	p.GET("/log", m.handlePushLog)
	p.GET("/stores", m.handlePushStores)
	p.GET("/settings", m.handlePushSettings)
	p.PUT("/settings", m.handlePushSettingsUpdate, m.require(PermPushBroadcast))
	p.GET("/audience", m.handlePushAudience)
	p.POST("/send", m.handlePushSend, m.require(PermPushBroadcast), m.requireSudo)
}

// ---- figures ----

func (m *Module) handlePushStats(c echo.Context) error {
	db := m.db.WithContext(c.Request().Context())

	var reachable struct {
		Total   int64 `json:"total"`
		IOS     int64 `json:"ios" gorm:"column:ios"`
		Android int64 `json:"android"`
	}
	if err := db.Raw(
		`SELECT count(*) AS total,
		        count(*) FILTER (WHERE lower(platform) = 'ios') AS ios,
		        count(*) FILTER (WHERE lower(platform) = 'android') AS android
		 FROM push_token WHERE active = true`).Scan(&reachable).Error; err != nil {
		return m.internal(c, err)
	}

	var week struct {
		Sent        int64
		Deactivated int64
		Delivered   int64
		Failed      int64
	}
	if err := db.Raw(
		`SELECT COALESCE(sum(sent), 0) AS sent,
		        COALESCE(sum(deactivated), 0) AS deactivated,
		        COALESCE(sum(delivered) FILTER (WHERE receipts_checked_at IS NOT NULL), 0) AS delivered,
		        COALESCE(sum(failed) FILTER (WHERE receipts_checked_at IS NOT NULL), 0) AS failed
		 FROM bo_push_log WHERE created_at >= ?`, time.Now().AddDate(0, 0, -7)).Scan(&week).Error; err != nil {
		return m.internal(c, err)
	}
	var rate *float64
	if answered := week.Delivered + week.Failed; answered > 0 {
		r := float64(week.Delivered) / float64(answered)
		rate = &r
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"reachable":        reachable,
		"sent_7d":          week.Sent,
		"delivery_rate_7d": rate,
		"deactivated_7d":   week.Deactivated,
	})
}

type pushLogRow struct {
	ID                int64      `json:"id"`
	Kind              string     `json:"kind"`
	Title             string     `json:"title"`
	Audience          string     `json:"audience"`
	Sent              int        `json:"sent"`
	Delivered         *int       `json:"delivered"`
	Failed            int        `json:"failed"`
	ReceiptsCheckedAt *time.Time `json:"receipts_checked_at"`
	CreatedAt         time.Time  `json:"created_at"`
}

// Nobody knows how many were delivered until the receipts are read.
const pushLogColumns = `id, kind, title, audience, sent,
	CASE WHEN receipts_checked_at IS NULL THEN NULL ELSE delivered END AS delivered,
	failed, receipts_checked_at, created_at`

func (m *Module) handlePushLog(c echo.Context) error {
	db := m.db.WithContext(c.Request().Context())
	where, args := "", []interface{}{}
	switch kind := c.QueryParam("kind"); kind {
	case "":
	case services.PushKindArticle, services.PushKindMatch, services.PushKindManual:
		where, args = " WHERE kind = ?", append(args, kind)
	default:
		return fail(c, http.StatusBadRequest, "invalid_input", "Type de notification inconnu")
	}
	limit, err := strconv.Atoi(c.QueryParam("limit"))
	if err != nil || limit <= 0 || limit > 100 {
		limit = 25
	}
	offset, err := strconv.Atoi(c.QueryParam("offset"))
	if err != nil || offset < 0 {
		offset = 0
	}

	var total int64
	if err := db.Raw("SELECT count(*) FROM bo_push_log"+where, args...).Scan(&total).Error; err != nil {
		return m.internal(c, err)
	}
	entries := []pushLogRow{}
	if err := db.Raw("SELECT "+pushLogColumns+" FROM bo_push_log"+where+" ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
		append(args, limit, offset)...).Scan(&entries).Error; err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"entries": entries, "total": total})
}

func (m *Module) countDevices(ctx context.Context, audience pushAudience) (int64, error) {
	var n int64
	q := m.db.WithContext(ctx).Table("push_token").Where("active = ?", true)
	if audience.Platform != "" {
		q = q.Where("lower(platform) = ?", audience.Platform)
	}
	return n, q.Count(&n).Error
}

func (m *Module) handlePushAudience(c echo.Context) error {
	key := c.QueryParam("audience")
	if key == "" {
		key = "all"
	}
	audience, ok := pushAudiences[key]
	if !ok {
		return fail(c, http.StatusBadRequest, "invalid_input", "Audience inconnue")
	}
	devices, err := m.countDevices(c.Request().Context(), audience)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"devices": devices})
}

// ---- store notifications ----

type storeStatus struct {
	LastAt *time.Time `json:"last_at"`
	// "received", "silent" (nothing for 48 h while subscribers exist) or
	// "idle" (nothing recent, and nobody whose subscription could change).
	Status string `json:"status"`
}

// StoreNotificationAccepted returns the hook a store webhook calls after each
// notification it handled: "apple" or "google".
func (m *Module) StoreNotificationAccepted(store string) func() {
	key := settingStoreLastGoogle
	if store == "apple" {
		key = settingStoreLastApple
	}
	return func() {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := m.setSetting(ctx, key, time.Now().UTC().Format(time.RFC3339)); err != nil {
				m.log.WithError(err).WithField("store", store).Warn("[BO] store notification time not saved")
			}
		}()
	}
}

func (m *Module) storeStatus(ctx context.Context, settingKey, platform string) (storeStatus, error) {
	s := storeStatus{LastAt: m.settingTime(ctx, settingKey), Status: "received"}
	if s.LastAt != nil && time.Since(*s.LastAt) <= storeSilenceAfter {
		return s, nil
	}
	// iap_expires_at is not read: it is the very date a missed notification leaves stale.
	var subscribers int64
	if err := m.db.WithContext(ctx).
		Raw("SELECT count(*) FROM users WHERE iap_platform = ? AND premium = true", platform).
		Scan(&subscribers).Error; err != nil {
		return s, err
	}
	s.Status = "idle"
	if subscribers > 0 {
		s.Status = "silent"
	}
	return s, nil
}

func (m *Module) storeStatuses(ctx context.Context) (apple, google storeStatus, err error) {
	if apple, err = m.storeStatus(ctx, settingStoreLastApple, "ios"); err != nil {
		return
	}
	google, err = m.storeStatus(ctx, settingStoreLastGoogle, "android")
	return
}

func (m *Module) handlePushStores(c echo.Context) error {
	apple, google, err := m.storeStatuses(c.Request().Context())
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"apple": apple, "google": google})
}

// navPushAlerts is the amber counter next to « Notifications push ».
func (m *Module) navPushAlerts(c echo.Context) *int {
	apple, google, err := m.storeStatuses(c.Request().Context())
	if err != nil {
		return nil
	}
	silent := 0
	for _, s := range []storeStatus{apple, google} {
		if s.Status == "silent" {
			silent++
		}
	}
	return &silent
}

// ---- settings ----

// MatchLiveAlertEnabled is the switch the notification scheduler reads at
// every tick. An unreadable setting leaves the alerts on.
func (m *Module) MatchLiveAlertEnabled(ctx context.Context) bool {
	return m.settingBool(ctx, SettingMatchLiveAlert, true)
}

type pushSettings struct {
	NotifyNewArticle *bool `json:"notify_new_article"`
	MatchLiveAlert   *bool `json:"match_live_alert"`
}

func (m *Module) readPushSettings(ctx context.Context) pushSettings {
	article := m.settingBool(ctx, SettingNotifyNewArticle, true)
	match := m.settingBool(ctx, SettingMatchLiveAlert, true)
	return pushSettings{NotifyNewArticle: &article, MatchLiveAlert: &match}
}

func (m *Module) handlePushSettings(c echo.Context) error {
	return c.JSON(http.StatusOK, m.readPushSettings(c.Request().Context()))
}

func (m *Module) handlePushSettingsUpdate(c echo.Context) error {
	var in pushSettings
	if err := c.Bind(&in); err != nil || (in.NotifyNewArticle == nil && in.MatchLiveAlert == nil) {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	current := m.readPushSettings(ctx)
	for _, change := range []struct {
		key, label string
		next, was  *bool
	}{
		{SettingNotifyNewArticle, "Notifier à chaque nouvel article", in.NotifyNewArticle, current.NotifyNewArticle},
		{SettingMatchLiveAlert, "Alerte « Match en direct »", in.MatchLiveAlert, current.MatchLiveAlert},
	} {
		if change.next == nil || *change.next == *change.was {
			continue
		}
		if err := m.setSetting(ctx, change.key, strconv.FormatBool(*change.next)); err != nil {
			return m.internal(c, err)
		}
		state := "désactivé"
		if *change.next {
			state = "activé"
		}
		m.audit(c, "settings.changed", "setting", change.key, change.label, change.label+" : "+state)
	}
	return c.JSON(http.StatusOK, m.readPushSettings(ctx))
}

// ---- manual push ----

type manualPushInput struct {
	Title       string `json:"title"`
	Body        string `json:"body"`
	Audience    string `json:"audience"`
	ArticleSlug string `json:"article_slug"`
}

// validateManualPush trims the input and returns the message to show when it
// can't be sent.
func validateManualPush(in manualPushInput) (manualPushInput, pushAudience, string) {
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	in.ArticleSlug = strings.TrimSpace(in.ArticleSlug)
	audience, ok := pushAudiences[in.Audience]
	switch {
	case in.Title == "":
		return in, audience, "Le titre est requis"
	case in.Body == "":
		return in, audience, "Le message est requis"
	case utf8.RuneCountInString(in.Title) > maxPushTitle:
		return in, audience, fmt.Sprintf("Le titre dépasse %d caractères", maxPushTitle)
	case utf8.RuneCountInString(in.Body) > maxPushBody:
		return in, audience, fmt.Sprintf("Le message dépasse %d caractères", maxPushBody)
	case !ok:
		return in, audience, "Audience inconnue"
	}
	return in, audience, ""
}

// manualPushData is what the app receives with the notification. Without a
// link the type is one the published app doesn't route: a tap just opens it.
func manualPushData(slug string, category *string) map[string]interface{} {
	if slug == "" {
		return map[string]interface{}{"type": "manual"}
	}
	return map[string]interface{}{"type": services.ArticlePushType(category), "slug": slug}
}

func (m *Module) handlePushSend(c echo.Context) error {
	var raw manualPushInput
	if err := c.Bind(&raw); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	in, audience, problem := validateManualPush(raw)
	if problem != "" {
		return fail(c, http.StatusBadRequest, "invalid_input", problem)
	}
	reqCtx := c.Request().Context()
	db := m.db.WithContext(reqCtx)

	var category *string
	if in.ArticleSlug != "" {
		var article struct {
			ID       int64
			Category *string
			Status   string
		}
		if err := db.Raw("SELECT id, category, status FROM articles WHERE slug = ?", in.ArticleSlug).Scan(&article).Error; err != nil {
			return m.internal(c, err)
		}
		if article.ID == 0 || article.Status != "published" {
			return fail(c, http.StatusBadRequest, "article_not_found", "Cet article n'existe pas ou n'est pas publié")
		}
		category = article.Category
	}

	var tokens []string
	q := db.Table("push_token").Where("active = ?", true)
	if audience.Platform != "" {
		q = q.Where("lower(platform) = ?", audience.Platform)
	}
	if err := q.Order("id").Pluck("token", &tokens).Error; err != nil {
		return m.internal(c, err)
	}
	if len(tokens) == 0 {
		return fail(c, http.StatusConflict, "no_device", "Aucun appareil joignable pour cette audience")
	}

	// A double click or a retry must not notify every device twice.
	sum := sha256.Sum256([]byte(in.Title + "\x00" + in.Body + "\x00" + in.Audience + "\x00" + in.ArticleSlug))
	locked, err := m.cache.GetClient().SetNX(reqCtx, "bo:push:manual:"+hex.EncodeToString(sum[:]), "1", manualPushLockTTL).Result()
	if err != nil {
		return fail(c, http.StatusServiceUnavailable, "store_unavailable", "Service de session indisponible")
	}
	if !locked {
		return fail(c, http.StatusConflict, "duplicate", "Cette notification vient d'être envoyée. Attendez une minute avant de la renvoyer.")
	}

	data := manualPushData(in.ArticleSlug, category)
	messages := make([]services.ExpoPushMessage, 0, len(tokens))
	for _, token := range tokens {
		messages = append(messages, services.ExpoPushMessage{
			To:        []string{token},
			Title:     in.Title,
			Body:      in.Body,
			Sound:     "default",
			ChannelId: services.PushChannelContent,
			Data:      data,
		})
	}

	// Closing the tab mid-send must not leave half the devices notified and no trace.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(reqCtx), manualPushTimeout)
	defer cancel()
	s := sessionOf(c)
	results := m.push.Send(ctx, messages)
	if gone := services.InvalidTokens(results); len(gone) > 0 {
		if err := m.db.WithContext(ctx).Exec(
			"UPDATE push_token SET active = false, updated_at = now() WHERE token IN ? AND active = true", gone).Error; err != nil {
			m.log.WithError(err).Warn("[BO] invalid push tokens not deactivated")
		}
	}

	entry := pushLogRow{Kind: services.PushKindManual, Title: in.Title, Audience: audience.Label, Sent: len(results), CreatedAt: time.Now()}
	for _, r := range results {
		if !r.OK() {
			entry.Failed++
		}
	}
	id, err := m.recordPush(ctx, services.PushRecord{
		Kind: services.PushKindManual, Title: in.Title, Body: in.Body, Audience: audience.Label,
		Ref: in.ArticleSlug, ActorID: s.User.ID, Results: results,
	})
	if err != nil {
		// The push is gone: say so rather than invite a second send.
		m.log.WithError(err).Error("[BO] manual push sent but not recorded")
	} else if err := m.db.WithContext(ctx).Raw("SELECT "+pushLogColumns+" FROM bo_push_log WHERE id = ?", id).Scan(&entry).Error; err != nil {
		m.log.WithError(err).Warn("[BO] manual push entry not read back")
		entry.ID = id
	}

	title := in.Title
	if r := []rune(title); len(r) > 60 {
		title = string(r[:60]) + "…"
	}
	devices := "appareils"
	if len(results) == 1 {
		devices = "appareil"
	}
	m.audit(c, "push.manual", "push", strconv.FormatInt(id, 10), audience.Label,
		fmt.Sprintf(`"%s", %d %s`, title, len(results), devices))
	return c.JSON(http.StatusCreated, entry)
}
