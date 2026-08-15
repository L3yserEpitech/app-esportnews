package models

import "testing"

func TestNormalizeLiqTournamentSetsWiki(t *testing.T) {
	lt := LiqTournament{
		PageID:    1,
		PageName:  "Some_Tournament",
		Name:      "Some Tournament",
		StartDate: "2026-01-01",
		EndDate:   "2026-01-10",
	}
	out := NormalizeLiqTournament(lt, "counterstrike")
	if out.Wiki != "counterstrike" {
		t.Errorf("expected Wiki=counterstrike, got %q", out.Wiki)
	}
}
