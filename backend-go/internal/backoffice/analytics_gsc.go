package backoffice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Google publishes Search Console figures two to three days late: a period
// ending today would end on days that are still empty.
const gscLagDays = 3

const (
	scopeSearchConsole = "https://www.googleapis.com/auth/webmasters.readonly"
	scopeStorageRead   = "https://www.googleapis.com/auth/devstorage.read_only"
)

func init() {
	schemaStatements = append(schemaStatements,
		`CREATE TABLE IF NOT EXISTS bo_gsc_inspection (
			url text PRIMARY KEY,
			article_id bigint,
			checked_at timestamptz NOT NULL DEFAULT now(),
			indexed boolean NOT NULL,
			coverage_state text NOT NULL DEFAULT '',
			not_indexed_since timestamptz
		)`,
	)
}

var (
	googleTokenSources sync.Map // scope|hash(json) → oauth2.TokenSource
	// googleTokenOverride lets tests skip Google's token endpoint.
	googleTokenOverride func(scope string) (string, error)
)

// googleToken exchanges a service-account key for an access token, reusing it
// until it expires.
func googleToken(ctx context.Context, credentialsJSON, scope string) (string, error) {
	if googleTokenOverride != nil {
		return googleTokenOverride(scope)
	}
	key := scope + "|" + hashToken(credentialsJSON)
	src, ok := googleTokenSources.Load(key)
	if !ok {
		cfg, err := google.JWTConfigFromJSON([]byte(credentialsJSON), scope)
		if err != nil {
			return "", fmt.Errorf("service account key: %w", err)
		}
		// The source outlives the request that created it.
		src, _ = googleTokenSources.LoadOrStore(key, oauth2.ReuseTokenSource(nil, cfg.TokenSource(context.Background())))
	}
	tok, err := src.(oauth2.TokenSource).Token()
	if err != nil {
		return "", err
	}
	return tok.AccessToken, nil
}

// gscSite puts a property id in a URL path. Google wants it fully encoded:
// url.PathEscape would leave the colon of « sc-domain:example.com » as is.
func gscSite(siteURL string) string {
	return strings.ReplaceAll(url.QueryEscape(siteURL), "+", "%20")
}

func (m *Module) gscMissing() []string {
	return missingEnv("GSC_SITE_URL", m.cfg.GSCSiteURL, "GSC_CREDENTIALS_JSON", m.cfg.GSCCredentialsJSON)
}

func (m *Module) googleJSON(ctx context.Context, credentials, scope, method, endpoint string, body, out interface{}) error {
	token, err := googleToken(ctx, credentials, scope)
	if err != nil {
		return err
	}
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 16<<20))
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("google %s: HTTP %d: %.300s", endpoint, res.StatusCode, raw)
	}
	return json.Unmarshal(raw, out)
}

type gscRow struct {
	Key         string  `json:"key,omitempty"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
	CTR         float64 `json:"ctr"`
	Position    float64 `json:"position"`
}

type gscFilter struct {
	Dimension  string `json:"dimension"`
	Operator   string `json:"operator"`
	Expression string `json:"expression"`
}

type gscRequest struct {
	StartDate  string   `json:"startDate"`
	EndDate    string   `json:"endDate"`
	Dimensions []string `json:"dimensions,omitempty"`
	RowLimit   int      `json:"rowLimit,omitempty"`
	DataState  string   `json:"dataState,omitempty"`
	Filters    []struct {
		Filters []gscFilter `json:"filters"`
	} `json:"dimensionFilterGroups,omitempty"`
}

func (m *Module) gscQuery(ctx context.Context, start, end time.Time, dimension string, limit int, filter *gscFilter) ([]gscRow, error) {
	req := gscRequest{StartDate: start.Format(isoDay), EndDate: end.Format(isoDay), RowLimit: limit, DataState: "final"}
	if dimension != "" {
		req.Dimensions = []string{dimension}
	}
	if filter != nil {
		req.Filters = []struct {
			Filters []gscFilter `json:"filters"`
		}{{Filters: []gscFilter{*filter}}}
	}
	var res struct {
		Rows []struct {
			Keys        []string `json:"keys"`
			Clicks      float64  `json:"clicks"`
			Impressions float64  `json:"impressions"`
			CTR         float64  `json:"ctr"`
			Position    float64  `json:"position"`
		} `json:"rows"`
	}
	endpoint := analyticsEndpoints.GSC + "/sites/" + gscSite(m.cfg.GSCSiteURL) + "/searchAnalytics/query"
	if err := m.googleJSON(ctx, m.cfg.GSCCredentialsJSON, scopeSearchConsole, http.MethodPost, endpoint, req, &res); err != nil {
		return nil, err
	}
	rows := make([]gscRow, 0, len(res.Rows))
	for _, r := range res.Rows {
		row := gscRow{Clicks: r.Clicks, Impressions: r.Impressions, CTR: r.CTR, Position: r.Position}
		if len(r.Keys) > 0 {
			row.Key = r.Keys[0]
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func (m *Module) gscTotals(ctx context.Context, start, end time.Time, filter *gscFilter) (gscRow, error) {
	rows, err := m.gscQuery(ctx, start, end, "", 1, filter)
	if err != nil || len(rows) == 0 {
		return gscRow{}, err
	}
	return rows[0], nil
}

type gscOverview struct {
	Configured bool       `json:"configured"`
	Days       int        `json:"days"`
	Start      string     `json:"start"`
	End        string     `json:"end"`
	Totals     gscRow     `json:"totals"`
	Prev       gscRow     `json:"prev"`
	Series     []dayPoint `json:"series"` // value = clicks, other = impressions
	Queries    []gscRow   `json:"queries"`
	Pages      []gscRow   `json:"pages"`
}

func (m *Module) gscOverview(ctx context.Context, p period) (*gscOverview, error) {
	out := &gscOverview{Days: p.Days, Start: p.Start.Format(isoDay), End: p.End.Format(isoDay)}
	var err error
	if out.Totals, err = m.gscTotals(ctx, p.Start, p.End, nil); err != nil {
		return nil, err
	}
	if out.Prev, err = m.gscTotals(ctx, p.PrevStart, p.PrevEnd, nil); err != nil {
		return nil, err
	}
	byDate, err := m.gscQuery(ctx, p.Start, p.End, "date", 500, nil)
	if err != nil {
		return nil, err
	}
	values := map[string][2]float64{}
	for _, r := range byDate {
		values[r.Key] = [2]float64{r.Clicks, r.Impressions}
	}
	out.Series = fillDays(p.Start, p.End, values)
	if out.Queries, err = m.gscQuery(ctx, p.Start, p.End, "query", 10, nil); err != nil {
		return nil, err
	}
	if out.Pages, err = m.gscQuery(ctx, p.Start, p.End, "page", 10, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// articleSlugOf reads the slug out of an article URL: /article/<slug>[/<DD-MM-YYYY>].
func articleSlugOf(pageURL string) string {
	u, err := url.Parse(pageURL)
	if err != nil {
		return ""
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) < 2 || parts[0] != "article" {
		return ""
	}
	return parts[1]
}

// gscArticlePages is the 28-day figures of every article page, by slug. One
// call covers the whole article list; an article reachable under two URLs
// (dated and bare) has its clicks added up.
func (m *Module) gscArticlePages(ctx context.Context) (map[string]gscRow, error) {
	p := periodEnding(time.Now().AddDate(0, 0, -gscLagDays), 28)
	out := map[string]gscRow{}
	err := m.cached(ctx, "bo:gsc:articles:"+p.End.Format(isoDay), time.Hour, &out, func() error {
		rows, err := m.gscQuery(ctx, p.Start, p.End, "page", 25000, &gscFilter{Dimension: "page", Operator: "contains", Expression: "/article/"})
		if err != nil {
			return err
		}
		weighted := map[string]float64{}
		for _, r := range rows {
			slug := articleSlugOf(r.Key)
			if slug == "" {
				continue
			}
			agg := out[slug]
			agg.Clicks += r.Clicks
			agg.Impressions += r.Impressions
			weighted[slug] += r.Position * r.Impressions
			out[slug] = agg
		}
		for slug, agg := range out {
			if agg.Impressions > 0 {
				agg.Position = weighted[slug] / agg.Impressions
				agg.CTR = agg.Clicks / agg.Impressions
			}
			out[slug] = agg
		}
		return nil
	})
	return out, err
}

type gscArticle struct {
	Configured  bool    `json:"configured"`
	Clicks      float64 `json:"clicks"`
	Impressions float64 `json:"impressions"`
	Position    float64 `json:"position"`
	Queries     []struct {
		Query  string  `json:"query"`
		Clicks float64 `json:"clicks"`
	} `json:"queries"`
}

func (m *Module) gscArticle(ctx context.Context, p period, slug string) (*gscArticle, error) {
	filter := &gscFilter{Dimension: "page", Operator: "contains", Expression: "/article/" + slug}
	totals, err := m.gscTotals(ctx, p.Start, p.End, filter)
	if err != nil {
		return nil, err
	}
	queries, err := m.gscQuery(ctx, p.Start, p.End, "query", 5, filter)
	if err != nil {
		return nil, err
	}
	out := &gscArticle{Clicks: totals.Clicks, Impressions: totals.Impressions, Position: totals.Position}
	out.Queries = make([]struct {
		Query  string  `json:"query"`
		Clicks float64 `json:"clicks"`
	}, 0, len(queries))
	for _, q := range queries {
		out.Queries = append(out.Queries, struct {
			Query  string  `json:"query"`
			Clicks float64 `json:"clicks"`
		}{q.Key, q.Clicks})
	}
	return out, nil
}

// ---- sitemaps and index coverage ----

type gscSitemap struct {
	Path           string `json:"path"`
	LastDownloaded string `json:"lastDownloaded"`
	IsPending      bool   `json:"isPending"`
	Errors         int64  `json:"errors,string"`
	Warnings       int64  `json:"warnings,string"`
}

func (m *Module) gscSitemaps(ctx context.Context) ([]gscSitemap, error) {
	var res struct {
		Sitemap []gscSitemap `json:"sitemap"`
	}
	endpoint := analyticsEndpoints.GSC + "/sites/" + gscSite(m.cfg.GSCSiteURL) + "/sitemaps"
	err := m.googleJSON(ctx, m.cfg.GSCCredentialsJSON, scopeSearchConsole, http.MethodGet, endpoint, nil, &res)
	return res.Sitemap, err
}

type inspection struct {
	Indexed       bool
	CoverageState string
}

// gscInspect asks Google what it holds in its index for one URL.
func (m *Module) gscInspect(ctx context.Context, pageURL string) (*inspection, error) {
	var res struct {
		InspectionResult struct {
			IndexStatusResult struct {
				Verdict       string `json:"verdict"`
				CoverageState string `json:"coverageState"`
			} `json:"indexStatusResult"`
		} `json:"inspectionResult"`
	}
	body := map[string]string{"inspectionUrl": pageURL, "siteUrl": m.cfg.GSCSiteURL, "languageCode": "fr-FR"}
	endpoint := analyticsEndpoints.Inspection + "/urlInspection/index:inspect"
	if err := m.googleJSON(ctx, m.cfg.GSCCredentialsJSON, scopeSearchConsole, http.MethodPost, endpoint, body, &res); err != nil {
		return nil, err
	}
	status := res.InspectionResult.IndexStatusResult
	return &inspection{Indexed: status.Verdict == "PASS", CoverageState: status.CoverageState}, nil
}

const (
	// Google needs a couple of days to index a fresh article: younger ones
	// would all read as « not indexed ».
	inspectionMinAge = 3 * 24 * time.Hour
	inspectionBatch  = 40
)

// inspectRecentArticles keeps bo_gsc_inspection up to date for the latest
// published articles. Forty URLs a day is far below the 2,000 a site may ask.
func (m *Module) inspectRecentArticles(ctx context.Context) {
	if len(m.gscMissing()) > 0 {
		return
	}
	var articles []struct {
		ID        int64
		Slug      string
		CreatedAt time.Time
	}
	if err := m.db.WithContext(ctx).Raw(
		`SELECT id, slug, created_at FROM articles
		 WHERE status = 'published' AND slug IS NOT NULL AND created_at < ?
		 ORDER BY created_at DESC LIMIT ?`, time.Now().Add(-inspectionMinAge), inspectionBatch).Scan(&articles).Error; err != nil {
		m.log.WithError(err).Warn("[BO] index inspection: could not list articles")
		return
	}
	for _, a := range articles {
		pageURL := strings.TrimRight(m.cfg.SiteURL, "/") + "/article/" + a.Slug + "/" + a.CreatedAt.UTC().Format("02-01-2006")
		res, err := m.gscInspect(ctx, pageURL)
		if err != nil {
			m.log.WithError(err).Warn("[BO] index inspection failed, stopping this run")
			return
		}
		// not_indexed_since keeps the first day a page was seen out of the index.
		if err := m.db.WithContext(ctx).Exec(
			`INSERT INTO bo_gsc_inspection (url, article_id, checked_at, indexed, coverage_state, not_indexed_since)
			 VALUES (?, ?, now(), ?, ?, CASE WHEN ? THEN NULL ELSE now() END)
			 ON CONFLICT (url) DO UPDATE SET checked_at = now(), indexed = EXCLUDED.indexed,
			   coverage_state = EXCLUDED.coverage_state,
			   not_indexed_since = CASE WHEN EXCLUDED.indexed THEN NULL
			     ELSE COALESCE(bo_gsc_inspection.not_indexed_since, now()) END`,
			pageURL, a.ID, res.Indexed, res.CoverageState, res.Indexed).Error; err != nil {
			m.log.WithError(err).Warn("[BO] index inspection: result not saved")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(300 * time.Millisecond):
		}
	}
}

// newlyNotIndexed counts the recent articles Google dropped or never took,
// first seen that way in the last seven days.
func (m *Module) newlyNotIndexed(ctx context.Context) (int64, error) {
	var n int64
	err := m.db.WithContext(ctx).Raw(
		"SELECT count(*) FROM bo_gsc_inspection WHERE indexed = false AND not_indexed_since >= ?",
		time.Now().AddDate(0, 0, -7)).Scan(&n).Error
	return n, err
}

type notIndexedPage struct {
	URL             string     `json:"url"`
	ArticleID       *int64     `json:"article_id"`
	CoverageState   string     `json:"coverage_state"`
	NotIndexedSince *time.Time `json:"not_indexed_since"`
	CheckedAt       time.Time  `json:"checked_at"`
}

func (m *Module) handleGSCIndex(c echo.Context) error {
	if len(m.gscMissing()) > 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": false})
	}
	ctx := c.Request().Context()
	pages := []notIndexedPage{}
	if err := m.db.WithContext(ctx).Raw(
		`SELECT url, article_id, coverage_state, not_indexed_since, checked_at FROM bo_gsc_inspection
		 WHERE indexed = false ORDER BY not_indexed_since DESC NULLS LAST LIMIT 50`).Scan(&pages).Error; err != nil {
		return m.internal(c, err)
	}
	var checked int64
	m.db.WithContext(ctx).Raw("SELECT count(*) FROM bo_gsc_inspection").Scan(&checked)
	return c.JSON(http.StatusOK, map[string]interface{}{"configured": true, "pages": pages, "checked": checked})
}

// searchConsoleHealth is the « Search Console » card of the health screen.
func (m *Module) searchConsoleHealth(ctx context.Context) *HealthService {
	card := &HealthService{Key: "search_console", Name: "Search Console", Metrics: []HealthMetric{}}
	if missing := m.gscMissing(); len(missing) > 0 {
		card.Status, card.Missing = HealthUnconfigured, missing
		return card
	}
	sitemaps, err := m.gscSitemaps(ctx)
	if err != nil {
		m.log.WithError(err).Warn("[BO] Search Console sitemaps not read")
		card.Status, card.Note = HealthDown, "Google n'a pas répondu"
		return card
	}
	var withErrors int64
	for _, s := range sitemaps {
		if s.Errors > 0 {
			withErrors++
		}
	}
	card.Status = HealthOK
	card.Metrics = append(card.Metrics, HealthMetric{Label: "Sitemaps", Value: fmt.Sprintf("%d lus, %d en erreur", len(sitemaps), withErrors)})
	if fresh, err := m.newlyNotIndexed(ctx); err == nil {
		card.Metrics = append(card.Metrics, HealthMetric{Label: "Pages non indexées · nouvelles", Value: fmt.Sprintf("%d", fresh)})
		if fresh > 0 {
			card.Status = HealthWarn
		}
	}
	if withErrors > 0 {
		card.Status = HealthWarn
	}
	card.Link = &HealthLink{Label: "Voir les pages", URL: "/analytics"}
	return card
}
