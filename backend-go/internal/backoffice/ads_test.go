package backoffice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/testdb"
)

var adNow = time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)

func at(d time.Duration) *time.Time {
	t := adNow.Add(d)
	return &t
}

func customSpot(key string, starts, ends *time.Time) adSpot {
	return adSpot{
		Key: key, Label: "Spot " + key, Format: "300x400", Mode: adModeCustom, MediaType: "image",
		Title: "Bannière", MediaURL: "https://media.test/ads/images/b.png", RedirectLink: "https://partner.test/",
		StartsAt: starts, EndsAt: ends,
	}
}

func TestAdSpotEffectiveModeFollowsTheDateWindow(t *testing.T) {
	cases := []struct {
		name string
		spot adSpot
		want string
	}{
		{"ad network", adSpot{Mode: adModeAdsense}, adModeAdsense},
		{"hidden", adSpot{Mode: adModeOff}, adModeOff},
		{"hidden ignores a window", adSpot{Mode: adModeOff, StartsAt: at(-time.Hour), EndsAt: at(time.Hour)}, adModeOff},
		{"custom without dates", customSpot("a", nil, nil), adModeCustom},
		{"custom before its start", customSpot("a", at(time.Minute), nil), adModeAdsense},
		{"custom at its start", customSpot("a", at(0), nil), adModeCustom},
		{"custom inside its window", customSpot("a", at(-time.Hour), at(time.Hour)), adModeCustom},
		{"custom at its end", customSpot("a", nil, at(0)), adModeAdsense},
		{"custom after its end", customSpot("a", at(-2*time.Hour), at(-time.Hour)), adModeAdsense},
		{"custom with an end only", customSpot("a", nil, at(time.Hour)), adModeCustom},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.spot.effectiveMode(adNow))
		})
	}
}

func TestPublicAdSpotsPayloadMatchesTheContract(t *testing.T) {
	scheduled := customSpot("sidebar-2", at(time.Hour), nil)
	scheduled.AdsenseSlot = "1234567890"
	spots := []adSpot{
		customSpot("sidebar-1", nil, nil),
		scheduled,
		{Key: "sidebar-3", Format: "300x400", Mode: adModeOff, MediaURL: "https://media.test/kept.png", MediaType: "image"},
		{Key: "article-top", Format: "728x90", Mode: adModeAdsense},
	}
	raw, err := json.Marshal(buildPublicAdSpots(spots, adNow))
	require.NoError(t, err)
	assert.JSONEq(t, `{"spots": {
		"sidebar-1": {"mode": "custom", "format": "300x400", "adsense_slot": null,
			"creative": {"media_url": "https://media.test/ads/images/b.png", "media_type": "image", "redirect_link": "https://partner.test/", "title": "Bannière"}},
		"sidebar-2": {"mode": "adsense", "format": "300x400", "adsense_slot": "1234567890", "creative": null},
		"sidebar-3": {"mode": "off", "format": "300x400", "adsense_slot": null, "creative": null},
		"article-top": {"mode": "adsense", "format": "728x90", "adsense_slot": null, "creative": null}
	}}`, string(raw))

	empty, err := json.Marshal(buildPublicAdSpots(nil, adNow))
	require.NoError(t, err)
	assert.JSONEq(t, `{"spots": {}}`, string(empty))
}

func TestAdSpotsCacheNeverOutlivesTheNextBoundary(t *testing.T) {
	noDates := []adSpot{customSpot("a", nil, nil), {Key: "b", Mode: adModeAdsense}}
	assert.Equal(t, adNow.Add(time.Hour), adSpotsFreshUntil(noDates, adNow), "one hour without any date")

	past := []adSpot{customSpot("a", at(-3*time.Hour), at(-2*time.Hour))}
	assert.Equal(t, adNow.Add(time.Hour), adSpotsFreshUntil(past, adNow), "a boundary already crossed doesn't count")

	far := []adSpot{customSpot("a", at(2*time.Hour), nil)}
	assert.Equal(t, adNow.Add(time.Hour), adSpotsFreshUntil(far, adNow), "a boundary beyond the hour doesn't shorten it")

	soon := []adSpot{customSpot("a", at(-time.Hour), at(20*time.Minute)), customSpot("b", at(5*time.Minute), at(40*time.Minute))}
	assert.Equal(t, adNow.Add(5*time.Minute), adSpotsFreshUntil(soon, adNow), "the earliest start or end ahead wins")
	assert.Equal(t, adNow.Add(20*time.Minute), adSpotsFreshUntil(soon, adNow.Add(5*time.Minute)), "then the next one")
}

func TestLegacyAdsPlanMirrorsOnlyTheSidebarSpots(t *testing.T) {
	video := customSpot("sidebar-2", at(-time.Hour), at(time.Hour))
	video.MediaType = "video"
	plan := legacyAdsPlan([]adSpot{
		customSpot("sidebar-1", at(time.Hour), nil),
		video,
		{Key: "sidebar-3", Mode: adModeOff},
		customSpot("article-top", nil, nil),
	}, adNow)

	require.Len(t, plan, 3, "a spot the legacy site doesn't know is left out")
	assert.Nil(t, plan[1], "scheduled: nothing yet")
	assert.Equal(t, &legacyAd{Title: "Bannière", Type: "video", URL: "https://media.test/ads/images/b.png", RedirectLink: "https://partner.test/"}, plan[2])
	assert.Nil(t, plan[3], "hidden")
}

func TestValidateAdSpot(t *testing.T) {
	ok := customSpot("a", at(time.Hour), at(2*time.Hour))
	assert.Empty(t, validateAdSpot(ok))
	assert.Empty(t, validateAdSpot(adSpot{Mode: adModeAdsense, MediaType: "image"}), "the ad network needs no creative")
	assert.Empty(t, validateAdSpot(adSpot{Mode: adModeOff, MediaType: "image", AdsenseSlot: "1234567890"}))

	broken := map[string]func(s *adSpot){
		"unknown mode":           func(s *adSpot) { s.Mode = "banner" },
		"unknown media type":     func(s *adSpot) { s.MediaType = "audio" },
		"custom without media":   func(s *adSpot) { s.MediaURL = "" },
		"custom without link":    func(s *adSpot) { s.RedirectLink = "" },
		"http link":              func(s *adSpot) { s.RedirectLink = "http://partner.test/" },
		"relative link":          func(s *adSpot) { s.RedirectLink = "/promo" },
		"scheme-less link":       func(s *adSpot) { s.RedirectLink = "partner.test" },
		"javascript link":        func(s *adSpot) { s.RedirectLink = "javascript:alert(1)" },
		"link with a space":      func(s *adSpot) { s.RedirectLink = "https://partner.test/a b" },
		"http media":             func(s *adSpot) { s.MediaURL = "http://media.test/b.png" },
		"end before start":       func(s *adSpot) { s.EndsAt = at(30 * time.Minute) },
		"end equal to start":     func(s *adSpot) { s.EndsAt = s.StartsAt },
		"slot with letters":      func(s *adSpot) { s.AdsenseSlot = "ca-pub-123" },
		"title over 120 letters": func(s *adSpot) { s.Title = string(bytes.Repeat([]byte("a"), 121)) },
	}
	for name, breakIt := range broken {
		t.Run(name, func(t *testing.T) {
			s := ok
			breakIt(&s)
			assert.NotEmpty(t, validateAdSpot(s))
		})
	}
}

func TestAdSpotPatchTellsAbsentFromNull(t *testing.T) {
	current := customSpot("a", at(time.Hour), at(2*time.Hour))

	var onlyMode adSpotPatch
	require.NoError(t, json.Unmarshal([]byte(`{"mode": "adsense"}`), &onlyMode))
	next := onlyMode.apply(current)
	assert.Equal(t, adModeAdsense, next.Mode)
	assert.Equal(t, current.MediaURL, next.MediaURL, "the creative is kept for a later switch back")
	assert.Equal(t, current.StartsAt, next.StartsAt)

	var clearDates adSpotPatch
	require.NoError(t, json.Unmarshal([]byte(`{"starts_at": null, "ends_at": "2026-12-01T00:00:00Z", "title": "  Noël  "}`), &clearDates))
	next = clearDates.apply(current)
	assert.Nil(t, next.StartsAt)
	assert.True(t, next.EndsAt.Equal(time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)))
	assert.Equal(t, "Noël", next.Title)

	var bad adSpotPatch
	assert.Error(t, json.Unmarshal([]byte(`{"starts_at": "demain"}`), &bad))
}

func TestAdSpotChangesReadInFrench(t *testing.T) {
	before := adSpot{Mode: adModeAdsense, MediaType: "image"}
	after := customSpot("a", at(time.Hour), nil)
	after.AdsenseSlot = "1234567890"
	assert.Equal(t, []string{"régie → bannière perso", "visuel", "titre", "lien", "dates", "bloc AdSense"}, adSpotChanges(before, after))
	assert.Empty(t, adSpotChanges(after, after))

	sameInstant := after
	sameInstant.StartsAt = at(time.Hour)
	assert.Empty(t, adSpotChanges(after, sameInstant), "two pointers to the same instant are not a change")

	hidden := after
	hidden.Mode = adModeOff
	assert.Equal(t, []string{"bannière perso → masqué"}, adSpotChanges(after, hidden))
}

// ---- with a database ----

func quietLogger() *logrus.Logger {
	l := logrus.New()
	l.SetOutput(io.Discard)
	return l
}

// adsTestModule empties ad_spot and the legacy ads table.
func adsTestModule(t *testing.T) (*Module, *miniredis.Miniredis) {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Article{}, &models.Ad{}))
	require.NoError(t, EnsureSchema(db))
	reset := func() {
		require.NoError(t, db.Exec("TRUNCATE ad_spot").Error)
		require.NoError(t, db.Exec("TRUNCATE ads RESTART IDENTITY").Error)
		require.NoError(t, db.Exec("DELETE FROM bo_setting WHERE key IN (?, ?)", settingAdsLegacyImported, settingAdsDefaultSlots).Error)
		require.NoError(t, db.Exec("DELETE FROM bo_audit_log WHERE target_type IN ('ad_spot', 'media')").Error)
	}
	reset()
	t.Cleanup(reset)
	mr := miniredis.RunT(t)
	return &Module{db: db, cache: cache.NewRedisClient("redis://" + mr.Addr()), log: quietLogger()}, mr
}

func asMember(role Role) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set(ctxSession, &Session{UserID: 7, User: &teamUser{ID: 7, Name: "Camille Test", Role: role}})
			return next(c)
		}
	}
}

func boTestServer(m *Module, role Role) *echo.Echo {
	e := echo.New()
	api := e.Group("/api")
	g := api.Group("/bo", asMember(role))
	m.registerAdRoutes(api, g)
	m.registerMediaRoutes(g)
	return e
}

func call(e *echo.Echo, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func insertLegacyAd(t *testing.T, db *gorm.DB, position int, title, mediaType, mediaURL, link string) {
	t.Helper()
	require.NoError(t, db.Exec("INSERT INTO ads (title, position, type, url, redirect_link) VALUES (?, ?, ?, ?, ?)",
		title, position, mediaType, mediaURL, link).Error)
}

type legacyAdState struct {
	Position     int
	Title        string
	Type         string
	URL          string
	RedirectLink string
}

func legacyAds(t *testing.T, db *gorm.DB) []legacyAdState {
	t.Helper()
	rows := []legacyAdState{}
	require.NoError(t, db.Raw("SELECT position, title, type, url, redirect_link FROM ads ORDER BY position, id").Scan(&rows).Error)
	return rows
}

func spotByKey(t *testing.T, m *Module, key string) adSpot {
	t.Helper()
	s, err := m.adSpotByKey(context.Background(), key)
	require.NoError(t, err)
	return *s
}

func auditDetails(t *testing.T, db *gorm.DB, targetID string) []string {
	t.Helper()
	var details []string
	require.NoError(t, db.Raw("SELECT detail FROM bo_audit_log WHERE target_id = ? ORDER BY id", targetID).Scan(&details).Error)
	return details
}

func TestPrepareAdSpotsSeedsThenImportsTheLegacyBannersOnce(t *testing.T) {
	m, _ := adsTestModule(t)
	ctx := context.Background()
	// Like production: positions 1 and 3 taken, 2 free.
	insertLegacyAd(t, m.db, 3, "App", "image", " https://i.postimg.cc/app.png ", "https://www.mybusinessevent.com/")
	insertLegacyAd(t, m.db, 1, "Business Event", "image", "https://i.postimg.cc/event.jpg", "https://www.mybusinessevent.com/")
	insertLegacyAd(t, m.db, 1, "Doublon plus récent", "image", "https://i.postimg.cc/dup.jpg", "https://www.mybusinessevent.com/")
	insertLegacyAd(t, m.db, 2, "Sans lien", "image", "https://i.postimg.cc/x.png", "")

	require.NoError(t, m.prepareAdSpots(ctx))

	spots, err := m.loadAdSpots(ctx)
	require.NoError(t, err)
	require.Len(t, spots, 5)
	type seed struct{ key, label, format, slot, placement string }
	var got []seed
	for _, s := range spots {
		got = append(got, seed{s.Key, s.Label, s.Format, s.AdsenseSlot, s.Placement})
		assert.Regexp(t, adSpotFormatRe, s.Format)
	}
	assert.Equal(t, []seed{
		{"sidebar-1", "Colonne droite, position 1", "300x400", "4410076654", "Colonne droite (ordinateur)"},
		{"sidebar-2", "Colonne droite, position 2", "300x400", "2003405164", "Colonne droite (ordinateur)"},
		{"sidebar-3", "Colonne droite, position 3", "300x400", "1783913314", "Colonne droite (ordinateur)"},
		{"article-bottom", "Fin d'article", "728x90", "9690323498", "Page article, sous le contenu (ordinateur et mobile)"},
		{"mobile-1", "Mobile, dans la page", "320x100", "9470831648", "Mobile : accueil, détail match, détail tournoi"},
	}, got)

	assert.Equal(t, adModeCustom, spots[0].Mode)
	assert.Equal(t, "Business Event", spots[0].Title, "the first row of a position is the one the site showed")
	assert.Equal(t, "https://i.postimg.cc/event.jpg", spots[0].MediaURL)
	assert.Equal(t, "https://www.mybusinessevent.com/", spots[0].RedirectLink)
	assert.Equal(t, adModeAdsense, spots[1].Mode, "a legacy row the site never showed is not imported")
	assert.Equal(t, adModeCustom, spots[2].Mode)
	assert.Equal(t, "https://i.postimg.cc/app.png", spots[2].MediaURL)
	assert.Equal(t, adModeAdsense, spots[3].Mode)
	assert.Equal(t, adModeAdsense, spots[4].Mode)
	assert.True(t, m.legacyAdsImported(ctx))
	for _, s := range spots {
		assert.Empty(t, validateAdSpot(s), "an imported spot can be saved again as it is: %s", s.Key)
		if s.Mode == adModeCustom {
			assert.NotEmpty(t, s.MediaURL)
			assert.NotEmpty(t, s.RedirectLink)
		}
	}

	// Later: the team hands sidebar-1 back to the ad network, renames it and
	// empties its AdSense unit, then the server restarts while the legacy
	// table still holds a banner.
	require.NoError(t, m.db.Exec("UPDATE ad_spot SET mode = 'adsense', media_url = '', label = 'Renommé', adsense_slot = '' WHERE key = 'sidebar-1'").Error)
	require.NoError(t, m.prepareAdSpots(ctx))
	again := spotByKey(t, m, "sidebar-1")
	assert.Equal(t, adModeAdsense, again.Mode, "the import runs once")
	assert.Equal(t, "Renommé", again.Label, "an existing spot is never overwritten by the seed")
	assert.Empty(t, again.AdsenseSlot, "a unit emptied from the screen stays empty")
}

func TestPrepareAdSpotsGivesEarlierSeedsTheirAdsenseUnitOnce(t *testing.T) {
	m, _ := adsTestModule(t)
	ctx := context.Background()
	require.NoError(t, m.db.Exec("DELETE FROM bo_setting WHERE key = ?", settingAdsDefaultSlots).Error)
	// Rows of a first release: three spots, no unit, one already given its own.
	require.NoError(t, m.db.Exec(
		`INSERT INTO ad_spot (key, label, format, placement, sort, adsense_slot) VALUES
		 ('sidebar-1', 'Colonne droite, position 1', '300x400', 'Colonne droite (ordinateur)', 1, ''),
		 ('sidebar-2', 'Colonne droite, position 2', '300x400', 'Colonne droite (ordinateur)', 2, '5555555555')`).Error)

	require.NoError(t, m.prepareAdSpots(ctx))
	assert.Equal(t, "4410076654", spotByKey(t, m, "sidebar-1").AdsenseSlot, "filled because it was empty")
	assert.Equal(t, "5555555555", spotByKey(t, m, "sidebar-2").AdsenseSlot, "a unit chosen by the team is kept")
	assert.Equal(t, "9470831648", spotByKey(t, m, "mobile-1").AdsenseSlot)
}

func TestLegacyAdsAreNotMirroredBeforeTheirImport(t *testing.T) {
	m, _ := adsTestModule(t)
	ctx := context.Background()
	insertLegacyAd(t, m.db, 1, "Business Event", "image", "https://i.postimg.cc/event.jpg", "https://www.mybusinessevent.com/")
	// The spots exist but the import did not run: a failed startup.
	for _, s := range seededAdSpots {
		require.NoError(t, m.db.Exec("INSERT INTO ad_spot (key, label, format, sort) VALUES (?, ?, ?, ?)", s.Key, s.Label, s.Format, s.Sort).Error)
	}
	m.adSpotsChanged(ctx)
	assert.Len(t, legacyAds(t, m.db), 1, "the banner the import has yet to read is still there")

	require.NoError(t, m.prepareAdSpots(ctx))
	m.adSpotsChanged(ctx)
	assert.Equal(t, adModeCustom, spotByKey(t, m, "sidebar-1").Mode)
	assert.Len(t, legacyAds(t, m.db), 1)
}

func TestSyncLegacyAdsFollowsModesAndWindows(t *testing.T) {
	m, mr := adsTestModule(t)
	ctx := context.Background()
	require.NoError(t, m.prepareAdSpots(ctx))
	sync := func(now time.Time) bool {
		spots, err := m.loadAdSpots(ctx)
		require.NoError(t, err)
		changed, err := m.syncLegacyAds(ctx, spots, now)
		require.NoError(t, err)
		return changed
	}
	assert.False(t, sync(adNow), "three spots on the ad network: nothing to write")
	assert.Empty(t, legacyAds(t, m.db))

	// A window on sidebar-2, a plain banner on sidebar-1.
	require.NoError(t, m.db.Exec(
		`UPDATE ad_spot SET mode = 'custom', title = 'Noël', media_url = 'https://media.test/noel.mp4', media_type = 'video',
		        redirect_link = 'https://partner.test/noel', starts_at = ?, ends_at = ? WHERE key = 'sidebar-2'`,
		adNow.Add(time.Hour), adNow.Add(2*time.Hour)).Error)
	require.NoError(t, m.db.Exec(
		`UPDATE ad_spot SET mode = 'custom', title = 'Une', media_url = 'https://media.test/une.png',
		        redirect_link = 'https://partner.test/' WHERE key = 'sidebar-1'`).Error)
	mr.Set(cache.CacheAds, "stale")

	assert.True(t, sync(adNow))
	assert.Equal(t, []legacyAdState{{1, "Une", "image", "https://media.test/une.png", "https://partner.test/"}}, legacyAds(t, m.db),
		"the scheduled banner is not on the site yet")
	assert.False(t, mr.Exists(cache.CacheAds), "the cache of GET /api/ads is dropped with the write")
	assert.False(t, sync(adNow), "in step: no second write")

	assert.True(t, sync(adNow.Add(90*time.Minute)), "the window opened")
	assert.Equal(t, []legacyAdState{
		{1, "Une", "image", "https://media.test/une.png", "https://partner.test/"},
		{2, "Noël", "video", "https://media.test/noel.mp4", "https://partner.test/noel"},
	}, legacyAds(t, m.db))

	assert.True(t, sync(adNow.Add(3*time.Hour)), "the window closed")
	assert.Len(t, legacyAds(t, m.db), 1)

	// The creative changes, a stray duplicate sits at the same position, and a
	// row outside the three positions belongs to nobody.
	insertLegacyAd(t, m.db, 1, "Doublon", "image", "https://media.test/dup.png", "https://partner.test/")
	insertLegacyAd(t, m.db, 9, "Ailleurs", "image", "https://media.test/else.png", "https://partner.test/")
	require.NoError(t, m.db.Exec("UPDATE ad_spot SET title = 'Une bis' WHERE key = 'sidebar-1'").Error)
	assert.True(t, sync(adNow))
	assert.Equal(t, []legacyAdState{
		{1, "Une bis", "image", "https://media.test/une.png", "https://partner.test/"},
		{9, "Ailleurs", "image", "https://media.test/else.png", "https://partner.test/"},
	}, legacyAds(t, m.db))

	require.NoError(t, m.db.Exec("UPDATE ad_spot SET mode = 'off' WHERE key = 'sidebar-1'").Error)
	assert.True(t, sync(adNow))
	assert.Equal(t, []legacyAdState{{9, "Ailleurs", "image", "https://media.test/else.png", "https://partner.test/"}}, legacyAds(t, m.db))
}

func TestSyncLegacyAdsInsertsDespiteASequenceLeftBehind(t *testing.T) {
	m, _ := adsTestModule(t)
	ctx := context.Background()
	require.NoError(t, m.prepareAdSpots(ctx))
	// As after the SQL migrations: rows carry their own id, the sequence still starts at 1.
	require.NoError(t, m.db.Exec(
		`INSERT INTO ads (id, title, position, type, url, redirect_link) VALUES
		 (1, 'Ailleurs', 9, 'image', 'https://media.test/a.png', 'https://partner.test/'),
		 (2, 'Encore', 8, 'image', 'https://media.test/b.png', 'https://partner.test/')`).Error)
	require.NoError(t, m.db.Exec(
		`UPDATE ad_spot SET mode = 'custom', title = 'Une', media_url = 'https://media.test/une.png', redirect_link = 'https://partner.test/'
		 WHERE key IN ('sidebar-1', 'sidebar-2')`).Error)

	require.NoError(t, m.syncLegacyAdsNow(ctx))
	var ids []int64
	require.NoError(t, m.db.Raw("SELECT id FROM ads ORDER BY id").Scan(&ids).Error)
	assert.Equal(t, []int64{1, 2, 3, 4}, ids)
}

func TestAdSpotEndpointsDriveTheSiteAndTheLegacyTable(t *testing.T) {
	m, mr := adsTestModule(t)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	e := boTestServer(m, RoleAdmin)

	public := func() (map[string]publicAdSpot, http.Header) {
		rec := call(e, http.MethodGet, "/api/ad-spots", nil)
		require.Equal(t, http.StatusOK, rec.Code)
		var body publicAdSpots
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		return body.Spots, rec.Header()
	}

	spots, header := public()
	require.Len(t, spots, 5)
	seededSlot := "4410076654"
	assert.Equal(t, publicAdSpot{Mode: adModeAdsense, Format: "300x400", AdsenseSlot: &seededSlot}, spots["sidebar-1"])
	assert.Equal(t, "public, max-age=30, stale-while-revalidate=30", header.Get("Cache-Control"))
	assert.InDelta(t, time.Hour.Seconds(), mr.TTL(cache.CacheAdSpots).Seconds(), 2, "one hour in Redis without any date")

	rec := call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{
		"mode": "custom", "title": "Partenaire", "media_url": "https://media.test/ads/images/p.png",
		"media_type": "image", "redirect_link": "https://partner.test/offre",
	})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var saved adSpotView
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &saved))
	assert.Equal(t, adModeCustom, saved.EffectiveMode)
	assert.Equal(t, "Camille Test", saved.UpdatedBy)
	assert.True(t, saved.Builtin)

	spots, _ = public()
	assert.Equal(t, adModeCustom, spots["sidebar-1"].Mode, "the cached answer is replaced by the write")
	require.NotNil(t, spots["sidebar-1"].Creative)
	assert.Equal(t, publicAdCreative{
		MediaURL: "https://media.test/ads/images/p.png", MediaType: "image", RedirectLink: "https://partner.test/offre", Title: "Partenaire",
	}, *spots["sidebar-1"].Creative)
	assert.Equal(t, []legacyAdState{{1, "Partenaire", "image", "https://media.test/ads/images/p.png", "https://partner.test/offre"}}, legacyAds(t, m.db))

	// A window that opens in ten minutes: back on the network until then, and
	// nobody may keep that answer longer.
	starts := time.Now().Add(10 * time.Minute)
	rec = call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{
		"starts_at": starts.Format(time.RFC3339Nano), "ends_at": starts.Add(time.Hour).Format(time.RFC3339Nano), "adsense_slot": "1234567890",
	})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &saved))
	assert.Equal(t, adModeCustom, saved.Mode)
	assert.Equal(t, adModeAdsense, saved.EffectiveMode)

	spots, _ = public()
	slot := "1234567890"
	assert.Equal(t, publicAdSpot{Mode: adModeAdsense, Format: "300x400", AdsenseSlot: &slot}, spots["sidebar-1"])
	assert.Empty(t, legacyAds(t, m.db), "nothing on the legacy site before the window")
	ttl := mr.TTL(cache.CacheAdSpots)
	assert.Greater(t, ttl, 9*time.Minute)
	assert.LessOrEqual(t, ttl, 10*time.Minute, "Redis drops the answer when the window opens")

	rec = call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{"mode": "adsense", "starts_at": nil, "ends_at": nil})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	spots, _ = public()
	assert.Equal(t, adModeAdsense, spots["sidebar-1"].Mode)
	assert.Nil(t, spots["sidebar-1"].Creative)
	assert.Equal(t, "https://media.test/ads/images/p.png", spotByKey(t, m, "sidebar-1").MediaURL, "the banner is kept for a switch back")

	rec = call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{"mode": "adsense"})
	require.Equal(t, http.StatusOK, rec.Code)

	assert.Equal(t, []string{
		"régie → bannière perso, visuel, titre, lien",
		"dates, bloc AdSense",
		"bannière perso → régie, dates",
	}, auditDetails(t, m.db, "sidebar-1"), "one entry per real change, none for the last no-op")
}

func TestPublicAdSpotsIsOpenAndAnswersTheFiveSpots(t *testing.T) {
	m, _ := adsTestModule(t)
	insertLegacyAd(t, m.db, 1, "Business Event", "image", "https://i.postimg.cc/event.jpg", "https://www.mybusinessevent.com/")
	require.NoError(t, m.prepareAdSpots(context.Background()))

	// The routes as Register mounts them: the public one on /api, the others
	// behind a session nobody has here.
	e := echo.New()
	api := e.Group("/api")
	m.registerAdRoutes(api, api.Group("/bo", m.requireSession))

	rec := call(e, http.MethodGet, "/api/ad-spots", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"spots": {
		"sidebar-1": {"mode": "custom", "format": "300x400", "adsense_slot": "4410076654", "creative": {
			"media_url": "https://i.postimg.cc/event.jpg", "media_type": "image",
			"redirect_link": "https://www.mybusinessevent.com/", "title": "Business Event"}},
		"sidebar-2": {"mode": "adsense", "format": "300x400", "adsense_slot": "2003405164", "creative": null},
		"sidebar-3": {"mode": "adsense", "format": "300x400", "adsense_slot": "1783913314", "creative": null},
		"article-bottom": {"mode": "adsense", "format": "728x90", "adsense_slot": "9690323498", "creative": null},
		"mobile-1": {"mode": "adsense", "format": "320x100", "adsense_slot": "9470831648", "creative": null}
	}}`, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, call(e, http.MethodGet, "/api/bo/ads/spots", nil).Code)
	assert.Equal(t, http.StatusUnauthorized, call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{"mode": "off"}).Code)
}

func TestPublicAdSpotsNearABoundaryShortensTheBrowserCache(t *testing.T) {
	m, mr := adsTestModule(t)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	e := boTestServer(m, RoleAdmin)
	require.NoError(t, m.db.Exec(
		`UPDATE ad_spot SET mode = 'custom', media_url = 'https://media.test/a.png', redirect_link = 'https://partner.test/', ends_at = ?
		 WHERE key = 'sidebar-3'`, time.Now().Add(10*time.Second)).Error)

	rec := call(e, http.MethodGet, "/api/ad-spots", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	var maxAge, swr int
	_, err := fmt.Sscanf(rec.Header().Get("Cache-Control"), "public, max-age=%d, stale-while-revalidate=%d", &maxAge, &swr)
	require.NoError(t, err, rec.Header().Get("Cache-Control"))
	assert.LessOrEqual(t, maxAge, 10)
	assert.GreaterOrEqual(t, maxAge, 8)
	assert.LessOrEqual(t, mr.TTL(cache.CacheAdSpots), 10*time.Second)

	// A reader that loaded the spots earlier must not put its answer back over
	// the one already stored.
	stale := []adSpot{{Key: "sidebar-3", Format: "300x400", Mode: adModeOff}}
	m.cacheAdSpots(context.Background(), stale, time.Now(), false)
	rec = call(e, http.MethodGet, "/api/ad-spots", nil)
	var body publicAdSpots
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, adModeCustom, body.Spots["sidebar-3"].Mode)
}

func TestAdSpotUpdateRefusals(t *testing.T) {
	m, _ := adsTestModule(t)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	e := boTestServer(m, RoleAdmin)

	refused := []struct {
		name string
		body map[string]interface{}
	}{
		{"custom without a banner", map[string]interface{}{"mode": "custom"}},
		{"custom without a link", map[string]interface{}{"mode": "custom", "media_url": "https://media.test/a.png"}},
		{"http link", map[string]interface{}{"mode": "custom", "media_url": "https://media.test/a.png", "redirect_link": "http://partner.test/"}},
		{"end before start", map[string]interface{}{"starts_at": "2026-12-02T00:00:00Z", "ends_at": "2026-12-01T00:00:00Z"}},
		{"unknown mode", map[string]interface{}{"mode": "network"}},
		{"unreadable date", map[string]interface{}{"starts_at": "demain"}},
	}
	for _, tc := range refused {
		t.Run(tc.name, func(t *testing.T) {
			rec := call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-2", tc.body)
			assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
		})
	}
	assert.Equal(t, adModeAdsense, spotByKey(t, m, "sidebar-2").Mode)
	assert.Empty(t, auditDetails(t, m.db, "sidebar-2"))

	assert.Equal(t, http.StatusNotFound, call(e, http.MethodPut, "/api/bo/ads/spots/nowhere", map[string]interface{}{"mode": "off"}).Code)
}

func TestAdSpotCreateAndDelete(t *testing.T) {
	m, _ := adsTestModule(t)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	e := boTestServer(m, RoleAdmin)
	valid := map[string]interface{}{"key": "article-top", "label": "Haut d'article", "format": "728x90", "placement": "Sous le titre d'un article"}

	for name, breakIt := range map[string]func(b map[string]interface{}){
		"key with a capital": func(b map[string]interface{}) { b["key"] = "Article-Top" },
		"key too short":      func(b map[string]interface{}) { b["key"] = "a" },
		"format":             func(b map[string]interface{}) { b["format"] = "728 x 90" },
		"no label":           func(b map[string]interface{}) { b["label"] = "  " },
		"no placement":       func(b map[string]interface{}) { b["placement"] = "" },
	} {
		t.Run(name, func(t *testing.T) {
			body := map[string]interface{}{}
			for k, v := range valid {
				body[k] = v
			}
			breakIt(body)
			assert.Equal(t, http.StatusBadRequest, call(e, http.MethodPost, "/api/bo/ads/spots", body).Code)
		})
	}

	rec := call(e, http.MethodPost, "/api/bo/ads/spots", valid)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created adSpotView
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	assert.Equal(t, adModeAdsense, created.Mode)
	assert.Equal(t, 6, created.Sort)
	assert.False(t, created.Builtin)
	assert.Equal(t, http.StatusConflict, call(e, http.MethodPost, "/api/bo/ads/spots", valid).Code)

	var public publicAdSpots
	require.NoError(t, json.Unmarshal(call(e, http.MethodGet, "/api/ad-spots", nil).Body.Bytes(), &public))
	assert.Equal(t, publicAdSpot{Mode: adModeAdsense, Format: "728x90"}, public.Spots["article-top"])

	var list struct {
		Spots []adSpotView `json:"spots"`
	}
	require.NoError(t, json.Unmarshal(call(e, http.MethodGet, "/api/bo/ads/spots", nil).Body.Bytes(), &list))
	require.Len(t, list.Spots, 6)
	assert.Equal(t, "article-top", list.Spots[5].Key)

	for _, s := range seededAdSpots {
		assert.Equal(t, http.StatusConflict, call(e, http.MethodDelete, "/api/bo/ads/spots/"+s.Key, nil).Code, "a spot of the site can't go: %s", s.Key)
	}
	assert.Equal(t, http.StatusNoContent, call(e, http.MethodDelete, "/api/bo/ads/spots/article-top", nil).Code)
	assert.Equal(t, http.StatusNotFound, call(e, http.MethodDelete, "/api/bo/ads/spots/article-top", nil).Code)
	var afterDelete publicAdSpots
	require.NoError(t, json.Unmarshal(call(e, http.MethodGet, "/api/ad-spots", nil).Body.Bytes(), &afterDelete))
	assert.NotContains(t, afterDelete.Spots, "article-top")
	assert.Len(t, afterDelete.Spots, 5)
	assert.Equal(t, []string{"emplacement créé (728x90)", "emplacement supprimé"}, auditDetails(t, m.db, "article-top"))
}

func TestAdEndpointsAreForAdmins(t *testing.T) {
	m, _ := adsTestModule(t)
	require.NoError(t, m.prepareAdSpots(context.Background()))
	for _, role := range []Role{RoleEditor, RoleReader} {
		e := boTestServer(m, role)
		assert.Equal(t, http.StatusForbidden, call(e, http.MethodGet, "/api/bo/ads/spots", nil).Code)
		assert.Equal(t, http.StatusForbidden, call(e, http.MethodPut, "/api/bo/ads/spots/sidebar-1", map[string]interface{}{"mode": "off"}).Code)
		assert.Equal(t, http.StatusForbidden, call(e, http.MethodPost, "/api/bo/ads/spots", map[string]interface{}{}).Code)
		assert.Equal(t, http.StatusForbidden, call(e, http.MethodDelete, "/api/bo/ads/spots/sidebar-1", nil).Code)
		assert.Equal(t, http.StatusForbidden, call(e, http.MethodPost, "/api/bo/upload/ad", nil).Code)
		assert.Equal(t, http.StatusOK, call(e, http.MethodGet, "/api/ad-spots", nil).Code, "the site reads without a session")
	}
	assert.Equal(t, adModeAdsense, spotByKey(t, m, "sidebar-1").Mode)
}
