package backoffice

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"github.com/alicebob/miniredis/v2"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
)

// analyticsModule is a Module with just what the external clients need: an
// HTTP client, a Redis for the response cache and a configuration.
func analyticsModule(t *testing.T, cfg Config) *Module {
	t.Helper()
	mr := miniredis.RunT(t)
	return &Module{
		cache: cache.NewRedisClient("redis://" + mr.Addr()),
		cfg:   cfg,
		http:  &http.Client{Timeout: 5 * time.Second},
		log:   logrus.New(),
	}
}

func TestPeriodEndingCoversWholeDaysAndThePreviousSpan(t *testing.T) {
	p := periodEnding(time.Date(2026, 11, 18, 15, 4, 0, 0, time.UTC), 28)
	if got := p.Start.Format(isoDay) + ".." + p.End.Format(isoDay); got != "2026-10-22..2026-11-18" {
		t.Errorf("period = %s", got)
	}
	if got := p.PrevStart.Format(isoDay) + ".." + p.PrevEnd.Format(isoDay); got != "2026-09-24..2026-10-21" {
		t.Errorf("previous period = %s", got)
	}
	points := fillDays(p.Start, p.End, map[string][2]float64{"2026-10-23": {7, 9}})
	if len(points) != 28 || points[0].Value != 0 || points[1].Value != 7 || points[1].Other != 9 {
		t.Errorf("fillDays: %d points, second = %+v", len(points), points[1])
	}
}

func TestVercelSiteReadsCountsDaysAndTopPages(t *testing.T) {
	var seen []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.Header.Get("Authorization") != "Bearer tok" || q.Get("projectId") != "prj_1" || q.Get("teamId") != "team_1" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		seen = append(seen, r.URL.Path+"?by="+q.Get("by")+"&since="+q.Get("since"))
		switch {
		case strings.HasSuffix(r.URL.Path, "/visits/count"):
			if q.Get("since") == "2026-11-12" {
				json.NewEncoder(w).Encode(map[string]interface{}{"version": 1, "data": map[string]int{"pageviews": 1250, "visitors": 980}})
			} else {
				json.NewEncoder(w).Encode(map[string]interface{}{"version": 1, "data": map[string]int{"pageviews": 1000, "visitors": 800}})
			}
		case q.Get("by") == "day":
			json.NewEncoder(w).Encode(map[string]interface{}{"data": []map[string]interface{}{
				{"timestamp": q.Get("since") + "T00:00:00.000Z", "pageviews": 220, "visitors": 180},
			}})
		case q.Get("by") == "requestPath":
			json.NewEncoder(w).Encode(map[string]interface{}{"data": []map[string]interface{}{
				{"requestPath": "/", "pageviews": 640, "visitors": 510},
				{"requestPath": "Others", "pageviews": 99, "visitors": 80},
			}})
		default:
			json.NewEncoder(w).Encode(map[string]interface{}{"data": []map[string]interface{}{}})
		}
	}))
	defer srv.Close()
	defer func(old string) { analyticsEndpoints.Vercel = old }(analyticsEndpoints.Vercel)
	analyticsEndpoints.Vercel = srv.URL

	m := analyticsModule(t, Config{VercelToken: "tok", VercelProjectID: "prj_1", VercelTeamID: "team_1"})
	p := periodEnding(time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC), 7)
	var out siteAnalytics
	if err := m.vercelSite(context.Background(), p, &out); err != nil {
		t.Fatal(err)
	}
	if out.Totals.Visitors != 980 || out.Totals.PrevVisitors != 800 || out.Totals.Pageviews != 1250 {
		t.Errorf("totals = %+v", out.Totals)
	}
	if len(out.Series) != 7 || out.Series[0].Date != "2026-11-12" || out.Series[0].Value != 180 || out.Series[1].Value != 0 {
		t.Errorf("series = %+v", out.Series)
	}
	if len(out.Pages) != 1 || out.Pages[0].Key != "/" {
		t.Errorf("the « Others » bucket must not be listed as a page: %+v", out.Pages)
	}
	if len(seen) != 8 {
		t.Errorf("expected 8 calls, got %d: %v", len(seen), seen)
	}
}

func TestVercelFailureIsAnError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"code":"not_found"}}`, http.StatusNotFound)
	}))
	defer srv.Close()
	defer func(old string) { analyticsEndpoints.Vercel = old }(analyticsEndpoints.Vercel)
	analyticsEndpoints.Vercel = srv.URL

	m := analyticsModule(t, Config{VercelToken: "tok", VercelProjectID: "prj_1"})
	var out siteAnalytics
	if err := m.vercelSite(context.Background(), periodEnding(time.Now(), 7), &out); err == nil {
		t.Fatal("a 404 from Vercel (Web Analytics off) must not read as zero visitors")
	}
}

func fakeSearchConsole(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer google-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !strings.Contains(r.URL.EscapedPath(), "/sites/sc-domain%3Aesportnews.fr/") {
			http.Error(w, "unknown site "+r.URL.EscapedPath(), http.StatusNotFound)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/sitemaps") {
			w.Write([]byte(`{"sitemap":[{"path":"https://www.esportnews.fr/sitemap.xml","errors":"0","warnings":"2","isPending":false}]}`))
			return
		}
		var req gscRequest
		json.NewDecoder(r.Body).Decode(&req)
		dimension := ""
		if len(req.Dimensions) > 0 {
			dimension = req.Dimensions[0]
		}
		row := func(key string, clicks, impressions, position float64) map[string]interface{} {
			out := map[string]interface{}{"clicks": clicks, "impressions": impressions, "ctr": clicks / impressions, "position": position}
			if key != "" {
				out["keys"] = []string{key}
			}
			return out
		}
		var rows []map[string]interface{}
		switch {
		case dimension == "" && req.StartDate == "2026-11-09":
			rows = append(rows, row("", 120, 4000, 11.8))
		case dimension == "":
			rows = append(rows, row("", 100, 3000, 13.2))
		case dimension == "date":
			rows = append(rows, row("2026-11-10", 20, 600, 10))
		case dimension == "query":
			rows = append(rows, row("esport news", 40, 90, 1.1))
		case dimension == "page" && len(req.Filters) > 0:
			rows = append(rows,
				row("https://www.esportnews.fr/article/furia-ecrase-spirit/16-11-2026", 30, 300, 4),
				row("https://www.esportnews.fr/article/furia-ecrase-spirit", 10, 100, 8),
				row("https://www.esportnews.fr/article/autre-article/14-11-2026", 5, 50, 6),
			)
		case dimension == "page":
			rows = append(rows, row("https://www.esportnews.fr/", 60, 900, 3.2))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"rows": rows})
	}))
}

func withSearchConsole(t *testing.T) *Module {
	t.Helper()
	srv := fakeSearchConsole(t)
	oldGSC, oldToken := analyticsEndpoints.GSC, googleTokenOverride
	analyticsEndpoints.GSC = srv.URL
	googleTokenOverride = func(string) (string, error) { return "google-token", nil }
	t.Cleanup(func() {
		srv.Close()
		analyticsEndpoints.GSC, googleTokenOverride = oldGSC, oldToken
	})
	return analyticsModule(t, Config{GSCSiteURL: "sc-domain:esportnews.fr", GSCCredentialsJSON: "{}"})
}

func TestSearchConsoleOverview(t *testing.T) {
	m := withSearchConsole(t)
	p := periodEnding(time.Date(2026, 11, 15, 0, 0, 0, 0, time.UTC), 7)
	out, err := m.gscOverview(context.Background(), p)
	if err != nil {
		t.Fatal(err)
	}
	if out.Totals.Clicks != 120 || out.Prev.Clicks != 100 || out.Totals.Position != 11.8 {
		t.Errorf("totals = %+v, prev = %+v", out.Totals, out.Prev)
	}
	if len(out.Series) != 7 || out.Series[1].Date != "2026-11-10" || out.Series[1].Value != 20 || out.Series[1].Other != 600 {
		t.Errorf("series = %+v", out.Series)
	}
	if len(out.Queries) != 1 || out.Queries[0].Key != "esport news" || len(out.Pages) != 1 {
		t.Errorf("queries = %+v, pages = %+v", out.Queries, out.Pages)
	}
}

func TestSearchConsoleArticlePagesAddUpBothURLsOfAnArticle(t *testing.T) {
	m := withSearchConsole(t)
	pages, err := m.gscArticlePages(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	furia := pages["furia-ecrase-spirit"]
	if furia.Clicks != 40 || furia.Impressions != 400 {
		t.Errorf("dated and bare URL must be summed: %+v", furia)
	}
	// (4×300 + 8×100) / 400: a position averaged by impressions, not by row.
	if furia.Position != 5 {
		t.Errorf("position = %v, want 5", furia.Position)
	}
	if pages["autre-article"].Clicks != 5 {
		t.Errorf("pages = %+v", pages)
	}
}

func TestArticleSlugOf(t *testing.T) {
	for in, want := range map[string]string{
		"https://www.esportnews.fr/article/mon-article/16-11-2026": "mon-article",
		"https://www.esportnews.fr/article/mon-article":            "mon-article",
		"https://www.esportnews.fr/article/":                       "",
		"https://www.esportnews.fr/match":                          "",
		"https://www.esportnews.fr/":                               "",
	} {
		if got := articleSlugOf(in); got != want {
			t.Errorf("articleSlugOf(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSearchConsoleSitemaps(t *testing.T) {
	m := withSearchConsole(t)
	maps, err := m.gscSitemaps(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(maps) != 1 || maps[0].Warnings != 2 || maps[0].Errors != 0 {
		t.Errorf("sitemaps = %+v", maps)
	}
}

func gzipTSV(t *testing.T, lines ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	zw.Write([]byte(strings.Join(lines, "\n") + "\n"))
	zw.Close()
	return buf.Bytes()
}

func TestSalesReportCountsFirstDownloadsOfTheApp(t *testing.T) {
	report := gzipTSV(t,
		"Provider\tProvider Country\tSKU\tDeveloper\tTitle\tVersion\tProduct Type Identifier\tUnits",
		"APPLE\tUS\tesportnews\tDev\tEsport News\t1.1\t1F\t12",
		"APPLE\tUS\tesportnews\tDev\tEsport News\t1.1\t1\t3",
		"APPLE\tUS\tesportnews\tDev\tEsport News\t1.1\t3F\t40",
		"APPLE\tUS\tesportnews\tDev\tEsport News\t1.1\t7F\t75",
		"APPLE\tUS\tpremium_monthly\tDev\tPremium\t\tIAY\t2",
		"APPLE\tUS\tautre-app\tDev\tAutre\t1.0\t1F\t500",
	)
	n, err := parseSalesReport(report, "esportnews")
	if err != nil || n != 15 {
		t.Errorf("first downloads = %d (%v), want 15: re-downloads, updates, purchases and other apps don't count", n, err)
	}
}

func TestAppStoreDayTellsAZeroFromAReportNotReady(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("filter[vendorNumber]") != "8123" || q.Get("filter[reportType]") != "SALES" || r.Header.Get("Accept") != "application/a-gzip" {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		switch q.Get("filter[reportDate]") {
		case "2026-11-10":
			w.Write(gzipTSV(t, "SKU\tProduct Type Identifier\tUnits", "esportnews\t1F\t9"))
		case "2026-11-11":
			http.Error(w, `{"errors":[{"detail":"There were no sales for the date specified."}]}`, http.StatusNotFound)
		default:
			http.Error(w, `{"errors":[{"detail":"Report is not available yet."}]}`, http.StatusNotFound)
		}
	}))
	defer srv.Close()
	defer func(old string) { analyticsEndpoints.AppStore = old }(analyticsEndpoints.AppStore)
	analyticsEndpoints.AppStore = srv.URL

	m := analyticsModule(t, Config{AppStoreVendorID: "8123"})
	at := func(d int) time.Time { return time.Date(2026, 11, d, 0, 0, 0, 0, time.UTC) }
	if n, err := m.appStoreDay(context.Background(), "jwt", at(10)); err != nil || n != 9 {
		t.Errorf("day with sales: %d, %v", n, err)
	}
	if n, err := m.appStoreDay(context.Background(), "jwt", at(11)); err != nil || n != 0 {
		t.Errorf("day without sales must be a real zero: %d, %v", n, err)
	}
	if _, err := m.appStoreDay(context.Background(), "jwt", at(12)); !errors.Is(err, errReportNotReady) {
		t.Errorf("a report Apple hasn't generated must not be stored as zero: %v", err)
	}
}

func utf16LE(s string) []byte {
	out := []byte{0xFF, 0xFE}
	for _, u := range utf16.Encode([]rune(s)) {
		out = binary.LittleEndian.AppendUint16(out, u)
	}
	return out
}

func TestPlayInstallsReport(t *testing.T) {
	csvText := "Date,Package Name,Current Device Installs,Daily Device Installs,Daily User Installs\n" +
		"2026-11-01,com.esportnewsapp.mobile,500,10,8\n" +
		"2026-11-02,com.esportnewsapp.mobile,507,12,11\n" +
		"2026-11-02,com.autre.app,1,1,99\n"
	for name, raw := range map[string][]byte{"utf-16": utf16LE(csvText), "utf-8": []byte(csvText)} {
		got, err := parsePlayInstalls(raw, "com.esportnewsapp.mobile")
		if err != nil || got["2026-11-01"] != 8 || got["2026-11-02"] != 11 || len(got) != 2 {
			t.Errorf("%s: %v (%v)", name, got, err)
		}
	}
	// The per-country file has several rows a day: they add up.
	byCountry := "Date,Package Name,Country,Daily User Installs\n2026-11-01,p,FR,5\n2026-11-01,p,BE,2\n"
	if got, _ := parsePlayInstalls(utf16LE(byCountry), "p"); got["2026-11-01"] != 7 {
		t.Errorf("per-country rows must be summed: %v", got)
	}
}
