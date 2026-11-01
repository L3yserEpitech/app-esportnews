package services

import (
	"context"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDirtyRefreshGate(t *testing.T) {
	g := newDirtyRefreshGate()
	now := time.Now()

	require.True(t, g.Allow("valorant", "matches_running", 4*time.Minute, now))
	// Within cooldown → blocked.
	require.False(t, g.Allow("valorant", "matches_running", 4*time.Minute, now.Add(2*time.Minute)))
	// Other type and other wiki are independent.
	require.True(t, g.Allow("valorant", "matches_past", 20*time.Minute, now))
	require.True(t, g.Allow("dota2", "matches_running", 4*time.Minute, now))
	// After cooldown → allowed again.
	require.True(t, g.Allow("valorant", "matches_running", 4*time.Minute, now.Add(5*time.Minute)))
}

func TestFinishedTournamentsConditions(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

	want := "[[enddate::<2026-11-01]] AND [[enddate::>2026-10-01]] AND [[status::!cancelled]] AND [[status::!postponed]]"
	require.Equal(t, want, finishedTournamentsConditions(now))
}

func TestRunningTournamentsConditionsExcludeCalledOff(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

	want := "[[startdate::<2026-11-02]] AND [[enddate::>2026-10-31]] AND [[status::!cancelled]] AND [[status::!postponed]]"
	require.Equal(t, want, runningTournamentsConditions(now))
}

func TestUpcomingTournamentsConditionsExcludeCalledOff(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

	want := "[[startdate::>2026-11-01]] AND [[status::!cancelled]] AND [[status::!postponed]]"
	require.Equal(t, want, upcomingTournamentsConditions(now))
}

func TestTournamentRefreshesSendTheirConditions(t *testing.T) {
	now := time.Now()
	refreshes := []struct {
		name string
		run  func(*LiquipediaPoller)
		want string
	}{
		{"running", func(p *LiquipediaPoller) { p.refreshTournamentsRunning(context.Background(), "valorant") }, runningTournamentsConditions(now)},
		{"upcoming", func(p *LiquipediaPoller) { p.refreshTournamentsUpcoming(context.Background(), "valorant") }, upcomingTournamentsConditions(now)},
		{"finished", func(p *LiquipediaPoller) { p.refreshTournamentsFinished(context.Background(), "valorant") }, finishedTournamentsConditions(now)},
	}

	for _, r := range refreshes {
		t.Run(r.name, func(t *testing.T) {
			var conditions atomic.Value
			svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				conditions.Store(req.URL.Query().Get("conditions"))
				_, _ = w.Write([]byte(`{"result":[]}`))
			}))

			r.run(NewLiquipediaPoller(svc, NewDirtyTracker(), nil, svc.log))

			require.Equal(t, r.want, conditions.Load())
		})
	}
}
