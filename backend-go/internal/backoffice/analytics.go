package backoffice

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// errNotConfigured is what a source answers when its credentials are missing:
// the screen then says « non connecté » and shows no number.
var errNotConfigured = errors.New("source not configured")

func (m *Module) registerAnalyticsRoutes(g *echo.Group) {
	a := g.Group("/analytics", m.require(PermAnalyticsRead))
	a.GET("/site", m.handleAnalyticsSite)
	a.GET("/gsc", m.handleAnalyticsGSC)
	a.GET("/gsc/articles", m.handleGSCArticles)
	a.GET("/gsc/article", m.handleGSCArticle)
	a.GET("/gsc/index", m.handleGSCIndex)
	a.GET("/app", m.handleAnalyticsApp)
	a.GET("/export", m.handleAnalyticsExport)
	m.addHealthSource("search_console", m.searchConsoleHealth)
}

type period struct {
	Days      int
	Start     time.Time // first day, midnight UTC
	End       time.Time // last day, midnight UTC (inclusive)
	PrevStart time.Time
	PrevEnd   time.Time
}

func day(t time.Time) time.Time {
	y, mo, d := t.UTC().Date()
	return time.Date(y, mo, d, 0, 0, 0, 0, time.UTC)
}

// periodEnding is `days` whole days ending on `end`, and the same length before it.
func periodEnding(end time.Time, days int) period {
	end = day(end)
	start := end.AddDate(0, 0, -(days - 1))
	return period{Days: days, Start: start, End: end, PrevStart: start.AddDate(0, 0, -days), PrevEnd: start.AddDate(0, 0, -1)}
}

func daysParam(c echo.Context) int {
	switch n, _ := strconv.Atoi(c.QueryParam("days")); n {
	case 7, 28, 90:
		return n
	default:
		return 28
	}
}

const isoDay = "2006-01-02"

type dayPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
	Other float64 `json:"other,omitempty"`
}

// fillDays returns one point per day of [start, end], zero where the source had none.
func fillDays(start, end time.Time, values map[string][2]float64) []dayPoint {
	out := []dayPoint{}
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		key := d.Format(isoDay)
		v := values[key]
		out = append(out, dayPoint{Date: key, Value: v[0], Other: v[1]})
	}
	return out
}

// cached keeps the answer of a slow external source in Redis. A failed build is
// not cached: the next view asks again.
func (m *Module) cached(ctx context.Context, key string, ttl time.Duration, out interface{}, build func() error) error {
	if raw, err := m.cache.GetClient().Get(ctx, key).Result(); err == nil {
		if json.Unmarshal([]byte(raw), out) == nil {
			return nil
		}
	}
	if err := build(); err != nil {
		return err
	}
	if raw, err := json.Marshal(out); err == nil {
		m.cache.GetClient().Set(ctx, key, raw, ttl)
	}
	return nil
}

type sourceState struct {
	Configured bool     `json:"configured"`
	Missing    []string `json:"missing,omitempty"`
	Error      string   `json:"error,omitempty"`
}

func missingEnv(pairs ...string) []string {
	var missing []string
	for i := 0; i+1 < len(pairs); i += 2 {
		if pairs[i+1] == "" {
			missing = append(missing, pairs[i])
		}
	}
	return missing
}

// sourceFailure turns a failed external call into what the screen shows. The
// provider's own wording stays in the logs.
func (m *Module) sourceFailure(source string, err error) string {
	m.log.WithError(err).WithField("source", source).Warn("[BO] analytics source failed")
	return "La source n'a pas répondu. Réessayez dans un instant."
}

// ---- site ----

func (m *Module) handleAnalyticsSite(c echo.Context) error {
	ctx := c.Request().Context()
	p := periodEnding(time.Now(), daysParam(c))
	out, err := m.siteAnalytics(ctx, p)
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

// ---- Search Console ----

func (m *Module) handleAnalyticsGSC(c echo.Context) error {
	ctx := c.Request().Context()
	if missing := m.gscMissing(); len(missing) > 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": false, "missing": missing})
	}
	out, err := m.gscOverviewCached(ctx, daysParam(c))
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": true, "error": m.sourceFailure("gsc", err)})
	}
	return c.JSON(http.StatusOK, out)
}

// gscOverviewCached is the Search Console picture of the last `days` days Google
// has published, kept an hour: the figures only change once a day.
func (m *Module) gscOverviewCached(ctx context.Context, days int) (*gscOverview, error) {
	p := periodEnding(time.Now().AddDate(0, 0, -gscLagDays), days)
	var out gscOverview
	err := m.cached(ctx, fmt.Sprintf("bo:gsc:overview:%s:%d", p.End.Format(isoDay), p.Days), time.Hour, &out, func() error {
		built, err := m.gscOverview(ctx, p)
		if err != nil {
			return err
		}
		out = *built
		return nil
	})
	if err != nil {
		return nil, err
	}
	out.Configured = true
	return &out, nil
}

func (m *Module) handleGSCArticles(c echo.Context) error {
	if len(m.gscMissing()) > 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": false, "clicks": map[string]interface{}{}})
	}
	var slugs []string
	for _, s := range strings.Split(c.QueryParam("slugs"), ",") {
		if s = strings.TrimSpace(s); s != "" && len(slugs) < 100 {
			slugs = append(slugs, s)
		}
	}
	ctx := c.Request().Context()
	pages, err := m.gscArticlePages(ctx)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": true, "error": m.sourceFailure("gsc", err), "clicks": map[string]interface{}{}})
	}
	out := map[string]gscRow{}
	for _, slug := range slugs {
		if row, ok := pages[slug]; ok {
			out[slug] = row
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"configured": true, "clicks": out})
}

func (m *Module) handleGSCArticle(c echo.Context) error {
	if len(m.gscMissing()) > 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": false})
	}
	slug := strings.TrimSpace(c.QueryParam("slug"))
	if slug == "" {
		return fail(c, http.StatusBadRequest, "invalid_input", "Article manquant")
	}
	ctx := c.Request().Context()
	p := periodEnding(time.Now().AddDate(0, 0, -gscLagDays), 28)
	var out gscArticle
	err := m.cached(ctx, "bo:gsc:article:"+p.End.Format(isoDay)+":"+hashToken(slug)[:24], time.Hour, &out, func() error {
		built, err := m.gscArticle(ctx, p, slug)
		if err != nil {
			return err
		}
		out = *built
		return nil
	})
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"configured": true, "error": m.sourceFailure("gsc", err)})
	}
	out.Configured = true
	return c.JSON(http.StatusOK, out)
}

// ---- mobile app ----

func (m *Module) handleAnalyticsApp(c echo.Context) error {
	ctx := c.Request().Context()
	out, err := m.appAnalytics(ctx, periodEnding(time.Now().AddDate(0, 0, -1), daysParam(c)))
	if err != nil {
		return m.internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

// ---- export ----

func (m *Module) handleAnalyticsExport(c echo.Context) error {
	ctx := c.Request().Context()
	days := daysParam(c)
	tab := c.QueryParam("tab")
	rows := [][]string{}

	switch tab {
	case "gsc":
		if len(m.gscMissing()) > 0 {
			return fail(c, http.StatusConflict, "not_configured", "Search Console n'est pas connecté")
		}
		p := periodEnding(time.Now().AddDate(0, 0, -gscLagDays), days)
		data, err := m.gscOverview(ctx, p)
		if err != nil {
			return fail(c, http.StatusBadGateway, "source_failed", m.sourceFailure("gsc", err))
		}
		rows = append(rows, []string{"type", "cle", "clics", "impressions", "position"})
		for _, pt := range data.Series {
			rows = append(rows, []string{"jour", pt.Date, ftoa(pt.Value), ftoa(pt.Other), ""})
		}
		for _, r := range data.Queries {
			rows = append(rows, []string{"requete", csvSafe(r.Key), ftoa(r.Clicks), ftoa(r.Impressions), ftoa1(r.Position)})
		}
		for _, r := range data.Pages {
			rows = append(rows, []string{"page", csvSafe(r.Key), ftoa(r.Clicks), ftoa(r.Impressions), ftoa1(r.Position)})
		}
	case "app":
		data, err := m.appAnalytics(ctx, periodEnding(time.Now().AddDate(0, 0, -1), days))
		if err != nil {
			return m.internal(c, err)
		}
		rows = append(rows, []string{"store", "jour", "telechargements"})
		for _, s := range data.Stores {
			for _, pt := range s.Series {
				rows = append(rows, []string{s.Name, pt.Date, ftoa(pt.Value)})
			}
		}
	default:
		tab = "site"
		data, err := m.siteAnalytics(ctx, periodEnding(time.Now(), days))
		if err != nil {
			return m.internal(c, err)
		}
		rows = append(rows, []string{"type", "cle", "visiteurs", "pages_vues"})
		for _, pt := range data.Series {
			rows = append(rows, []string{"jour", pt.Date, ftoa(pt.Value), ftoa(pt.Other)})
		}
		for _, r := range data.Pages {
			rows = append(rows, []string{"page", csvSafe(r.Key), ftoa(r.Visitors), ftoa(r.Pageviews)})
		}
		for _, r := range data.Referrers {
			rows = append(rows, []string{"provenance", csvSafe(r.Key), ftoa(r.Visitors), ftoa(r.Pageviews)})
		}
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="analytics-%s-%dj.csv"`, tab, days))
	c.Response().WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Response())
	for _, r := range rows {
		w.Write(r)
	}
	w.Flush()
	return w.Error()
}

func ftoa(f float64) string  { return strconv.FormatFloat(f, 'f', 0, 64) }
func ftoa1(f float64) string { return strconv.FormatFloat(f, 'f', 1, 64) }
