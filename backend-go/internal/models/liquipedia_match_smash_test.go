package models

import "testing"

func TestNormalizeLiqMatch_SmashCharactersStocks(t *testing.T) {
	m := LiqMatch{
		PageID:          7,
		Date:            "2026-06-01 18:00:00",
		Finished:        1,
		Winner:          "1",
		Match2Opponents: []byte(`[{"name":"Hurt","type":"solo"},{"name":"Sonix","type":"solo"}]`),
		Match2Games: []byte(`[{"finished":1,"winner":"1","map":"Battlefield","opponents":[` +
			`{"players":[{"player":"Hurt","characters":[{"name":"Sonic","status":1},{"name":"Sonic","status":1},{"name":"Sonic","status":0}]}]},` +
			`{"players":[{"player":"Sonix","characters":[{"name":"Mario","status":0},{"name":"Mario","status":0},{"name":"Mario","status":0}]}]}` +
			`]}]`),
	}
	out := NormalizeLiqMatch(m, "smash", "finished")
	if len(out.Games) != 1 {
		t.Fatalf("games = %d, want 1", len(out.Games))
	}
	if out.Games[0].Map != "Battlefield" {
		t.Fatalf("stage = %q, want Battlefield", out.Games[0].Map)
	}
	ps := out.Games[0].Participants
	if len(ps) != 2 {
		t.Fatalf("participants = %d, want 2", len(ps))
	}

	var hurt, sonix *NormalizedParticipant
	for i := range ps {
		switch ps[i].Team {
		case 1:
			hurt = &ps[i]
		case 2:
			sonix = &ps[i]
		}
	}
	if hurt == nil || sonix == nil {
		t.Fatalf("missing team1/team2 participants: %+v", ps)
	}
	if hurt.Player != "Hurt" || hurt.Character != "Sonic" {
		t.Fatalf("hurt = %+v", *hurt)
	}
	if hurt.Extra["stocks"] != 2 {
		t.Fatalf("hurt stocks = %v, want 2", hurt.Extra["stocks"])
	}
	if sonix.Player != "Sonix" || sonix.Character != "Mario" {
		t.Fatalf("sonix = %+v", *sonix)
	}
	if sonix.Extra["stocks"] != 0 {
		t.Fatalf("sonix stocks = %v, want 0", sonix.Extra["stocks"])
	}
}

func TestNormalizeLiqMatch_SmashUnknownStocksOmitted(t *testing.T) {
	m := LiqMatch{
		PageID:          8,
		Date:            "2026-06-01 18:00:00",
		Match2Opponents: []byte(`[{"name":"A","type":"solo"},{"name":"B","type":"solo"}]`),
		Match2Games: []byte(`[{"opponents":[` +
			`{"players":[{"player":"A","characters":[{"name":"Fox","status":-1}]}]},` +
			`{"players":[{"player":"B","characters":[{"name":"Falco","status":-1}]}]}` +
			`]}]`),
	}
	out := NormalizeLiqMatch(m, "smash", "")
	ps := out.Games[0].Participants
	if len(ps) != 2 {
		t.Fatalf("participants = %d, want 2", len(ps))
	}
	for _, p := range ps {
		if p.Extra != nil {
			t.Fatalf("expected no stocks for all-unknown statuses, got %+v", p.Extra)
		}
		if p.Character == "" {
			t.Fatalf("expected fighter name even when stocks unknown: %+v", p)
		}
	}
}
