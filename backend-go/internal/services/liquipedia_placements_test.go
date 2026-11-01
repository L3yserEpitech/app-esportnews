package services

import (
	"context"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

const threePlacements = `{"result":[
	{"pageid":1,"pagename":"A","tournament":"A","placement":"1"},
	{"pageid":2,"pagename":"B","tournament":"B","placement":""},
	{"pageid":3,"pagename":"C","tournament":"C","placement":"2"},
	{"pageid":4,"pagename":"D","tournament":"D","placement":"3"}
]}`

func placementsUpstream(placements *atomic.Int32, tournaments http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/placement") {
			placements.Add(1)
			_, _ = w.Write([]byte(threePlacements))
			return
		}
		tournaments(w, r)
	})
}

func TestFetchTeamPlacementsFlagsPagesWithoutATournament(t *testing.T) {
	var placements atomic.Int32
	svc, _ := newTestService(t, placementsUpstream(&placements, func(w http.ResponseWriter, r *http.Request) {
		require.Contains(t, r.URL.Query().Get("conditions"), "[[pageid::3]]")
		_, _ = w.Write([]byte(`{"result":[{"pageid":1},{"pageid":4}]}`))
	}))

	got, err := svc.FetchTeamPlacements(context.Background(), "counterstrike", "Team", 20)

	require.NoError(t, err)
	require.Len(t, got, 3)
	require.False(t, got[0].NoTournament)
	require.True(t, got[1].NoTournament)
	require.False(t, got[2].NoTournament)
}

// A failed check must not take links away from tournaments that do exist.
func TestFetchTeamPlacementsKeepsLinksWhenTheCheckFails(t *testing.T) {
	var placements atomic.Int32
	svc, _ := newTestService(t, placementsUpstream(&placements, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))

	got, err := svc.FetchTeamPlacements(context.Background(), "counterstrike", "Team", 20)

	require.NoError(t, err)
	require.Len(t, got, 3)
	for _, p := range got {
		require.False(t, p.NoTournament)
	}
}

// The team page asks for 50 and the results page for 200 under one cache key:
// whichever came first used to decide what both showed for an hour.
func TestFetchTeamPlacementsLimitDoesNotDependOnTheFirstCaller(t *testing.T) {
	var placements atomic.Int32
	svc, _ := newTestService(t, placementsUpstream(&placements, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[{"pageid":1},{"pageid":3},{"pageid":4}]}`))
	}))

	short, err := svc.FetchTeamPlacements(context.Background(), "counterstrike", "Team", 2)
	require.NoError(t, err)
	long, err := svc.FetchTeamPlacements(context.Background(), "counterstrike", "Team", 200)
	require.NoError(t, err)

	require.Len(t, short, 2, "the row without a result must not use up the limit")
	require.Len(t, long, 3)
	require.Equal(t, int32(1), placements.Load())
}
