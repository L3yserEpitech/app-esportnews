package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
)

func cachedMatch(match2id string, date time.Time, finished int) string {
	return fmt.Sprintf(`{"result":[{"pageid":1,"match2id":%q,"date":%q,"dateexact":1,"finished":%d,"match2opponents":[{"name":"A","type":"team","score":1},{"name":"B","type":"team","score":0}]}]}`,
		match2id, date.UTC().Format("2006-01-02 15:04:05"), finished)
}

func countingUpstream(calls *atomic.Int32) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(cachedMatch("onDemand00_0001", time.Now(), 0)))
	})
}

// The poller refreshes matches_past every ~70 min on a TTL of 55: between two
// refreshes, a finished match was asked of Liquipedia while its copy sat in Redis.
func TestGetMatchServesAFinishedMatchFromTheStalePastCopy(t *testing.T) {
	var calls atomic.Int32
	_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqMatchesPastKey("valorant")),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-48*time.Hour), 1), time.Hour))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Zero(t, calls.Load())
}

func TestGetMatchServesADistantMatchFromTheStaleUpcomingCopy(t *testing.T) {
	var calls atomic.Int32
	_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqMatchesUpcomingKey("valorant")),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(7*time.Hour), 0), time.Hour))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Zero(t, calls.Load())
}

// Moved forward since the copy, a match due soon may already be live: 200 not_started
// for hours. The copy is at most 6 h old, so past that margin it cannot have started
// without moving by more than the copy's age.
func TestGetMatchAsksLiquipediaWhenTheStaleUpcomingMatchIsDueSoon(t *testing.T) {
	var calls atomic.Int32
	_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqMatchesUpcomingKey("valorant")),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(3*time.Hour), 0), time.Hour))

	getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.EqualValues(t, 1, calls.Load())
}

// A stale "upcoming" whose date has passed may be live or over by now.
func TestGetMatchAsksLiquipediaWhenTheStaleUpcomingCopyHasStarted(t *testing.T) {
	var calls atomic.Int32
	_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqMatchesUpcomingKey("valorant")),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-time.Minute), 0), time.Hour))

	getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.EqualValues(t, 1, calls.Load())
}

// Hours-old scores of a live match are worse than one Liquipedia call.
func TestGetMatchNeverServesTheStaleRunningCopy(t *testing.T) {
	var calls atomic.Int32
	_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqMatchesRunningKey("valorant")),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-time.Hour), 0), time.Hour))

	getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.EqualValues(t, 1, calls.Load())
}

// tournaments_finished is only refreshed by the 4h30 safety net on a TTL of 100
// min, and 36 of the 38 tournament 503 measured on 2026-11-01 were finished ones.
func TestGetTournamentReadsAFinishedTournamentFromTheStaleCopy(t *testing.T) {
	var tournamentCalls atomic.Int32
	th, _, rc := newDetailHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/tournament") {
			tournamentCalls.Add(1)
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	require.NoError(t, rc.Set(context.Background(), cache.StaleKey(cache.LiqTournamentsFinishedKey("valorant")),
		`{"result":[{"pageid":91615,"pagename":"VCT/2026","name":"VCT 2026","startdate":"2026-10-01","enddate":"2026-10-30"}]}`, time.Hour))

	rec := getDetail(t, context.Background(), th.GetTournament, "/api/tournaments/91615?wiki=valorant", "91615")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Zero(t, tournamentCalls.Load())
}

// A live page polls every 45 s: a 60 s browser cache plus 120 s of
// stale-while-revalidate kept it up to 3 min behind the /match list.
func TestGetMatchDoesNotLetBrowsersHoldALiveScore(t *testing.T) {
	_, mh, rc := newDetailHandlers(t, upstreamEmpty())
	require.NoError(t, rc.Set(context.Background(), cache.LiqMatchesRunningKey("valorant"),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-time.Minute), 0), time.Hour))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
}

func TestGetMatchKeepsTheBrowserCacheOnAFinishedMatch(t *testing.T) {
	_, mh, rc := newDetailHandlers(t, upstreamEmpty())
	require.NoError(t, rc.Set(context.Background(), cache.LiqMatchesPastKey("valorant"),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-48*time.Hour), 1), time.Hour))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.Equal(t, "public, max-age=60, stale-while-revalidate=120", rec.Header().Get("Cache-Control"))
}

// A fresh list that no longer holds a match says more than an older copy that does.
func TestGetMatchIgnoresTheStaleCopyWhenTheFreshListExists(t *testing.T) {
	for name, key := range map[string]func(string) string{
		"past":     cache.LiqMatchesPastKey,
		"upcoming": cache.LiqMatchesUpcomingKey,
	} {
		t.Run(name, func(t *testing.T) {
			var calls atomic.Int32
			_, mh, rc := newDetailHandlers(t, countingUpstream(&calls))
			ctx := context.Background()
			require.NoError(t, rc.Set(ctx, key("valorant"), cachedMatch("other00000_0001", time.Now().Add(-48*time.Hour), 1), time.Hour))
			require.NoError(t, rc.Set(ctx, cache.StaleKey(key("valorant")), cachedMatch("aB3dE5fG7h_0001", time.Now().Add(48*time.Hour), 1), time.Hour))

			getDetail(t, ctx, mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

			require.EqualValues(t, 1, calls.Load())
		})
	}
}

func TestGetTournamentIgnoresTheStaleCopyWhenTheFreshListExists(t *testing.T) {
	var tournamentCalls atomic.Int32
	th, _, rc := newDetailHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/tournament") {
			tournamentCalls.Add(1)
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	ctx := context.Background()
	require.NoError(t, rc.Set(ctx, cache.LiqTournamentsFinishedKey("valorant"),
		`{"result":[{"pageid":1,"pagename":"Other","name":"Other","startdate":"2026-10-01","enddate":"2026-10-30"}]}`, time.Hour))
	require.NoError(t, rc.Set(ctx, cache.StaleKey(cache.LiqTournamentsFinishedKey("valorant")),
		`{"result":[{"pageid":91615,"pagename":"VCT/2026","name":"VCT 2026","startdate":"2026-10-01","enddate":"2026-10-30"}]}`, time.Hour))

	getDetail(t, ctx, th.GetTournament, "/api/tournaments/91615?wiki=valorant", "91615")

	require.EqualValues(t, 1, tournamentCalls.Load())
}

func TestGetMatchDoesNotLetBrowsersHoldALiveScoreFetchedOnDemand(t *testing.T) {
	_, mh, _ := newDetailHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-time.Minute), 0)))
	}))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001?wiki=valorant", "aB3dE5fG7h_0001")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
}

func TestGetMatchDoesNotLetBrowsersHoldALiveScoreWithoutWiki(t *testing.T) {
	_, mh, rc := newDetailHandlers(t, upstreamEmpty())
	require.NoError(t, rc.Set(context.Background(), cache.LiqMatchesRunningKey("valorant"),
		cachedMatch("aB3dE5fG7h_0001", time.Now().Add(-time.Minute), 0), time.Hour))

	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001", "aB3dE5fG7h_0001")

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
}

// SwitzerLAN exists on the Overwatch and Valorant wikis under the same pagename,
// and the winner of the dedup changed from one call to the next.
func TestTournamentListsKeepHomonymsOfDifferentWikis(t *testing.T) {
	th, _, rc := newDetailHandlers(t, upstreamEmpty())
	ctx := context.Background()
	row := func(id int) string {
		return fmt.Sprintf(`{"result":[{"pageid":%d,"pagename":"SwitzerLAN/2026","name":"SwitzerLAN 2026","startdate":"2026-10-01","enddate":"2026-12-30"}]}`, id)
	}
	require.NoError(t, rc.Set(ctx, cache.LiqTournamentsRunningKey("overwatch"), row(138742), time.Hour))
	require.NoError(t, rc.Set(ctx, cache.LiqTournamentsRunningKey("valorant"), row(92709), time.Hour))

	got := th.readTournamentsFromCache(ctx, cache.LiqTournamentsRunningKey, []string{"overwatch", "valorant"})

	require.Len(t, got, 2)
}

func TestTournamentsByDateKeepHomonymsOfDifferentWikis(t *testing.T) {
	th, _, rc := newDetailHandlers(t, upstreamEmpty())
	ctx := context.Background()
	today := time.Now().UTC().Format("2006-01-02")
	row := func(id int) string {
		return fmt.Sprintf(`{"result":[{"pageid":%d,"pagename":"SwitzerLAN/2026","name":"SwitzerLAN 2026","startdate":%q,"enddate":%q}]}`, id, today, today)
	}
	for wiki, id := range map[string]int{"overwatch": 138742, "valorant": 92709} {
		require.NoError(t, rc.Set(ctx, cache.LiqTournamentsRunningKey(wiki), row(id), time.Hour))
		require.NoError(t, rc.Set(ctx, cache.LiqTournamentsUpcomingKey(wiki), `{"result":[]}`, time.Hour))
		require.NoError(t, rc.Set(ctx, cache.LiqTournamentsFinishedKey(wiki), `{"result":[]}`, time.Hour))
	}

	req := httptest.NewRequest(http.MethodPost, "/api/tournaments/by-date", strings.NewReader("date="+today))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	require.NoError(t, th.ListTournamentsByDate(echo.New().NewContext(req, rec)))

	require.Equal(t, http.StatusOK, rec.Code)
	var got []struct {
		ID int `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 2)
}
