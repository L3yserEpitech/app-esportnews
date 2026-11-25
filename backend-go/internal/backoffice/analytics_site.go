package backoffice

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Base URLs of the external analytics sources, swapped by tests for local fakes.
var analyticsEndpoints = struct {
	Vercel     string
	GSC        string
	Inspection string
	AppStore   string
	GCS        string
}{
	Vercel:     "https://api.vercel.com",
	GSC:        "https://www.googleapis.com/webmasters/v3",
	Inspection: "https://searchconsole.googleapis.com/v1",
	AppStore:   "https://api.appstoreconnect.apple.com",
	GCS:        "https://storage.googleapis.com/storage/v1",
}

type siteRow struct {
	Key       string  `json:"key"`
	Visitors  float64 `json:"visitors"`
	Pageviews float64 `json:"pageviews"`
}

type siteTotals struct {
	Visitors      float64 `json:"visitors"`
	Pageviews     float64 `json:"pageviews"`
	PrevVisitors  float64 `json:"prev_visitors"`
	PrevPageviews float64 `json:"prev_pageviews"`
}

type siteAnalytics struct {
	// "vercel" once Vercel Web Analytics answered, empty otherwise.
	Source     string      `json:"source"`
	Vercel     sourceState `json:"vercel"`
	Days       int         `json:"days"`
	Start      string      `json:"start"`
	End        string      `json:"end"`
	Totals     siteTotals  `json:"totals"`
	Series     []dayPoint  `json:"series"`      // value = visitors, other = page views
	PrevSeries []dayPoint  `json:"prev_series"` // same days, previous period
	Pages      []siteRow   `json:"pages"`
	Referrers  []siteRow   `json:"referrers"`
	Countries  []siteRow   `json:"countries"`
	Devices    []siteRow   `json:"devices"`
}

func (m *Module) vercelMissing() []string {
	return missingEnv("VERCEL_API_TOKEN", m.cfg.VercelToken, "VERCEL_PROJECT_ID", m.cfg.VercelProjectID)
}

// siteAnalytics is the site's traffic as Vercel Web Analytics measures it. Not
// connected, or not answering, it carries no figure: the in-house page_views
// tracker is being retired (CLIENTS-280) and nothing new reads it.
func (m *Module) siteAnalytics(ctx context.Context, p period) (*siteAnalytics, error) {
	out := &siteAnalytics{
		Days: p.Days, Start: p.Start.Format(isoDay), End: p.End.Format(isoDay),
		Series: []dayPoint{}, PrevSeries: []dayPoint{},
		Pages: []siteRow{}, Referrers: []siteRow{}, Countries: []siteRow{}, Devices: []siteRow{},
	}
	out.Vercel.Missing = m.vercelMissing()
	out.Vercel.Configured = len(out.Vercel.Missing) == 0
	if !out.Vercel.Configured {
		return out, nil
	}

	var fromVercel siteAnalytics
	err := m.cached(ctx, fmt.Sprintf("bo:vercel:site:%s:%d", out.End, p.Days), 15*time.Minute, &fromVercel, func() error {
		return m.vercelSite(ctx, p, &fromVercel)
	})
	if err != nil {
		out.Vercel.Error = m.sourceFailure("vercel", err)
		return out, nil
	}
	fromVercel.Source, fromVercel.Vercel = "vercel", out.Vercel
	fromVercel.Days, fromVercel.Start, fromVercel.End = out.Days, out.Start, out.End
	return &fromVercel, nil
}

type vercelRow map[string]interface{}

func (m *Module) vercelGet(ctx context.Context, path string, q url.Values, out interface{}) error {
	q.Set("projectId", m.cfg.VercelProjectID)
	if m.cfg.VercelTeamID != "" {
		q.Set("teamId", m.cfg.VercelTeamID)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, analyticsEndpoints.Vercel+path+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.cfg.VercelToken)
	res, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("vercel %s: HTTP %d: %.200s", path, res.StatusCode, body)
	}
	return json.Unmarshal(body, out)
}

func num(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case string:
		f, _ := strconv.ParseFloat(n, 64)
		return f
	}
	return 0
}

func (m *Module) vercelCount(ctx context.Context, since, until time.Time) (visitors, pageviews float64, err error) {
	var res struct {
		Data vercelRow `json:"data"`
	}
	q := url.Values{"since": {since.Format(isoDay)}, "until": {until.Format(isoDay)}}
	if err = m.vercelGet(ctx, "/v1/query/web-analytics/visits/count", q, &res); err != nil {
		return 0, 0, err
	}
	return num(res.Data["visitors"]), num(res.Data["pageviews"]), nil
}

func (m *Module) vercelAggregate(ctx context.Context, by string, since, until time.Time, limit int) ([]vercelRow, error) {
	var res struct {
		Data []vercelRow `json:"data"`
	}
	q := url.Values{"by": {by}, "since": {since.Format(isoDay)}, "until": {until.Format(isoDay)}}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	if err := m.vercelGet(ctx, "/v1/query/web-analytics/visits/aggregate", q, &res); err != nil {
		return nil, err
	}
	return res.Data, nil
}

func (m *Module) vercelDays(ctx context.Context, since, until time.Time) ([]dayPoint, error) {
	rows, err := m.vercelAggregate(ctx, "day", since, until, 100)
	if err != nil {
		return nil, err
	}
	values := map[string][2]float64{}
	for _, r := range rows {
		ts, _ := r["timestamp"].(string)
		if len(ts) >= 10 {
			values[ts[:10]] = [2]float64{num(r["visitors"]), num(r["pageviews"])}
		}
	}
	return fillDays(since, until, values), nil
}

func (m *Module) vercelTop(ctx context.Context, by string, p period) ([]siteRow, error) {
	rows, err := m.vercelAggregate(ctx, by, p.Start, p.End, 10)
	if err != nil {
		return nil, err
	}
	out := []siteRow{}
	for _, r := range rows {
		key, _ := r[by].(string)
		// Past the limit Vercel folds the rest into one « Others » row: not a page.
		if key == "" || strings.EqualFold(key, "others") {
			continue
		}
		out = append(out, siteRow{Key: key, Visitors: num(r["visitors"]), Pageviews: num(r["pageviews"])})
	}
	return out, nil
}

func (m *Module) vercelSite(ctx context.Context, p period, out *siteAnalytics) error {
	var err error
	if out.Totals.Visitors, out.Totals.Pageviews, err = m.vercelCount(ctx, p.Start, p.End); err != nil {
		return err
	}
	if out.Totals.PrevVisitors, out.Totals.PrevPageviews, err = m.vercelCount(ctx, p.PrevStart, p.PrevEnd); err != nil {
		return err
	}
	if out.Series, err = m.vercelDays(ctx, p.Start, p.End); err != nil {
		return err
	}
	if out.PrevSeries, err = m.vercelDays(ctx, p.PrevStart, p.PrevEnd); err != nil {
		return err
	}
	if out.Pages, err = m.vercelTop(ctx, "requestPath", p); err != nil {
		return err
	}
	if out.Referrers, err = m.vercelTop(ctx, "referrerHostname", p); err != nil {
		return err
	}
	if out.Countries, err = m.vercelTop(ctx, "country", p); err != nil {
		return err
	}
	out.Devices, err = m.vercelTop(ctx, "deviceType", p)
	return err
}
