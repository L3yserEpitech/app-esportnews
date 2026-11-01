package services

import (
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
