package handlers

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
)

// newDetailHandlers wires the match and tournament handlers against an
// httptest stand-in for the Liquipedia API (LIQUIPEDIA_API_BASE_URL) and an
// in-process miniredis.
func newDetailHandlers(t *testing.T, upstream http.Handler) (*TournamentHandler, *MatchHandler, *cache.RedisCache) {
	t.Helper()
	srv := httptest.NewServer(upstream)
	t.Cleanup(srv.Close)
	t.Setenv("LIQUIPEDIA_API_BASE_URL", srv.URL)
	rc := testCache(t)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := services.NewLiquipediaService("test-key", 1000, rc, logger)
	return NewTournamentHandler(svc, rc, logger), NewMatchHandler(svc, rc, logger), rc
}

func getDetail(t *testing.T, ctx context.Context, handler echo.HandlerFunc, target, id string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(id)
	require.NoError(t, handler(c))
	return rec
}

func upstreamStatus(code int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(code)
		_, _ = w.Write([]byte(`{"error":"upstream"}`))
	})
}

func upstreamEmpty() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[]}`))
	})
}

// Now that MakeRequest honours the handler deadline, enrichment can time out
// after the tournament itself was found. Serving that as a 200 with zero
// matches, publicly cached for 5-10 min, would hide the bracket from every
// visitor; it must be a 503 like any other transient failure.
func TestGetTournamentDoesNotCacheAPartialDetailWhenTheDeadlineHits(t *testing.T) {
	th, _, rc := newDetailHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond) // slower than the caller's deadline
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	require.NoError(t, rc.Set(context.Background(), cache.LiqTournamentsRunningKey("valorant"),
		`{"result":[{"pageid":91615,"pagename":"VCT/2026","name":"VCT 2026","startdate":"2026-10-01","enddate":"2026-10-30"}]}`, time.Hour))

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	rec := getDetail(t, ctx, th.GetTournament, "/api/tournaments/91615?wiki=valorant", "91615")

	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	require.Empty(t, rec.Header().Get("Cache-Control"), "a partial detail must never be publicly cached")
}

// The unscoped lookup (legacy /tournois/[id] URLs, no ?wiki=) must distinguish
// "Liquipedia says it does not exist" (404, the SSR page de-indexes it) from
// "Liquipedia could not be asked" (503): CLAUDE.md §18.1 forbids a 404 on a
// transient failure.
func TestGetTournamentUnscopedReturns503WhenUpstreamFails(t *testing.T) {
	th, _, _ := newDetailHandlers(t, upstreamStatus(http.StatusInternalServerError))
	rec := getDetail(t, context.Background(), th.GetTournament, "/api/tournaments/424242", "424242")
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}

func TestGetTournamentUnscopedReturns404WhenUpstreamHasNoSuchTournament(t *testing.T) {
	th, _, _ := newDetailHandlers(t, upstreamEmpty())
	rec := getDetail(t, context.Background(), th.GetTournament, "/api/tournaments/424242", "424242")
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGetMatchUnscopedReturns503WhenUpstreamFails(t *testing.T) {
	_, mh, _ := newDetailHandlers(t, upstreamStatus(http.StatusInternalServerError))
	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001", "aB3dE5fG7h_0001")
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}

func TestGetMatchUnscopedReturns404WhenUpstreamHasNoSuchMatch(t *testing.T) {
	_, mh, _ := newDetailHandlers(t, upstreamEmpty())
	rec := getDetail(t, context.Background(), mh.GetMatch, "/api/matches/aB3dE5fG7h_0001", "aB3dE5fG7h_0001")
	require.Equal(t, http.StatusNotFound, rec.Code)
}

// Same harm without a deadline: Liquipedia refused the matches query (429,
// budget, 5xx) and no stale copy exists. MakeRequest already exhausted its
// fallbacks, so this is the transient class that gets a 503 everywhere else.
func TestGetTournamentReturns503WhenMatchesCannotBeFetched(t *testing.T) {
	th, _, rc := newDetailHandlers(t, upstreamStatus(http.StatusInternalServerError))
	require.NoError(t, rc.Set(context.Background(), cache.LiqTournamentsRunningKey("valorant"),
		`{"result":[{"pageid":91615,"pagename":"VCT/2026","name":"VCT 2026","startdate":"2026-10-01","enddate":"2026-10-30"}]}`, time.Hour))

	rec := getDetail(t, context.Background(), th.GetTournament, "/api/tournaments/91615?wiki=valorant", "91615")

	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	require.Empty(t, rec.Header().Get("Cache-Control"))
}
