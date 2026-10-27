package services

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
)

// newTestService wires a LiquipediaService against an httptest server and a
// miniredis instance. The IPv4 dial override only triggers for
// api.liquipedia.net, so the 127.0.0.1 test server is unaffected.
func newTestService(t *testing.T, handler http.Handler) (*LiquipediaService, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := NewLiquipediaService("test-key", 1000, rc, logger)
	svc.baseURL = srv.URL
	return svc, mr
}

func TestMakeRequestCachesFreshAndStale(t *testing.T) {
	var calls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	ctx := context.Background()

	_, err := svc.MakeRequest(ctx, "valorant", "match", nil, "liq:test:key", time.Minute)
	require.NoError(t, err)
	// Second call must be served from cache: no extra HTTP call.
	_, err = svc.MakeRequest(ctx, "valorant", "match", nil, "liq:test:key", time.Minute)
	require.NoError(t, err)

	require.Equal(t, int32(1), calls.Load())
	require.True(t, mr.Exists("liq:test:key"))
	require.True(t, mr.Exists(cache.StaleKey("liq:test:key")))
}

func TestMakeRequestRefusesOversizedBody(t *testing.T) {
	old := maxLiqResponseSize
	maxLiqResponseSize = 64
	t.Cleanup(func() { maxLiqResponseSize = old })

	big := make([]byte, 200)
	for i := range big {
		big[i] = 'x'
	}
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(big)
	}))

	_, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:big", time.Minute)
	require.Error(t, err) // no stale available → error
	// Critical: the truncated body must NOT be cached, neither fresh nor stale.
	require.False(t, mr.Exists("liq:test:big"))
	require.False(t, mr.Exists(cache.StaleKey("liq:test:big")))
}

func TestMakeRequestOversizedFallsBackToStale(t *testing.T) {
	old := maxLiqResponseSize
	maxLiqResponseSize = 64
	t.Cleanup(func() { maxLiqResponseSize = old })

	big := make([]byte, 200)
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(big)
	}))
	require.NoError(t, mr.Set(cache.StaleKey("liq:test:big2"), `{"result":["stale"]}`))

	data, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:big2", time.Minute)
	require.NoError(t, err)
	require.Equal(t, `{"result":["stale"]}`, string(data))
}

func TestSingleflightSurvivesFirstCallerCancel(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	ctx1, cancel := context.WithCancel(context.Background())
	done1 := make(chan struct{})
	go func() {
		defer close(done1)
		_, _ = svc.MakeRequest(ctx1, "valorant", "match", nil, "liq:test:sf", time.Minute)
	}()
	time.Sleep(30 * time.Millisecond) // let caller 1 own the flight

	done2 := make(chan error, 1)
	go func() {
		_, err := svc.MakeRequest(context.Background(), "valorant", "match", nil, "liq:test:sf", time.Minute)
		done2 <- err
	}()
	time.Sleep(30 * time.Millisecond) // let caller 2 join the flight
	cancel()                          // first caller bails out mid-flight

	<-done1
	require.NoError(t, <-done2) // caller 2 must still get the data
}

func TestGetTeamByPageIDUsesWikiHint(t *testing.T) {
	var teamCalls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team":
			teamCalls.Add(1)
			if r.URL.Query().Get("wiki") == "valorant" {
				_, _ = w.Write([]byte(`{"result":[{"pageid":42,"pagename":"Test_Team","name":"Test Team","template":"testteam","status":"active"}]}`))
				return
			}
			_, _ = w.Write([]byte(`{"result":[]}`))
		default: // /squadplayer
			_, _ = w.Write([]byte(`{"result":[]}`))
		}
	}))

	// Cold lookup: fans out, finds the team, must store the hint.
	team, err := svc.GetTeamByPageID(context.Background(), 42, "")
	require.NoError(t, err)
	require.NotNil(t, team)
	hint, err := mr.Get("liq:wikihint:42")
	require.NoError(t, err)
	require.Equal(t, "valorant", hint)

	// Warm lookup: flush data caches but keep the hint → exactly 1 team call.
	for _, k := range mr.Keys() {
		if k != "liq:wikihint:42" {
			mr.Del(k)
		}
	}
	teamCalls.Store(0)
	_, err = svc.GetTeamByPageID(context.Background(), 42, "")
	require.NoError(t, err)
	require.Equal(t, int32(1), teamCalls.Load())
}

func TestGetTeamDetailByTemplateFallsBackToName(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/team" {
			_, _ = w.Write([]byte(`{"result":[]}`))
			return
		}
		cond := r.URL.Query().Get("conditions")
		conditions = append(conditions, cond)
		// A renamed team: the historical template no longer matches its record,
		// only the display name does.
		if cond == "[[name::BRION]]" {
			_, _ = w.Write([]byte(`{"result":[{"pageid":36302,"pagename":"BRION","name":"BRION","template":"brion esports","status":"active"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	detail, err := svc.GetTeamDetailByTemplate(context.Background(), "leagueoflegends", "brion 2023", "BRION")
	require.NoError(t, err)
	require.Equal(t, 36302, detail.ID)
	require.Equal(t, "brion esports", detail.Template)
	require.Equal(t, []string{"[[template::brion 2023]]", "[[name::BRION]]"}, conditions)
}

func TestGetTeamDetailByTemplateSkipsNameWhenTemplateMatches(t *testing.T) {
	var teamCalls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/team" {
			_, _ = w.Write([]byte(`{"result":[]}`))
			return
		}
		teamCalls.Add(1)
		_, _ = w.Write([]byte(`{"result":[{"pageid":24057,"pagename":"Hanwha_Life_Esports","name":"Hanwha Life Esports","template":"hanwha life esports","status":"active"}]}`))
	}))

	detail, err := svc.GetTeamDetailByTemplate(context.Background(), "leagueoflegends", "hanwha life esports", "Hanwha Life Esports")
	require.NoError(t, err)
	require.Equal(t, 24057, detail.ID)
	require.Equal(t, int32(1), teamCalls.Load()) // no second lookup by name
}

// Opponent ids in match payloads are hashStringToInt(name) (up to 19 digits),
// never MediaWiki pageids (unsigned 32-bit). Such an id must 404 without a
// single upstream call — the old 10-wiki fan-out cost 10 Liquipedia requests
// per hashed id and was saturating the outbound pipe.
func TestGetTeamByPageIDRejectsHashedIDWithoutUpstreamCall(t *testing.T) {
	var upstreamCalls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	const hashed = int64(2532014407522215000) // seen in prod logs

	team, err := svc.GetTeamByPageID(context.Background(), hashed, "valorant")
	require.Error(t, err)
	require.Nil(t, team)

	detail, err := svc.GetTeamDetailByPageID(context.Background(), hashed, "valorant")
	require.Error(t, err)
	require.Nil(t, detail)

	require.Equal(t, int32(0), upstreamCalls.Load(), "hashed id must not reach Liquipedia")
}

// The guard must not swallow real pageids: the largest MediaWiki page_id
// (unsigned 32-bit) still goes upstream.
func TestGetTeamByPageIDStillLooksUpMaxPageID(t *testing.T) {
	var upstreamCalls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	_, _ = svc.GetTeamByPageID(context.Background(), 4294967295, "valorant")
	require.Greater(t, upstreamCalls.Load(), int32(0))
}

// A caller whose context ends while the shared fetch is still queued must get
// its context error at once: the old blocking singleflight wait ignored the
// handler's deadline, so a 10 s handler could hang 35 s per upstream call.
// The fetch itself carries on for the other waiters and still lands in cache.
func TestMakeRequestHonoursCallerContextWhileSharedFetchContinues(t *testing.T) {
	release := make(chan struct{})
	var upstreamCalls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		<-release
		_, _ = w.Write([]byte(`{"result":[{"pageid":1}]}`))
	}))
	const key = "liq:team:valorant:1"

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err := svc.MakeRequest(ctx, "valorant", "team", url.Values{}, key, time.Minute)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Less(t, time.Since(start), 2*time.Second)

	close(release)
	require.Eventually(t, func() bool {
		v, err := mr.Get(key)
		return err == nil && v != ""
	}, 2*time.Second, 10*time.Millisecond)

	data, err := svc.MakeRequest(context.Background(), "valorant", "team", url.Values{}, key, time.Minute)
	require.NoError(t, err)
	require.Contains(t, string(data), "pageid")
	require.Equal(t, int32(1), upstreamCalls.Load(), "the abandoned fetch must be reused, not repeated")
}

// Background work (poller, notification hydration) must not make a page wait:
// with the single outbound slot held, a foreground caller queued after a
// background one still goes upstream first.
func TestBackgroundLaneYieldsOutboundSlotToForegroundCaller(t *testing.T) {
	holding := make(chan struct{})
	gate := make(chan struct{})
	var mu sync.Mutex
	var order []string
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cond := r.URL.Query().Get("conditions")
		if cond == "hold" {
			close(holding)
			<-gate
		}
		mu.Lock()
		order = append(order, cond)
		mu.Unlock()
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	request := func(ctx context.Context, cond string) {
		params := url.Values{}
		params.Set("conditions", cond)
		_, _ = svc.MakeRequest(ctx, "valorant", "team", params, "liq:team:valorant:"+cond, time.Minute)
	}

	go request(context.Background(), "hold")
	<-holding
	go request(BackgroundLane(context.Background()), "background")
	time.Sleep(50 * time.Millisecond)
	go request(context.Background(), "foreground")
	time.Sleep(50 * time.Millisecond)
	close(gate)

	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(order) == 3
	}, 3*time.Second, 10*time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, []string{"hold", "foreground", "background"}, order)
}

// The hourly budget warns exactly once per hour when it crosses 80 %, so a wiki
// about to be blocked (rainbowsix hit 727/1000 on 2026-10-27) shows up in the
// logs before every on-demand page of that game starts failing.
func TestRequestBudgetWarnsOnceWhenCrossingEightyPercent(t *testing.T) {
	b := &RequestBudget{Wiki: "rainbowsix", Limit: 10, ResetAt: time.Now().Add(time.Hour)}

	for i := 0; i < 7; i++ {
		require.False(t, b.RecordRequest(), "request %d is below the threshold", i+1)
	}
	require.True(t, b.RecordRequest(), "8th request crosses 80 %")
	require.False(t, b.RecordRequest(), "warned already this hour")

	b.ResetAt = time.Now().Add(-time.Second)
	for i := 0; i < 7; i++ {
		require.False(t, b.RecordRequest())
	}
	require.True(t, b.RecordRequest(), "warns again after the hourly reset")
}
