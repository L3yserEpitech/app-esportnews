package services

import (
	"testing"
	"time"

	"github.com/esportnews/backend/internal/models"
)

func opponentMatch(names ...string) models.NormalizedMatch {
	m := models.NormalizedMatch{}
	for _, n := range names {
		name := n
		m.Opponents = append(m.Opponents, models.NormalizedOpponent{
			Opponent: &models.NormalizedTeamCompact{Name: name},
		})
	}
	return m
}

func TestNormalizeTeamName(t *testing.T) {
	cases := map[string]string{
		"T1":                 "t1",
		"  Gen.G  Esports  ": "gen.g esports",
		"KT Rolster":         "kt rolster",
		"":                   "",
	}
	for in, want := range cases {
		if got := normalizeTeamName(in); got != want {
			t.Errorf("normalizeTeamName(%q) = %q, want %q", in, got, want)
		}
	}
}

// L'orthographe exacte varie (casse, espaces doubles) entre la fiche d'équipe et
// les opponents d'un match. Le rapprochement doit encaisser ça.
func TestMatchInvolves_ToleratesCaseAndSpacing(t *testing.T) {
	m := opponentMatch("Hanwha Life  Esports", "T1")

	if !matchInvolves(m, normalizeTeamName("hanwha life esports")) {
		t.Error("should match despite case and double spacing")
	}
	if !matchInvolves(m, normalizeTeamName("T1")) {
		t.Error("should match the second opponent")
	}
	if matchInvolves(m, normalizeTeamName("DRX")) {
		t.Error("should not match a team that is not playing")
	}
}

// Un opponent TBD n'a pas d'équipe : ne pas déréférencer.
func TestMatchInvolves_NilOpponentIsSkipped(t *testing.T) {
	m := models.NormalizedMatch{
		Opponents: []models.NormalizedOpponent{
			{Opponent: nil},
			{Opponent: &models.NormalizedTeamCompact{Name: "T1"}},
		},
	}
	if !matchInvolves(m, "t1") {
		t.Error("should still find T1 past a nil opponent")
	}
	if matchInvolves(m, "") {
		t.Error("an empty name must not match a nil opponent")
	}
}

func TestFavoriteTeamWindow(t *testing.T) {
	now := time.Now().UTC()
	cutoff := now.Add(favoriteTeamMatchWindow)

	inWindow := now.Add(6 * 24 * time.Hour)
	tooFar := now.Add(8 * 24 * time.Hour)
	past := now.Add(-1 * time.Hour)

	if inWindow.After(cutoff) || inWindow.Before(now) {
		t.Error("un match à J+6 doit être retenu")
	}
	if !tooFar.After(cutoff) {
		t.Error("un match à J+8 doit être écarté")
	}
	if !past.Before(now) {
		t.Error("un match déjà commencé doit être écarté")
	}
}
