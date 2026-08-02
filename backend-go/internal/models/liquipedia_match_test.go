package models

import (
	"encoding/json"
	"testing"
)

func TestNormalizeMatchGamesExposesParticipantsAndExtradata(t *testing.T) {
	games := `[{
		"map": "",
		"winner": "2",
		"scores": ["0","1"],
		"participants": {
			"1_1": {"character":"K'Sante","player":"Jaehyuk","role":"top","kills":"2","deaths":"4","assists":"6"},
			"2_1": {"agent":"Viper","player":"Sayonara","kills":16,"deaths":13,"assists":2,"acs":200.7,"adr":121}
		},
		"extradata": {"team1ban1":"Varus","team1champion1":"K'Sante","team1side":"blue"}
	}]`

	m := LiqMatch{
		PageID:      10,
		Match2Games: json.RawMessage(games),
	}

	out := NormalizeLiqMatch(m, "leagueoflegends", "finished")
	if len(out.Games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(out.Games))
	}
	g := out.Games[0]

	if len(g.Participants) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(g.Participants))
	}

	byPlayer := map[string]NormalizedParticipant{}
	for _, p := range g.Participants {
		byPlayer[p.Player] = p
	}

	jae, ok := byPlayer["Jaehyuk"]
	if !ok {
		t.Fatal("missing participant Jaehyuk")
	}
	if jae.Team != 1 || jae.Character != "K'Sante" || jae.Role != "top" {
		t.Errorf("Jaehyuk team/character/role wrong: %+v", jae)
	}
	if jae.Kills == nil || *jae.Kills != 2 || jae.Deaths == nil || *jae.Deaths != 4 || jae.Assists == nil || *jae.Assists != 6 {
		t.Errorf("Jaehyuk KDA wrong: %+v", jae)
	}

	say, ok := byPlayer["Sayonara"]
	if !ok {
		t.Fatal("missing participant Sayonara")
	}
	if say.Team != 2 || say.Character != "Viper" {
		t.Errorf("Sayonara team/agent wrong: %+v", say)
	}
	if say.Kills == nil || *say.Kills != 16 {
		t.Errorf("Sayonara kills wrong: %+v", say)
	}
	if say.Extra == nil || say.Extra["acs"] == nil || say.Extra["adr"] == nil {
		t.Errorf("Sayonara extra (acs/adr) missing: %+v", say.Extra)
	}

	if g.ExtraData == nil || g.ExtraData["team1ban1"] != "Varus" {
		t.Errorf("game extradata draft missing: %+v", g.ExtraData)
	}
}

func TestNormalizeMatchGamesSkipsEmptyLiveParticipants(t *testing.T) {
	games := `[{"map":"","participants":{"1_1":[],"2_1":[]}}]`
	m := LiqMatch{PageID: 1, Match2Games: json.RawMessage(games)}
	out := NormalizeLiqMatch(m, "leagueoflegends", "running")
	if len(out.Games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(out.Games))
	}
	if len(out.Games[0].Participants) != 0 {
		t.Errorf("expected 0 participants for empty live placeholders, got %d", len(out.Games[0].Participants))
	}
}
