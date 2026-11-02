package handlers

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/services"
)

func newTeamHandler(t *testing.T, upstream http.Handler) *TeamHandler {
	t.Helper()
	srv := httptest.NewServer(upstream)
	t.Cleanup(srv.Close)
	t.Setenv("LIQUIPEDIA_API_BASE_URL", srv.URL)
	rc := testCache(t)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := services.NewLiquipediaService("test-key", 1000, rc, logger)
	return &TeamHandler{liquipediaService: svc, redisCache: rc, log: logger}
}

func getByTemplate(t *testing.T, ctx context.Context, h *TeamHandler, query string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/teams/by-template?"+query, nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	return statusOf(rec, h.GetTeamByTemplate(echo.New().NewContext(req, rec)))
}

func getTeamDetail(t *testing.T, h *TeamHandler, id string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/teams/"+id+"/detail?wiki=counterstrike", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(id)
	return statusOf(rec, h.GetTeamDetail(c))
}

func statusOf(rec *httptest.ResponseRecorder, err error) int {
	if he, ok := err.(*echo.HTTPError); ok {
		return he.Code
	}
	return rec.Code
}

// The team page turns a by-template 404 into a real HTTP 404: during a Liquipedia
// saturation, a 404 here would de-index a valid team.
func TestGetTeamByTemplateReturns503WhenUpstreamFails(t *testing.T) {
	h := newTeamHandler(t, upstreamStatus(http.StatusInternalServerError))
	require.Equal(t, http.StatusServiceUnavailable, getByTemplate(t, context.Background(), h, "template=vitality&wiki=counterstrike"))
	require.Equal(t, http.StatusServiceUnavailable, getByTemplate(t, context.Background(), h, "template=vitality2&wiki=counterstrike&detail=1"))
}

func TestGetTeamByTemplateReturns503WhenTheDeadlineHits(t *testing.T) {
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	require.Equal(t, http.StatusServiceUnavailable, getByTemplate(t, ctx, h, "template=vitality&wiki=counterstrike&detail=1"))
}

func TestGetTeamByTemplateReturns404WhenLiquipediaHasNoSuchTeam(t *testing.T) {
	h := newTeamHandler(t, upstreamEmpty())
	require.Equal(t, http.StatusNotFound, getByTemplate(t, context.Background(), h, "template=nope&wiki=counterstrike"))
	require.Equal(t, http.StatusNotFound, getByTemplate(t, context.Background(), h, "template=nope&wiki=counterstrike&detail=1"))
}

// A quarter of the outbound calls of the 2026-11-01 16Z hour were the name fallback
// of opponents that mostly have no team page: a miss must cost one call, not two.
func TestGetTeamByTemplateAsksTemplateAndNameInOneCall(t *testing.T) {
	var teamCalls atomic.Int32
	var condition atomic.Value
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/team") {
			teamCalls.Add(1)
			condition.Store(r.URL.Query().Get("conditions"))
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	status := getByTemplate(t, context.Background(), h, "template=i+hate+drugs&wiki=counterstrike&name=I+Hate+Drugs")

	require.Equal(t, http.StatusNotFound, status)
	require.EqualValues(t, 1, teamCalls.Load())
	require.Equal(t, "[[template::i hate drugs]] OR [[name::I Hate Drugs]]", condition.Load())
}

// A renamed team: another row can carry the display name of the old template's team.
func TestGetTeamByTemplatePrefersTheRowMatchingTheTemplate(t *testing.T) {
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/team") {
			_, _ = w.Write([]byte(`{"result":[{"pageid":1,"pagename":"Other","template":"other","name":"Brion"},{"pageid":2,"pagename":"Brion","template":"brion 2023","name":"OK Brion"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/teams/by-template?template=brion+2023&wiki=counterstrike&name=Brion", nil)
	rec := httptest.NewRecorder()
	require.NoError(t, h.GetTeamByTemplate(echo.New().NewContext(req, rec)))

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"name":"OK Brion"`)
}

func TestGetTeamDetailReturns503WhenUpstreamFails(t *testing.T) {
	h := newTeamHandler(t, upstreamStatus(http.StatusInternalServerError))
	require.Equal(t, http.StatusServiceUnavailable, getTeamDetail(t, h, "4242"))
}

func TestGetTeamDetailReturns404WhenNoWikiHasThePageID(t *testing.T) {
	h := newTeamHandler(t, upstreamEmpty())
	require.Equal(t, http.StatusNotFound, getTeamDetail(t, h, "4242"))
}

func TestGetTeamDetailReturns404WithoutCallingLiquipediaForAHashedID(t *testing.T) {
	var calls atomic.Int32
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	require.Equal(t, http.StatusNotFound, getTeamDetail(t, h, "9007199254740991"))
	require.Zero(t, calls.Load())
}

func TestGetTeamByTemplateReturns404ForAnUnknownWikiWithoutACall(t *testing.T) {
	var calls atomic.Int32
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	require.Equal(t, http.StatusNotFound, getByTemplate(t, context.Background(), h, "template=x&wiki=nope"))
	require.Zero(t, calls.Load())
}

func TestGetTeamDetailReturns404ForAnUnknownWikiWithoutACall(t *testing.T) {
	var calls atomic.Int32
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/teams/4242/detail?wiki=nope", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("4242")
	require.Equal(t, http.StatusNotFound, statusOf(rec, h.GetTeamDetail(c)))
	require.Zero(t, calls.Load())
}

// Roster fetch failing behind a found team: no partial 200 for public caches.
func TestGetTeamByTemplateReturns503WhenTheRosterCannotBeFetched(t *testing.T) {
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/squadplayer") {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(`{"result":[{"pageid":1,"pagename":"A","template":"a","name":"A"}]}`))
	}))
	require.Equal(t, http.StatusServiceUnavailable, getByTemplate(t, context.Background(), h, "template=a&wiki=counterstrike&detail=1"))
}

func TestGetTeamMatchesKeepsAnUnsafeNameOutOfTheCondition(t *testing.T) {
	var calls atomic.Int32
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/teams/1/matches?wiki=counterstrike&template=x&name=x%5D%5D+OR+%5B%5Bwiki%3A%3Ax", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")
	require.NoError(t, h.GetTeamMatches(c))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Zero(t, calls.Load())
}

func TestGetTeamPlacementsKeepsAnUnsafeNameOutOfTheCondition(t *testing.T) {
	var calls atomic.Int32
	h := newTeamHandler(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/teams/1/placements?wiki=counterstrike&name=%21x", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")
	require.NoError(t, h.GetTeamPlacements(c))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Zero(t, calls.Load())
}
