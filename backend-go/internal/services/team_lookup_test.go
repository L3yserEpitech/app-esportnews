package services

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
)

const vitalityRow = `{"pageid":218011,"pagename":"Team_Vitality","name":"Team Vitality","template":"team vitality","status":"active"}`

// teamUpstream answers /team from the conditions it receives, like LPDB does.
func teamUpstream(conditions *[]string, answer func(cond string) string) http.Handler {
	var mu sync.Mutex
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/team" {
			_, _ = w.Write([]byte(`{"result":[]}`))
			return
		}
		cond := r.URL.Query().Get("conditions")
		mu.Lock()
		*conditions = append(*conditions, cond)
		mu.Unlock()
		_, _ = w.Write([]byte(answer(cond)))
	})
}

func vitalityByTemplate(cond string) string {
	if strings.Contains(cond, "[[template::team vitality]]") {
		return `{"result":[` + vitalityRow + `]}`
	}
	return `{"result":[]}`
}

// `!x` is "everything but x" for LPDB and `]]` closes the condition: see CLAUDE.md §10.
func TestTeamLookupKeepsUnsafeNamesOutOfTheCondition(t *testing.T) {
	for _, name := range []string{
		"x]] OR [[pagename::Team_Vitality",
		"!x",
		"<x",
		">x",
		"a[[b",
		"a]]b",
		"a||b",
		" !x",
		strings.Repeat("n", 256),
	} {
		t.Run(name, func(t *testing.T) {
			var conditions []string
			svc, _ := newTestService(t, teamUpstream(&conditions, vitalityByTemplate))

			_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "ghost", name)

			require.ErrorIs(t, err, ErrTeamNotFound)
			require.Equal(t, []string{"[[template::ghost]]"}, conditions)
		})
	}
}

func TestTeamLookupRefusesAnUnsafeTemplateWithoutACall(t *testing.T) {
	for _, template := range []string{"x]] OR [[name::Team Vitality", "!x", "<x", ">x", " !x", "   <x", strings.Repeat("t", 256)} {
		t.Run(template, func(t *testing.T) {
			var conditions []string
			svc, _ := newTestService(t, teamUpstream(&conditions, vitalityByTemplate))

			_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", template, "Team Vitality")

			require.ErrorIs(t, err, ErrTeamNotFound)
			require.Empty(t, conditions)
		})
	}
}

func TestTeamLookupAcceptsOrdinaryPunctuation(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(string) string { return `{"result":[]}` }))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", `o'neil "pro" & co!`, `O'Neil "Pro" & Co!`)

	require.ErrorIs(t, err, ErrTeamNotFound)
	require.Equal(t, []string{`[[template::o'neil "pro" & co!]] OR [[name::O'Neil "Pro" & Co!]]`}, conditions)
}

// Without authentication, template=furia|name:FURIA used to plant an empty answer
// under the key of the real link template=furia&name=FURIA.
func TestTeamLookupKeysCannotCollide(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(cond string) string {
		if cond == "[[template::furia]] OR [[name::FURIA]]" {
			return `{"result":[{"pageid":152349,"pagename":"FURIA","name":"FURIA","template":"furia"}]}`
		}
		return `{"result":[]}`
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "furia|name:FURIA", "")
	require.ErrorIs(t, err, ErrTeamNotFound)

	detail, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "furia", "FURIA")
	require.NoError(t, err)
	require.Equal(t, 152349, detail.ID)
}

// template=11112 used to answer under the key of pageid 11112.
func TestTeamTemplateCannotPoisonAPageID(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(cond string) string {
		if cond == "[[pageid::11112]]" {
			return `{"result":[{"pageid":11112,"pagename":"FURIA","name":"FURIA","template":"furia"}]}`
		}
		return `{"result":[]}`
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "11112", "")
	require.ErrorIs(t, err, ErrTeamNotFound)

	detail, err := svc.GetTeamDetailByPageID(context.Background(), 11112, "counterstrike")
	require.NoError(t, err)
	require.Equal(t, 11112, detail.ID)
}

func TestTeamLookupKeysAreUnambiguous(t *testing.T) {
	require.NotEqual(t, cache.LiqTeamLookupKey("w", "a", "b"), cache.LiqTeamLookupKey("w", "a:name:b", ""))
	require.NotEqual(t, cache.LiqTeamLookupKey("w", "a|b", ""), cache.LiqTeamLookupKey("w", "a", "b"))
	require.NotEqual(t, cache.LiqTeamLookupKey("w", "1", ""), cache.LiqTeamPageIDKey("w", "1"))
}

func TestResolvedTeamCostsNoCallWhateverTheName(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, vitalityByTemplate))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "Team Vitality")
	require.NoError(t, err)
	require.Len(t, conditions, 1)

	for _, name := range []string{"", "random 1", "random 2"} {
		detail, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", name)
		require.NoError(t, err)
		require.Equal(t, 218011, detail.ID)
	}
	require.Len(t, conditions, 1)
}

func TestTeamResolvedWithoutNameCostsNoCallWithAName(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, vitalityByTemplate))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "")
	require.NoError(t, err)
	_, err = svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "Team Vitality")
	require.NoError(t, err)

	require.Len(t, conditions, 1)
}

// A team found by its name under another template must not answer for that template.
func TestTeamFoundByNameDoesNotAnswerForTheTemplateAlone(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(cond string) string {
		if strings.Contains(cond, "[[name::Team Vitality]]") {
			return `{"result":[` + vitalityRow + `]}`
		}
		return `{"result":[]}`
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "fantome", "Team Vitality")
	require.NoError(t, err)

	_, err = svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "fantome", "")
	require.ErrorIs(t, err, ErrTeamNotFound)
}

func TestTeamLookupFindsTheTemplateRowAmongManyOfTheSameName(t *testing.T) {
	var limit atomic.Value
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/team" {
			limit.Store(r.URL.Query().Get("limit"))
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	_, _ = svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "crowd real", "Crowd")

	require.Equal(t, teamLookupLimit, limit.Load())
}

func TestTeamLookupSkipsAnUnreadableRow(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(string) string {
		return `{"result":[{"pageid":"not a number"},` + vitalityRow + `]}`
	}))

	detail, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "")

	require.NoError(t, err)
	require.Equal(t, 218011, detail.ID)
}

func TestTeamLookupFailsWhenNoRowIsReadable(t *testing.T) {
	var conditions []string
	svc, _ := newTestService(t, teamUpstream(&conditions, func(string) string {
		return `{"result":[{"pageid":"not a number"}]}`
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "")

	require.Error(t, err)
	require.False(t, errors.Is(err, ErrTeamNotFound))
}

// A 200 is not a good answer by itself: cached, it would last 6 h and replace the
// healthy stale copy.
func TestMakeRequestDoesNotStoreABodyThatIsNotAnAnswer(t *testing.T) {
	for name, body := range map[string]string{
		"html":          `<html>Just a moment...</html>`,
		"error":         `{"result":[],"error":["Error: rate limited"]}`,
		"error only":    `{"error":["Error: rate limited"]}`,
		"no result":     `{}`,
		"result object": `{"result":{"a":1}}`,
	} {
		t.Run(name, func(t *testing.T) {
			svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(body))
			}))
			ctx := context.Background()
			healthy := `{"result":[` + vitalityRow + `]}`
			require.NoError(t, svc.cache.Set(ctx, cache.StaleKey("k"), healthy, TTLStale))

			data, err := svc.MakeRequest(ctx, "counterstrike", "team", nil, "k", TTLTeam)

			require.NoError(t, err)
			require.Equal(t, healthy, string(data))
			fresh, _ := svc.cache.Get(ctx, "k")
			require.Empty(t, fresh)
			stale, _ := svc.cache.Get(ctx, cache.StaleKey("k"))
			require.Equal(t, healthy, stale)
		})
	}
}

func TestMakeRequestFailsOnABodyThatIsNotAnAnswerWithoutStale(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html>Just a moment...</html>`))
	}))

	_, err := svc.MakeRequest(context.Background(), "counterstrike", "team", nil, "k", TTLTeam)

	require.Error(t, err)
}

func TestMakeRequestKeepsAnEmptyAnswerWithAnEmptyErrorField(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[],"error":[]}`))
	}))

	_, err := svc.MakeRequest(context.Background(), "counterstrike", "team", nil, "k", TTLTeam)

	require.NoError(t, err)
	fresh, _ := svc.cache.Get(context.Background(), "k")
	require.NotEmpty(t, fresh)
}

func TestGetTeamDetailByPageIDIsUnavailableWhenAWikiFailsAndOthersAreEmpty(t *testing.T) {
	var calls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Query().Get("wiki") == "valorant" {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	_, err := svc.GetTeamDetailByPageID(context.Background(), 4242, "")

	require.Error(t, err)
	require.False(t, errors.Is(err, ErrTeamNotFound))
}

// A numeric team URL during an outage used to ask all ten wikis, twice per render.
func TestGetTeamDetailByPageIDStopsAtTheFirstFailure(t *testing.T) {
	var calls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))

	_, err := svc.GetTeamDetailByPageID(context.Background(), 4242, "counterstrike")

	require.Error(t, err)
	require.EqualValues(t, 1, calls.Load())
}

func TestGetTeamDetailByPageIDRefusesANonPositiveIDWithoutACall(t *testing.T) {
	var calls atomic.Int32
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	for _, id := range []int64{0, -1} {
		_, err := svc.GetTeamDetailByPageID(context.Background(), id, "counterstrike")
		require.ErrorIs(t, err, ErrTeamNotFound)
	}
	require.Zero(t, calls.Load())
}

// A team served with an empty roster stayed so for 30 min through the SSR cache.
func TestTeamDetailFailsWhenTheRosterCannotBeFetched(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/squadplayer" {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(`{"result":[` + vitalityRow + `]}`))
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "")
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrTeamNotFound))

	_, err = svc.GetTeamByTemplate(context.Background(), "counterstrike", "team vitality", "")
	require.Error(t, err)

	_, err = svc.GetTeamDetailByPageID(context.Background(), 218011, "counterstrike")
	require.Error(t, err)
}

func TestTeamDetailAcceptsAnEmptyRoster(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/squadplayer" {
			_, _ = w.Write([]byte(`{"result":[]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[` + vitalityRow + `]}`))
	}))

	_, err := svc.GetTeamDetailByTemplate(context.Background(), "counterstrike", "team vitality", "")
	require.NoError(t, err)
}

func TestSafeConditionValue(t *testing.T) {
	require.True(t, SafeConditionValue("team vitality"))
	require.True(t, SafeConditionValue(`O'Neil & "Pro" Team!`))
	require.True(t, SafeConditionValue("Équipe Épique"))
	require.True(t, SafeConditionValue(strings.Repeat("é", 255)))
	require.False(t, SafeConditionValue(strings.Repeat("é", 256)))
	// A real 102-character pagename, once refused as a 404 outside the poller cache.
	require.True(t, SafeConditionValue("Rocket_League_Championship_Series/Club_Championship/2027/Club_League/Middle_East_and_North_Africa/Open"))
	require.False(t, SafeConditionValue(" !x"))
	require.False(t, SafeConditionValue("   >x"))
	require.False(t, SafeConditionValue("\t!x"))
	require.False(t, SafeConditionValue("\u3000!x"))
	require.False(t, SafeConditionValue("\u00a0<x"))
	require.False(t, SafeConditionValue(" \t "))
	require.False(t, SafeConditionValue(""))
	require.False(t, SafeConditionValue("!x"))
	require.False(t, SafeConditionValue("a\nb"))
}

// TTLTeam and the old TTLStale were both 6 h: the copy died with the fresh key, and
// any outage on a known team was a 503, then a 5xx for Google.
func TestKnownTeamSurvivesAnOutageAfterItsFreshCopyExpired(t *testing.T) {
	var failing atomic.Bool
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failing.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if r.URL.Path == "/team" {
			_, _ = w.Write([]byte(`{"result":[` + vitalityRow + `]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[{"pagename":"Team_Vitality","id":"ZywOo","type":"player","status":"active"}]}`))
	}))
	ctx := context.Background()

	_, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "")
	require.NoError(t, err)

	mr.FastForward(7 * time.Hour)
	failing.Store(true)

	detail, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "")
	require.NoError(t, err)
	require.Equal(t, 218011, detail.ID)
	require.NotEmpty(t, detail.Players)
}

// Found through the OR, then asked without a name: the copy under the template's key
// must exist too.
func TestTeamFoundWithANameSurvivesAnOutageWithoutIt(t *testing.T) {
	var failing atomic.Bool
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failing.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if r.URL.Path == "/team" {
			_, _ = w.Write([]byte(`{"result":[` + vitalityRow + `]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[{"pagename":"Team_Vitality","id":"ZywOo","type":"player","status":"active"}]}`))
	}))
	ctx := context.Background()

	_, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "Team Vitality")
	require.NoError(t, err)

	mr.FastForward(7 * time.Hour)
	failing.Store(true)

	_, err = svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "")
	require.NoError(t, err)
}

// A kept empty answer would turn into a 404 during an outage.
func TestEmptyTeamAnswerLeavesNoCopyForAnOutage(t *testing.T) {
	var failing atomic.Bool
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failing.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	ctx := context.Background()

	_, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "ghost", "")
	require.ErrorIs(t, err, ErrTeamNotFound)

	mr.FastForward(7 * time.Hour)
	failing.Store(true)

	_, err = svc.GetTeamDetailByTemplate(ctx, "counterstrike", "ghost", "")
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrTeamNotFound))
}

// The copy is only an outage's net: once Liquipedia answers, a deleted team is gone.
func TestDeletedTeamEndsIn404DespiteItsCopy(t *testing.T) {
	var deleted atomic.Bool
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if deleted.Load() || r.URL.Path != "/team" {
			_, _ = w.Write([]byte(`{"result":[]}`))
			return
		}
		_, _ = w.Write([]byte(`{"result":[` + vitalityRow + `]}`))
	}))
	ctx := context.Background()

	_, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "")
	require.NoError(t, err)

	mr.FastForward(7 * time.Hour)
	deleted.Store(true)

	_, err = svc.GetTeamDetailByTemplate(ctx, "counterstrike", "team vitality", "")
	require.ErrorIs(t, err, ErrTeamNotFound)
}

func TestStaleCopyLastsLongerForTeamsAndPlayers(t *testing.T) {
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[{"a":1}]}`))
	}))
	ctx := context.Background()

	for _, endpoint := range []string{"team", "squadplayer", "player"} {
		_, err := svc.MakeRequest(ctx, "counterstrike", endpoint, nil, "k:"+endpoint, TTLTeam)
		if endpoint == "team" {
			// {"a":1} reads as an empty team row: still a row.
			require.NoError(t, err)
		}
		require.Equal(t, TTLEntityStale, mr.TTL(cache.StaleKey("k:"+endpoint)), endpoint)
	}

	_, err := svc.MakeRequest(ctx, "counterstrike", "match", nil, "k:match", TTLMatchDetail)
	require.NoError(t, err)
	require.Equal(t, TTLStale, mr.TTL(cache.StaleKey("k:match")))
}

// The 48 h follow the 6 h of a team's fresh copy, not the endpoint: a team search
// lasts 30 min and tournament rosters 10, and their old copies must not pile up.
func TestStaleCopyStaysShortForOtherLookupsOnTheSameEndpoints(t *testing.T) {
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[{"a":1}]}`))
	}))
	ctx := context.Background()

	_, err := svc.MakeRequest(ctx, "counterstrike", "team", nil, "k:search", TTLTeamSearch)
	require.NoError(t, err)
	require.Equal(t, TTLStale, mr.TTL(cache.StaleKey("k:search")))

	_, err = svc.MakeRequest(ctx, "counterstrike", "squadplayer", nil, "k:squads", TTLTournamentDetail)
	require.NoError(t, err)
	require.Equal(t, TTLStale, mr.TTL(cache.StaleKey("k:squads")))
}

func TestEmptyAnswerKeepsItsCopyOutsideTeamLookups(t *testing.T) {
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	_, err := svc.MakeRequest(context.Background(), "counterstrike", "team", nil, "k:search", TTLTeamSearch)

	require.NoError(t, err)
	require.Equal(t, TTLStale, mr.TTL(cache.StaleKey("k:search")))
}

// Unreadable rows used to be stored: 503 for 6 h without another call, and the good
// copy overwritten.
func TestTeamAnswerWithOnlyUnreadableRowsIsNotStored(t *testing.T) {
	var calls atomic.Int32
	bad := `{"result":[{"pageid":"not a number"}]}`
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(bad))
	}))
	ctx := context.Background()
	healthy := `{"result":[` + vitalityRow + `]}`
	key := cache.LiqTeamLookupKey("counterstrike", "team vitality", "")

	_, err := svc.GetTeamDetailByTemplate(ctx, "counterstrike", "ghost", "")
	require.Error(t, err)
	_, err = svc.GetTeamDetailByTemplate(ctx, "counterstrike", "ghost", "")
	require.Error(t, err)
	require.EqualValues(t, 2, calls.Load())

	require.NoError(t, svc.cache.Set(ctx, cache.StaleKey(key), healthy, TTLStale))
	_, err = svc.MakeRequest(ctx, "counterstrike", "team", nil, key, TTLTeam)
	require.NoError(t, err)
	stale, _ := svc.cache.Get(ctx, cache.StaleKey(key))
	require.Equal(t, healthy, stale)
}
