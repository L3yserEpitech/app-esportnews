package backoffice

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
)

const (
	adModeAdsense = "adsense"
	adModeCustom  = "custom"
	adModeOff     = "off"

	settingAdsLegacyImported = "ads.legacy_imported"
	settingAdsDefaultSlots   = "ads.default_slots_seeded"

	adSpotsCacheTTL = time.Hour
	// Browser and CDN lifetime of GET /api/ad-spots. The site keeps its own
	// copy five minutes per tab on top of it.
	adSpotsMaxAge = 30 * time.Second
	// How late the legacy `ads` table may follow a date window.
	adScheduleTick = 30 * time.Second
)

var (
	adSpotKeyRe    = regexp.MustCompile(`^[a-z0-9-]{2,40}$`)
	adSpotFormatRe = regexp.MustCompile(`^\d{2,4}x\d{2,4}$`)
	adsenseSlotRe  = regexp.MustCompile(`^\d{4,20}$`)

	adModeLabels = map[string]string{adModeAdsense: "régie", adModeCustom: "bannière perso", adModeOff: "masqué"}
)

type adSpot struct {
	Key          string     `json:"key" gorm:"column:key"`
	Label        string     `json:"label" gorm:"column:label"`
	Format       string     `json:"format" gorm:"column:format"`
	Placement    string     `json:"placement" gorm:"column:placement"`
	Sort         int        `json:"sort" gorm:"column:sort"`
	Mode         string     `json:"mode" gorm:"column:mode"`
	AdsenseSlot  string     `json:"adsense_slot" gorm:"column:adsense_slot"`
	Title        string     `json:"title" gorm:"column:title"`
	MediaURL     string     `json:"media_url" gorm:"column:media_url"`
	MediaType    string     `json:"media_type" gorm:"column:media_type"`
	RedirectLink string     `json:"redirect_link" gorm:"column:redirect_link"`
	StartsAt     *time.Time `json:"starts_at" gorm:"column:starts_at"`
	EndsAt       *time.Time `json:"ends_at" gorm:"column:ends_at"`
	UpdatedAt    time.Time  `json:"updated_at" gorm:"column:updated_at"`
	UpdatedBy    string     `json:"updated_by" gorm:"column:updated_by"`
}

// The spots the site has, each with the AdSense unit it falls back on. They
// can be hidden, never deleted: the pages of the site name them.
var seededAdSpots = []adSpot{
	{Key: "sidebar-1", Label: "Colonne droite, position 1", Format: "300x400", AdsenseSlot: "4410076654", Placement: "Colonne droite (ordinateur)", Sort: 1},
	{Key: "sidebar-2", Label: "Colonne droite, position 2", Format: "300x400", AdsenseSlot: "2003405164", Placement: "Colonne droite (ordinateur)", Sort: 2},
	{Key: "sidebar-3", Label: "Colonne droite, position 3", Format: "300x400", AdsenseSlot: "1783913314", Placement: "Colonne droite (ordinateur)", Sort: 3},
	{Key: "article-bottom", Label: "Fin d'article", Format: "728x90", AdsenseSlot: "9690323498", Placement: "Page article, sous le contenu (ordinateur et mobile)", Sort: 4},
	{Key: "mobile-1", Label: "Mobile, dans la page", Format: "320x100", AdsenseSlot: "9470831648", Placement: "Mobile : accueil, détail match, détail tournoi", Sort: 5},
}

// The only spots the legacy `ads` table knows, by position.
var legacyAdPositions = map[string]int16{"sidebar-1": 1, "sidebar-2": 2, "sidebar-3": 3}

func seededAdSpot(key string) bool {
	for _, s := range seededAdSpots {
		if s.Key == key {
			return true
		}
	}
	return false
}

// effectiveMode is what the site must show now: a custom banner outside its
// date window falls back on the ad network.
func (s adSpot) effectiveMode(now time.Time) string {
	if s.Mode != adModeCustom {
		return s.Mode
	}
	if s.StartsAt != nil && now.Before(*s.StartsAt) {
		return adModeAdsense
	}
	if s.EndsAt != nil && !now.Before(*s.EndsAt) {
		return adModeAdsense
	}
	return adModeCustom
}

// ---- what the site reads ----

type publicAdCreative struct {
	MediaURL     string `json:"media_url"`
	MediaType    string `json:"media_type"`
	RedirectLink string `json:"redirect_link"`
	Title        string `json:"title"`
}

type publicAdSpot struct {
	Mode        string            `json:"mode"`
	Format      string            `json:"format"`
	AdsenseSlot *string           `json:"adsense_slot"`
	Creative    *publicAdCreative `json:"creative"`
}

type publicAdSpots struct {
	Spots map[string]publicAdSpot `json:"spots"`
}

func buildPublicAdSpots(spots []adSpot, now time.Time) publicAdSpots {
	out := publicAdSpots{Spots: make(map[string]publicAdSpot, len(spots))}
	for _, s := range spots {
		p := publicAdSpot{Mode: s.effectiveMode(now), Format: s.Format}
		if s.AdsenseSlot != "" {
			slot := s.AdsenseSlot
			p.AdsenseSlot = &slot
		}
		if p.Mode == adModeCustom {
			p.Creative = &publicAdCreative{
				MediaURL: s.MediaURL, MediaType: s.MediaType, RedirectLink: s.RedirectLink, Title: s.Title,
			}
		}
		out.Spots[s.Key] = p
	}
	return out
}

// nextAdBoundary is the next moment the answer of the site changes by itself.
func nextAdBoundary(spots []adSpot, now time.Time) *time.Time {
	var next *time.Time
	for _, s := range spots {
		for _, t := range []*time.Time{s.StartsAt, s.EndsAt} {
			if t != nil && t.After(now) && (next == nil || t.Before(*next)) {
				next = t
			}
		}
	}
	return next
}

func adSpotsFreshUntil(spots []adSpot, now time.Time) time.Time {
	until := now.Add(adSpotsCacheTTL)
	if b := nextAdBoundary(spots, now); b != nil && b.Before(until) {
		until = *b
	}
	return until
}

// cachedAdSpots carries its own deadline: a cache hit must still tell browsers
// not to keep the answer past a date boundary.
type cachedAdSpots struct {
	Until   time.Time     `json:"until"`
	Payload publicAdSpots `json:"payload"`
}

func (m *Module) loadAdSpots(ctx context.Context) ([]adSpot, error) {
	spots := []adSpot{}
	err := m.db.WithContext(ctx).Raw("SELECT * FROM ad_spot ORDER BY sort, key").Scan(&spots).Error
	return spots, err
}

// cacheAdSpots stores the answer of the site. A write overwrites; a read only
// fills an empty key, so a read that loaded the spots just before a write
// can't put the old answer back for an hour.
func (m *Module) cacheAdSpots(ctx context.Context, spots []adSpot, now time.Time, afterWrite bool) cachedAdSpots {
	fresh := cachedAdSpots{Until: adSpotsFreshUntil(spots, now), Payload: buildPublicAdSpots(spots, now)}
	ttl := fresh.Until.Sub(now)
	raw, err := json.Marshal(fresh)
	switch {
	case err != nil || ttl < time.Second:
		if afterWrite {
			m.cache.Del(ctx, cache.CacheAdSpots)
		}
	case afterWrite:
		m.cache.Set(ctx, cache.CacheAdSpots, string(raw), ttl)
	default:
		m.cache.SetNX(ctx, cache.CacheAdSpots, string(raw), ttl)
	}
	return fresh
}

func (m *Module) publicAdSpots(ctx context.Context, now time.Time) (publicAdSpots, time.Time, error) {
	if raw, err := m.cache.Get(ctx, cache.CacheAdSpots); err == nil {
		var hit cachedAdSpots
		if json.Unmarshal([]byte(raw), &hit) == nil && hit.Payload.Spots != nil && hit.Until.After(now) {
			return hit.Payload, hit.Until, nil
		}
	}
	spots, err := m.loadAdSpots(ctx)
	if err != nil {
		return publicAdSpots{}, time.Time{}, err
	}
	fresh := m.cacheAdSpots(ctx, spots, now, false)
	return fresh.Payload, fresh.Until, nil
}

func (m *Module) handlePublicAdSpots(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 5*time.Second)
	defer cancel()
	now := time.Now()
	payload, until, err := m.publicAdSpots(ctx, now)
	if err != nil {
		return m.internal(c, err)
	}
	maxAge := adSpotsMaxAge
	if left := until.Sub(now); left < maxAge {
		maxAge = left
	}
	seconds := int(maxAge / time.Second)
	if seconds < 1 {
		c.Response().Header().Set("Cache-Control", "no-store")
	} else {
		c.Response().Header().Set("Cache-Control",
			fmt.Sprintf("public, max-age=%d, stale-while-revalidate=%d", seconds, seconds))
	}
	return c.JSON(http.StatusOK, payload)
}

// ---- legacy mirror ----

// The site still reads GET /api/ads until it switches to /api/ad-spots: the
// three sidebar spots are copied into the legacy table so it already obeys
// the back-office.

type legacyAd struct {
	Title        string
	Type         string
	URL          string
	RedirectLink string
}

// legacyAdsPlan says, for each sidebar position, the row the legacy table
// must hold: nil for none (ad network, hidden, or outside the date window).
func legacyAdsPlan(spots []adSpot, now time.Time) map[int16]*legacyAd {
	plan := map[int16]*legacyAd{}
	for _, s := range spots {
		pos, ok := legacyAdPositions[s.Key]
		if !ok {
			continue
		}
		plan[pos] = nil
		if s.effectiveMode(now) == adModeCustom {
			plan[pos] = &legacyAd{Title: s.Title, Type: s.MediaType, URL: s.MediaURL, RedirectLink: s.RedirectLink}
		}
	}
	return plan
}

type legacyAdRow struct {
	ID           int64   `gorm:"column:id"`
	Position     int16   `gorm:"column:position"`
	Title        *string `gorm:"column:title"`
	Type         *string `gorm:"column:type"`
	URL          *string `gorm:"column:url"`
	RedirectLink *string `gorm:"column:redirect_link"`
}

func (r legacyAdRow) holds(want *legacyAd) bool {
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	return str(r.Title) == want.Title && str(r.Type) == want.Type && str(r.URL) == want.URL && str(r.RedirectLink) == want.RedirectLink
}

// syncLegacyAds brings the legacy table in line with the spots and reports
// whether it had to write.
func (m *Module) syncLegacyAds(ctx context.Context, spots []adSpot, now time.Time) (bool, error) {
	plan := legacyAdsPlan(spots, now)
	rows := []legacyAdRow{}
	if err := m.db.WithContext(ctx).Raw(
		"SELECT id, position, title, type, url, redirect_link FROM ads WHERE position BETWEEN 1 AND 3 ORDER BY position, id").
		Scan(&rows).Error; err != nil {
		return false, err
	}
	have := map[int16][]legacyAdRow{}
	for _, r := range rows {
		have[r.Position] = append(have[r.Position], r)
	}

	var stale []int64
	updates := map[int64]*legacyAd{}
	inserts := map[int16]*legacyAd{}
	for pos, want := range plan {
		current := have[pos]
		if want == nil {
			for _, r := range current {
				stale = append(stale, r.ID)
			}
			continue
		}
		if len(current) == 0 {
			inserts[pos] = want
			continue
		}
		if !current[0].holds(want) {
			updates[current[0].ID] = want
		}
		for _, r := range current[1:] {
			stale = append(stale, r.ID)
		}
	}
	if len(stale) == 0 && len(updates) == 0 && len(inserts) == 0 {
		return false, nil
	}

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(stale) > 0 {
			if err := tx.Exec("DELETE FROM ads WHERE id IN ?", stale).Error; err != nil {
				return err
			}
		}
		for id, a := range updates {
			if err := tx.Exec("UPDATE ads SET title = ?, type = ?, url = ?, redirect_link = ? WHERE id = ?",
				a.Title, a.Type, a.URL, a.RedirectLink, id).Error; err != nil {
				return err
			}
		}
		if len(inserts) > 0 {
			// Rows migrated with their id left the sequence behind them: the
			// next default id could be one already taken.
			if err := tx.Exec(
				`SELECT setval(pg_get_serial_sequence('ads', 'id'), (SELECT max(id) FROM ads)) WHERE EXISTS (SELECT 1 FROM ads)`).Error; err != nil {
				return err
			}
		}
		for pos, a := range inserts {
			if err := tx.Exec("INSERT INTO ads (title, position, type, url, redirect_link) VALUES (?, ?, ?, ?, ?)",
				a.Title, pos, a.Type, a.URL, a.RedirectLink).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	m.cache.Del(ctx, cache.CacheAds)
	return true, nil
}

// adSpotsChanged runs after every write: the site must not keep an answer
// that is no longer true.
func (m *Module) adSpotsChanged(ctx context.Context) {
	now := time.Now()
	spots, err := m.loadAdSpots(ctx)
	if err != nil {
		m.cache.Del(ctx, cache.CacheAdSpots)
		m.log.WithError(err).Error("[BO] ad spots not reloaded after a write")
		return
	}
	m.cacheAdSpots(ctx, spots, now, true)
	if !m.legacyAdsImported(ctx) {
		return
	}
	if _, err := m.syncLegacyAds(ctx, spots, now); err != nil {
		m.log.WithError(err).Error("[BO] legacy ads not synced")
	}
}

// Until the banners of the legacy table are imported, the mirror would see
// three spots on the ad network and delete them.
func (m *Module) legacyAdsImported(ctx context.Context) bool {
	return m.setting(ctx, settingAdsLegacyImported, "") != ""
}

func (m *Module) syncLegacyAdsNow(ctx context.Context) error {
	spots, err := m.loadAdSpots(ctx)
	if err != nil {
		return err
	}
	_, err = m.syncLegacyAds(ctx, spots, time.Now())
	return err
}

// ---- startup ----

// prepareAdSpots seeds the spots the site has and, once, turns the banners of
// the legacy table into their custom creative. A spot that exists is never
// overwritten.
func (m *Module) prepareAdSpots(ctx context.Context) error {
	db := m.db.WithContext(ctx)
	for _, s := range seededAdSpots {
		if err := db.Exec(
			`INSERT INTO ad_spot (key, label, format, placement, sort, adsense_slot) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (key) DO NOTHING`,
			s.Key, s.Label, s.Format, s.Placement, s.Sort, s.AdsenseSlot).Error; err != nil {
			return err
		}
	}
	// Spots seeded before the units were known get theirs, once: emptied
	// later from the screen, a unit must stay empty.
	if m.setting(ctx, settingAdsDefaultSlots, "") == "" {
		for _, s := range seededAdSpots {
			if err := db.Exec("UPDATE ad_spot SET adsense_slot = ? WHERE key = ? AND adsense_slot = ''", s.AdsenseSlot, s.Key).Error; err != nil {
				return err
			}
		}
		if err := m.setSetting(ctx, settingAdsDefaultSlots, time.Now().UTC().Format(time.RFC3339)); err != nil {
			return err
		}
	}
	if m.legacyAdsImported(ctx) {
		return nil
	}
	// What the legacy site showed: rows with a visual and a link, the first
	// one of each position.
	rows := []legacyAdRow{}
	if err := db.Raw(
		`SELECT DISTINCT ON (position) id, position, title, type, url, redirect_link FROM ads
		 WHERE position BETWEEN 1 AND 3 AND btrim(coalesce(url, '')) <> '' AND btrim(coalesce(redirect_link, '')) <> ''
		 ORDER BY position, id`).Scan(&rows).Error; err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for _, r := range rows {
			mediaType := "image"
			if r.Type != nil && *r.Type == "video" {
				mediaType = "video"
			}
			title := ""
			if r.Title != nil {
				title = strings.TrimSpace(*r.Title)
			}
			if err := tx.Exec(
				`UPDATE ad_spot SET mode = 'custom', title = ?, media_url = ?, media_type = ?, redirect_link = ?,
				        updated_at = now(), updated_by = 'Import des bannières existantes'
				 WHERE key = ? AND mode = 'adsense' AND media_url = ''`,
				title, strings.TrimSpace(*r.URL), mediaType, strings.TrimSpace(*r.RedirectLink),
				fmt.Sprintf("sidebar-%d", r.Position)).Error; err != nil {
				return err
			}
		}
		// Same statement as setSetting, inside the transaction: the banners and
		// the flag land together.
		return tx.Exec(
			`INSERT INTO bo_setting (key, value, updated_at) VALUES (?, ?, now())
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			settingAdsLegacyImported, time.Now().UTC().Format(time.RFC3339)).Error
	})
}

// startAdJobs seeds the spots, then keeps the legacy table in step with the
// date windows: nothing else writes it when a banner starts or ends. A startup
// that could not seed or import is retried here before anything is mirrored.
func (m *Module) startAdJobs(ctx context.Context) {
	prepCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	err := m.prepareAdSpots(prepCtx)
	if err != nil {
		m.log.WithError(err).Error("[BO] ad spots not prepared")
	} else {
		// A release may seed new spots: the answer cached by the previous one is stale.
		m.adSpotsChanged(prepCtx)
	}
	cancel()
	prepared := err == nil
	go func() {
		tick := time.NewTicker(adScheduleTick)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
			}
			runCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			var err error
			if prepared {
				err = m.syncLegacyAdsNow(runCtx)
			} else if err = m.prepareAdSpots(runCtx); err == nil {
				prepared = true
				m.adSpotsChanged(runCtx)
			}
			cancel()
			if err != nil && ctx.Err() == nil {
				m.log.WithError(err).Warn("[BO] ad spots not in step")
			}
		}
	}()
}

// ---- back-office routes ----

// registerAdRoutes: `api` is the public /api group (the site reads
// GET /api/ad-spots), `g` the back-office group.
func (m *Module) registerAdRoutes(api, g *echo.Group) {
	api.GET("/ad-spots", m.handlePublicAdSpots)

	a := g.Group("/ads", m.require(PermAdsManage))
	a.GET("/spots", m.handleAdSpotList)
	a.POST("/spots", m.handleAdSpotCreate)
	a.PUT("/spots/:key", m.handleAdSpotUpdate)
	a.DELETE("/spots/:key", m.handleAdSpotDelete)
	g.POST("/upload/ad", m.handleAdUpload, m.require(PermAdsManage))
}

type adSpotView struct {
	adSpot
	EffectiveMode string `json:"effective_mode"`
	Builtin       bool   `json:"builtin"`
}

func viewAdSpot(s adSpot, now time.Time) adSpotView {
	return adSpotView{adSpot: s, EffectiveMode: s.effectiveMode(now), Builtin: seededAdSpot(s.Key)}
}

func (m *Module) handleAdSpotList(c echo.Context) error {
	spots, err := m.loadAdSpots(c.Request().Context())
	if err != nil {
		return m.internal(c, err)
	}
	now := time.Now()
	views := make([]adSpotView, 0, len(spots))
	for _, s := range spots {
		views = append(views, viewAdSpot(s, now))
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"spots": views})
}

func (m *Module) adSpotByKey(ctx context.Context, key string) (*adSpot, error) {
	var s adSpot
	if err := m.db.WithContext(ctx).Raw("SELECT * FROM ad_spot WHERE key = ?", key).Scan(&s).Error; err != nil {
		return nil, err
	}
	if s.Key == "" {
		return nil, gorm.ErrRecordNotFound
	}
	return &s, nil
}

// optional tells an absent JSON field (left as it is) from an explicit null
// (cleared): a plain pointer can't, and the dates need both.
type optional[T any] struct {
	Set   bool
	Value *T
}

func (o *optional[T]) UnmarshalJSON(raw []byte) error {
	o.Set = true
	if string(raw) == "null" {
		o.Value = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

type adSpotPatch struct {
	Mode         optional[string]    `json:"mode"`
	AdsenseSlot  optional[string]    `json:"adsense_slot"`
	Title        optional[string]    `json:"title"`
	MediaURL     optional[string]    `json:"media_url"`
	MediaType    optional[string]    `json:"media_type"`
	RedirectLink optional[string]    `json:"redirect_link"`
	StartsAt     optional[time.Time] `json:"starts_at"`
	EndsAt       optional[time.Time] `json:"ends_at"`
}

func (p adSpotPatch) apply(s adSpot) adSpot {
	text := func(o optional[string], current string) string {
		if !o.Set {
			return current
		}
		if o.Value == nil {
			return ""
		}
		return strings.TrimSpace(*o.Value)
	}
	s.Mode = text(p.Mode, s.Mode)
	s.AdsenseSlot = text(p.AdsenseSlot, s.AdsenseSlot)
	s.Title = text(p.Title, s.Title)
	s.MediaURL = text(p.MediaURL, s.MediaURL)
	s.MediaType = text(p.MediaType, s.MediaType)
	s.RedirectLink = text(p.RedirectLink, s.RedirectLink)
	if p.StartsAt.Set {
		s.StartsAt = p.StartsAt.Value
	}
	if p.EndsAt.Set {
		s.EndsAt = p.EndsAt.Value
	}
	return s
}

func httpsURL(raw string) bool {
	if len(raw) > 2000 || strings.ContainsAny(raw, " \t\r\n") {
		return false
	}
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.Host != ""
}

// validateAdSpot returns the reason a spot can't be saved, in French, or "".
func validateAdSpot(s adSpot) string {
	switch s.Mode {
	case adModeAdsense, adModeCustom, adModeOff:
	default:
		return "Mode inconnu : régie, bannière personnalisée ou masqué"
	}
	if s.MediaType != "image" && s.MediaType != "video" {
		return "Le visuel est une image ou une vidéo"
	}
	if s.AdsenseSlot != "" && !adsenseSlotRe.MatchString(s.AdsenseSlot) {
		return "L'identifiant du bloc AdSense ne contient que des chiffres"
	}
	if len([]rune(s.Title)) > 120 {
		return "Titre trop long (120 caractères au plus)"
	}
	if s.MediaURL != "" && !httpsURL(s.MediaURL) {
		return "L'adresse du visuel doit commencer par https://"
	}
	if s.RedirectLink != "" && !httpsURL(s.RedirectLink) {
		return "Le lien de redirection doit être une adresse complète en https://"
	}
	if s.StartsAt != nil && s.EndsAt != nil && !s.EndsAt.After(*s.StartsAt) {
		return "La date de fin doit suivre la date de début"
	}
	if s.Mode == adModeCustom {
		if s.MediaURL == "" {
			return "Une bannière personnalisée a besoin d'un visuel"
		}
		if s.RedirectLink == "" {
			return "Une bannière personnalisée a besoin d'un lien de redirection"
		}
	}
	return ""
}

func sameTime(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.Equal(*b)
}

// adSpotChanges is the detail written to the audit log.
func adSpotChanges(before, after adSpot) []string {
	var changes []string
	if before.Mode != after.Mode {
		changes = append(changes, adModeLabels[before.Mode]+" → "+adModeLabels[after.Mode])
	}
	if before.MediaURL != after.MediaURL || before.MediaType != after.MediaType {
		changes = append(changes, "visuel")
	}
	if before.Title != after.Title {
		changes = append(changes, "titre")
	}
	if before.RedirectLink != after.RedirectLink {
		changes = append(changes, "lien")
	}
	if !sameTime(before.StartsAt, after.StartsAt) || !sameTime(before.EndsAt, after.EndsAt) {
		changes = append(changes, "dates")
	}
	if before.AdsenseSlot != after.AdsenseSlot {
		changes = append(changes, "bloc AdSense")
	}
	return changes
}

func (m *Module) handleAdSpotUpdate(c echo.Context) error {
	var patch adSpotPatch
	if err := c.Bind(&patch); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	ctx := c.Request().Context()
	before, err := m.adSpotByKey(ctx, c.Param("key"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fail(c, http.StatusNotFound, "not_found", "Emplacement introuvable")
	}
	if err != nil {
		return m.internal(c, err)
	}
	after := patch.apply(*before)
	if reason := validateAdSpot(after); reason != "" {
		return fail(c, http.StatusBadRequest, "invalid_input", reason)
	}
	changes := adSpotChanges(*before, after)
	if len(changes) == 0 {
		return c.JSON(http.StatusOK, viewAdSpot(*before, time.Now()))
	}
	after.UpdatedAt = time.Now()
	after.UpdatedBy = sessionOf(c).User.Name
	if err := m.db.WithContext(ctx).Exec(
		`UPDATE ad_spot SET mode = ?, adsense_slot = ?, title = ?, media_url = ?, media_type = ?, redirect_link = ?,
		        starts_at = ?, ends_at = ?, updated_at = ?, updated_by = ? WHERE key = ?`,
		after.Mode, after.AdsenseSlot, after.Title, after.MediaURL, after.MediaType, after.RedirectLink,
		after.StartsAt, after.EndsAt, after.UpdatedAt, after.UpdatedBy, after.Key).Error; err != nil {
		return m.internal(c, err)
	}
	m.adSpotsChanged(ctx)
	m.audit(c, "ads.updated", "ad_spot", after.Key, after.Label, strings.Join(changes, ", "))
	return c.JSON(http.StatusOK, viewAdSpot(after, time.Now()))
}

type adSpotInput struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Format    string `json:"format"`
	Placement string `json:"placement"`
}

func (m *Module) handleAdSpotCreate(c echo.Context) error {
	var in adSpotInput
	if err := c.Bind(&in); err != nil {
		return fail(c, http.StatusBadRequest, "invalid_input", "Requête invalide")
	}
	in.Key = strings.TrimSpace(in.Key)
	in.Format = strings.TrimSpace(in.Format)
	in.Label = clip(in.Label, 80)
	in.Placement = clip(in.Placement, 120)
	switch {
	case !adSpotKeyRe.MatchString(in.Key):
		return fail(c, http.StatusBadRequest, "invalid_input", "Identifiant : 2 à 40 caractères, minuscules, chiffres et tirets")
	case in.Label == "":
		return fail(c, http.StatusBadRequest, "invalid_input", "Nom de l'emplacement requis")
	case !adSpotFormatRe.MatchString(in.Format):
		return fail(c, http.StatusBadRequest, "invalid_input", "Format attendu : largeur x hauteur, par exemple 300x250")
	case in.Placement == "":
		return fail(c, http.StatusBadRequest, "invalid_input", "Indiquez où se trouve l'emplacement sur le site")
	}
	ctx := c.Request().Context()
	res := m.db.WithContext(ctx).Exec(
		`INSERT INTO ad_spot (key, label, format, placement, sort, updated_by)
		 VALUES (?, ?, ?, ?, (SELECT coalesce(max(sort), 0) + 1 FROM ad_spot), ?) ON CONFLICT (key) DO NOTHING`,
		in.Key, in.Label, in.Format, in.Placement, sessionOf(c).User.Name)
	if res.Error != nil {
		return m.internal(c, res.Error)
	}
	if res.RowsAffected == 0 {
		return fail(c, http.StatusConflict, "already_exists", "Un emplacement porte déjà cet identifiant")
	}
	m.adSpotsChanged(ctx)
	m.audit(c, "ads.updated", "ad_spot", in.Key, in.Label, "emplacement créé ("+in.Format+")")
	created, err := m.adSpotByKey(ctx, in.Key)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusCreated, viewAdSpot(*created, time.Now()))
}

func (m *Module) handleAdSpotDelete(c echo.Context) error {
	ctx := c.Request().Context()
	spot, err := m.adSpotByKey(ctx, c.Param("key"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fail(c, http.StatusNotFound, "not_found", "Emplacement introuvable")
	}
	if err != nil {
		return m.internal(c, err)
	}
	if seededAdSpot(spot.Key) {
		return fail(c, http.StatusConflict, "builtin_spot", "Cet emplacement fait partie du site : masquez-le plutôt que de le supprimer")
	}
	if err := m.db.WithContext(ctx).Exec("DELETE FROM ad_spot WHERE key = ?", spot.Key).Error; err != nil {
		return m.internal(c, err)
	}
	m.adSpotsChanged(ctx)
	m.audit(c, "ads.updated", "ad_spot", spot.Key, spot.Label, "emplacement supprimé")
	return c.NoContent(http.StatusNoContent)
}

func (m *Module) handleAdUpload(c echo.Context) error {
	stored, err := m.storeUpload(c, "ads/images")
	if err != nil || stored == nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]string{"url": stored.URL, "media_type": stored.Kind})
}
