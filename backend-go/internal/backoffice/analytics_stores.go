package backoffice

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/golang-jwt/jwt/v5"
)

func init() {
	schemaStatements = append(schemaStatements,
		`CREATE TABLE IF NOT EXISTS bo_store_downloads (
			store text NOT NULL,
			day date NOT NULL,
			downloads integer NOT NULL,
			fetched_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (store, day)
		)`,
	)
}

const (
	storeApple  = "app_store"
	storeGoogle = "google_play"
	// How far back the stores are read: the longest period the screen offers,
	// twice (current + previous).
	storeHistoryDays = 180
)

type storeDownloads struct {
	Key        string     `json:"key"`
	Name       string     `json:"name"`
	Configured bool       `json:"configured"`
	Missing    []string   `json:"missing,omitempty"`
	Total      float64    `json:"total"`
	Prev       float64    `json:"prev"`
	Series     []dayPoint `json:"series"`
	// Through is the last day the store has published: later days are not zero, they are unknown.
	Through string `json:"through,omitempty"`
}

type appAnalytics struct {
	Days    int              `json:"days"`
	Start   string           `json:"start"`
	End     string           `json:"end"`
	Stores  []storeDownloads `json:"stores"`
	Devices struct {
		IOS     int64 `json:"ios"`
		Android int64 `json:"android"`
	} `json:"devices"`
	Signups struct {
		Total   int64 `json:"total"`
		Prev    int64 `json:"prev"`
		IOS     int64 `json:"ios"`
		Android int64 `json:"android"`
		Web     int64 `json:"web"`
		Unknown int64 `json:"unknown"`
	} `json:"signups"`
	Premium struct {
		AppStore   int64 `json:"app_store"`
		GooglePlay int64 `json:"google_play"`
		Stripe     int64 `json:"stripe"`
		Gift       int64 `json:"gift"`
	} `json:"premium"`
	Follows struct {
		Matches     int64 `json:"matches"`
		Tournaments int64 `json:"tournaments"`
	} `json:"follows"`
}

func (m *Module) appStoreMissing() []string {
	return missingEnv(
		"APPSTORE_CONNECT_KEY_ID", m.cfg.AppStoreKeyID,
		"APPSTORE_CONNECT_ISSUER_ID", m.cfg.AppStoreIssuerID,
		"APPSTORE_CONNECT_KEY_CONTENT", m.cfg.AppStoreKeyContent,
		"APPSTORE_CONNECT_VENDOR_ID", m.cfg.AppStoreVendorID,
	)
}

func (m *Module) playMissing() []string {
	return missingEnv("PLAY_REPORTS_BUCKET", m.cfg.PlayReportsBucket, "PLAY_REPORTS_CREDENTIALS_JSON", m.cfg.PlayCredentialsJSON)
}

func (m *Module) appAnalytics(ctx context.Context, p period) (*appAnalytics, error) {
	out := &appAnalytics{Days: p.Days, Start: p.Start.Format(isoDay), End: p.End.Format(isoDay)}
	db := m.db.WithContext(ctx)

	for _, s := range []struct {
		key, name string
		missing   []string
	}{
		{storeApple, "App Store", m.appStoreMissing()},
		{storeGoogle, "Google Play", m.playMissing()},
	} {
		store := storeDownloads{Key: s.key, Name: s.name, Missing: s.missing, Configured: len(s.missing) == 0, Series: []dayPoint{}}
		if store.Configured {
			var rows []struct {
				Day       time.Time
				Downloads float64
			}
			if err := db.Raw("SELECT day, downloads FROM bo_store_downloads WHERE store = ? AND day >= ? AND day <= ? ORDER BY day",
				s.key, p.PrevStart, p.End).Scan(&rows).Error; err != nil {
				return nil, err
			}
			values := map[string][2]float64{}
			for _, r := range rows {
				key := r.Day.Format(isoDay)
				values[key] = [2]float64{r.Downloads}
				if r.Day.Before(p.Start) {
					store.Prev += r.Downloads
				} else {
					store.Total += r.Downloads
				}
				store.Through = key
			}
			store.Series = fillDays(p.Start, p.End, values)
		}
		out.Stores = append(out.Stores, store)
	}

	if err := db.Raw(`SELECT count(*) FILTER (WHERE platform = 'ios') AS ios, count(*) FILTER (WHERE platform = 'android') AS android
		FROM push_token WHERE active = true`).Scan(&out.Devices).Error; err != nil {
		return nil, err
	}
	// The stores lag a day, the accounts don't: sign-ups run up to now.
	if err := db.Raw(`SELECT
			count(*) FILTER (WHERE created_at >= ?) AS total,
			count(*) FILTER (WHERE created_at < ?) AS prev,
			count(*) FILTER (WHERE created_at >= ? AND signup_source = 'ios') AS ios,
			count(*) FILTER (WHERE created_at >= ? AND signup_source = 'android') AS android,
			count(*) FILTER (WHERE created_at >= ? AND signup_source = 'web') AS web,
			count(*) FILTER (WHERE created_at >= ? AND signup_source IS NULL) AS unknown
		FROM users WHERE created_at >= ?`,
		p.Start, p.Start, p.Start, p.Start, p.Start, p.Start, p.PrevStart).Scan(&out.Signups).Error; err != nil {
		return nil, err
	}
	if err := db.Raw(`SELECT
			count(*) FILTER (WHERE premium AND NOT premium_gifted AND iap_platform = 'ios') AS app_store,
			count(*) FILTER (WHERE premium AND NOT premium_gifted AND iap_platform = 'android') AS google_play,
			count(*) FILTER (WHERE premium AND NOT premium_gifted AND iap_platform IS NULL AND stripe_subscription_id IS NOT NULL) AS stripe,
			count(*) FILTER (WHERE premium_gifted) AS gift
		FROM users`).Scan(&out.Premium).Error; err != nil {
		return nil, err
	}
	db.Raw("SELECT count(*) FROM match_subscription WHERE status IN ('upcoming', 'running')").Scan(&out.Follows.Matches)
	db.Raw("SELECT count(*) FROM tournament_subscription WHERE status IN ('upcoming', 'running')").Scan(&out.Follows.Tournaments)
	return out, nil
}

func (m *Module) saveDownloads(ctx context.Context, store string, byDay map[string]int) {
	for dayKey, n := range byDay {
		if err := m.db.WithContext(ctx).Exec(
			`INSERT INTO bo_store_downloads (store, day, downloads, fetched_at) VALUES (?, ?, ?, now())
			 ON CONFLICT (store, day) DO UPDATE SET downloads = EXCLUDED.downloads, fetched_at = now()`,
			store, dayKey, n).Error; err != nil {
			m.log.WithError(err).Warn("[BO] store downloads not saved")
			return
		}
	}
}

// syncStores brings bo_store_downloads up to date. It runs in the background:
// a screen never waits on Apple or Google.
func (m *Module) syncStores(ctx context.Context) {
	if len(m.appStoreMissing()) == 0 {
		if err := m.syncAppStore(ctx); err != nil {
			m.log.WithError(err).Warn("[BO] App Store downloads not refreshed")
		}
	}
	if len(m.playMissing()) == 0 {
		if err := m.syncPlay(ctx); err != nil {
			m.log.WithError(err).Warn("[BO] Google Play installs not refreshed")
		}
	}
}

// ---- App Store Connect ----

func (m *Module) appStoreToken() (string, error) {
	pem := strings.ReplaceAll(m.cfg.AppStoreKeyContent, `\n`, "\n")
	key, err := jwt.ParseECPrivateKeyFromPEM([]byte(pem))
	if err != nil {
		return "", fmt.Errorf("app store connect key: %w", err)
	}
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"iss": m.cfg.AppStoreIssuerID,
		"iat": now.Unix(),
		"exp": now.Add(10 * time.Minute).Unix(),
		"aud": "appstoreconnect-v1",
	})
	token.Header["kid"] = m.cfg.AppStoreKeyID
	return token.SignedString(key)
}

var errReportNotReady = errors.New("report not available yet")

// First-time downloads in the summary sales report: iPhone, universal, iPad
// and Mac-compatible apps. Re-downloads (3*) and updates (7*) are not counted.
var firstDownloadTypes = map[string]bool{"1": true, "1F": true, "1T": true, "F1": true}

// appStoreDay returns the first-time downloads of one day.
func (m *Module) appStoreDay(ctx context.Context, token string, d time.Time) (int, error) {
	q := url.Values{}
	q.Set("filter[frequency]", "DAILY")
	q.Set("filter[reportType]", "SALES")
	q.Set("filter[reportSubType]", "SUMMARY")
	q.Set("filter[version]", "1_0")
	q.Set("filter[vendorNumber]", m.cfg.AppStoreVendorID)
	q.Set("filter[reportDate]", d.Format(isoDay))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, analyticsEndpoints.AppStore+"/v1/salesReports?"+q.Encode(), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/a-gzip")
	res, err := m.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 32<<20))
	if err != nil {
		return 0, err
	}
	if res.StatusCode == http.StatusNotFound {
		// Apple answers 404 both for a day without any sale and for a report
		// it hasn't generated yet; only the first one is a real zero.
		if strings.Contains(strings.ToLower(string(raw)), "no sales") {
			return 0, nil
		}
		return 0, errReportNotReady
	}
	if res.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("app store connect: HTTP %d: %.300s", res.StatusCode, raw)
	}
	return parseSalesReport(raw, m.cfg.AppStoreAppSKU)
}

func parseSalesReport(gz []byte, sku string) (int, error) {
	zr, err := gzip.NewReader(bytes.NewReader(gz))
	if err != nil {
		return 0, err
	}
	defer zr.Close()
	r := csv.NewReader(zr)
	r.Comma = '\t'
	r.LazyQuotes = true
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		return 0, err
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.TrimSpace(h)] = i
	}
	typeCol, okType := col["Product Type Identifier"]
	unitsCol, okUnits := col["Units"]
	skuCol, okSKU := col["SKU"]
	if !okType || !okUnits {
		return 0, errors.New("sales report: unexpected columns")
	}
	total := 0
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		if len(rec) <= typeCol || len(rec) <= unitsCol || !firstDownloadTypes[strings.TrimSpace(rec[typeCol])] {
			continue
		}
		if sku != "" && okSKU && len(rec) > skuCol && strings.TrimSpace(rec[skuCol]) != sku {
			continue
		}
		units, _ := strconv.ParseFloat(strings.TrimSpace(rec[unitsCol]), 64)
		total += int(units)
	}
	return total, nil
}

func (m *Module) syncAppStore(ctx context.Context) error {
	token, err := m.appStoreToken()
	if err != nil {
		return err
	}
	var have []time.Time
	if err := m.db.WithContext(ctx).Raw("SELECT day FROM bo_store_downloads WHERE store = ?", storeApple).Scan(&have).Error; err != nil {
		return err
	}
	known := map[string]bool{}
	for _, d := range have {
		known[d.Format(isoDay)] = true
	}
	// Newest first, so a first run shows the current period before the history.
	// One day costs one call: a run fetches at most 45 of them.
	calls := 0
	for d := day(time.Now()).AddDate(0, 0, -1); calls < 45 && d.After(day(time.Now()).AddDate(0, 0, -storeHistoryDays)); d = d.AddDate(0, 0, -1) {
		if known[d.Format(isoDay)] {
			continue
		}
		calls++
		n, err := m.appStoreDay(ctx, token, d)
		if errors.Is(err, errReportNotReady) {
			continue
		}
		if err != nil {
			return err
		}
		m.saveDownloads(ctx, storeApple, map[string]int{d.Format(isoDay): n})
	}
	return nil
}

// ---- Google Play ----

func decodeUTF16(raw []byte) string {
	if len(raw) < 2 {
		return string(raw)
	}
	var order binary.ByteOrder
	switch {
	case raw[0] == 0xFF && raw[1] == 0xFE:
		order, raw = binary.LittleEndian, raw[2:]
	case raw[0] == 0xFE && raw[1] == 0xFF:
		order, raw = binary.BigEndian, raw[2:]
	default:
		// No byte-order mark: the file is already UTF-8.
		return string(raw)
	}
	units := make([]uint16, 0, len(raw)/2)
	for i := 0; i+1 < len(raw); i += 2 {
		units = append(units, order.Uint16(raw[i:]))
	}
	return string(utf16.Decode(units))
}

// parsePlayInstalls reads a monthly installs report: one row per day (overview)
// or per day and dimension (summed).
func parsePlayInstalls(raw []byte, pkg string) (map[string]int, error) {
	r := csv.NewReader(strings.NewReader(decodeUTF16(raw)))
	r.LazyQuotes = true
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		return nil, err
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.TrimSpace(h)] = i
	}
	dateCol, okDate := col["Date"]
	installsCol, okInstalls := col["Daily User Installs"]
	pkgCol, okPkg := col["Package Name"]
	if !okDate || !okInstalls {
		return nil, errors.New("play installs report: unexpected columns")
	}
	out := map[string]int{}
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(rec) <= dateCol || len(rec) <= installsCol {
			continue
		}
		if pkg != "" && okPkg && len(rec) > pkgCol && strings.TrimSpace(rec[pkgCol]) != pkg {
			continue
		}
		n, _ := strconv.Atoi(strings.TrimSpace(rec[installsCol]))
		out[strings.TrimSpace(rec[dateCol])] += n
	}
	return out, nil
}

var errNoSuchReport = errors.New("report file not found")

func (m *Module) playReport(ctx context.Context, object string) ([]byte, error) {
	token, err := googleToken(ctx, m.cfg.PlayCredentialsJSON, scopeStorageRead)
	if err != nil {
		return nil, err
	}
	bucket := strings.Trim(strings.TrimPrefix(m.cfg.PlayReportsBucket, "gs://"), "/")
	endpoint := fmt.Sprintf("%s/b/%s/o/%s?alt=media", analyticsEndpoints.GCS, url.PathEscape(bucket), url.PathEscape(object))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := m.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode == http.StatusNotFound {
		return nil, errNoSuchReport
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("play reports: HTTP %d: %.300s", res.StatusCode, raw)
	}
	return raw, nil
}

func (m *Module) syncPlay(ctx context.Context) error {
	now := time.Now().UTC()
	first := now.AddDate(0, 0, -storeHistoryDays)
	for month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC); !month.Before(time.Date(first.Year(), first.Month(), 1, 0, 0, 0, 0, time.UTC)); month = month.AddDate(0, -1, 0) {
		base := fmt.Sprintf("stats/installs/installs_%s_%s", m.cfg.PlayPackage, month.Format("200601"))
		// The overview file has one row per day; the per-country file sums to the same.
		raw, err := m.playReport(ctx, base+"_overview.csv")
		if errors.Is(err, errNoSuchReport) {
			raw, err = m.playReport(ctx, base+"_country.csv")
		}
		if errors.Is(err, errNoSuchReport) {
			continue
		}
		if err != nil {
			return err
		}
		byDay, err := parsePlayInstalls(raw, m.cfg.PlayPackage)
		if err != nil {
			return err
		}
		m.saveDownloads(ctx, storeGoogle, byDay)
	}
	return nil
}

func (m *Module) startAnalyticsJobs(ctx context.Context) {
	go func() {
		// Leave the boot alone: these calls can wait a minute.
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Minute):
		}
		stores := time.NewTicker(6 * time.Hour)
		index := time.NewTicker(24 * time.Hour)
		defer stores.Stop()
		defer index.Stop()
		m.recordDailyMetrics(ctx)
		m.syncStores(ctx)
		m.inspectRecentArticles(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-stores.C:
				m.recordDailyMetrics(ctx)
				m.syncStores(ctx)
			case <-index.C:
				m.inspectRecentArticles(ctx)
			}
		}
	}()
}
