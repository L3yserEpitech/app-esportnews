package models

import "testing"

// Payloads below are verbatim match2bracketdata captured from Liquipedia API v3
// (dota2 Esports_World_Cup/2026/Western_Europe and counterstrike CCT/2026/Europe/Series_5).

func TestNormalizeLiqMatch_BracketData_Tree(t *testing.T) {
	m := LiqMatch{
		PageID:          1,
		Date:            "2026-05-31 10:00:00",
		Match2Opponents: []byte(`[{"name":"A","template":"a"},{"name":"B","template":"b"}]`),
		Match2BracketData: []byte(`{"loweredges":[{"opponentIndex":0,"lowerMatchIndex":0},{"opponentIndex":1,"lowerMatchIndex":1}],` +
			`"coordinates":{"sectionIndex":0,"depthCount":4,"matchIndexInRound":0,"roundIndex":3,"rootIndex":0,` +
			`"semanticDepth":1,"semanticRoundIndex":3,"depth":0,"roundCount":4,"sectionCount":2},` +
			`"bracketsection":"upper","lowerMatchIds":["WbGKIadK25_R02-M001","WbGKIadK25_R02-M002"],` +
			`"toupper":"WbGKIadK25_R02-M001","bracketindex":9,"header":"!u2!x","type":"bracket",` +
			`"bracketType":"Bracket/16","tolower":"WbGKIadK25_R02-M002","thirdplace":""}`),
	}
	out := NormalizeLiqMatch(m, "dota2", "finished")

	bd := out.BracketData
	if bd == nil {
		t.Fatal("bracket_data is nil")
	}
	if bd.Type != "bracket" {
		t.Fatalf("type = %q, want bracket", bd.Type)
	}
	if bd.BracketSection != "upper" {
		t.Fatalf("bracket_section = %q, want upper", bd.BracketSection)
	}
	if bd.BracketIndex != 9 {
		t.Fatalf("bracket_index = %d, want 9", bd.BracketIndex)
	}
	if len(bd.LowerMatchIDs) != 2 || bd.LowerMatchIDs[0] != "WbGKIadK25_R02-M001" {
		t.Fatalf("lower_match_ids = %v", bd.LowerMatchIDs)
	}
	c := bd.Coordinates
	if c == nil {
		t.Fatal("coordinates is nil")
	}
	if c.RoundIndex != 3 || c.MatchIndexInRound != 0 || c.RoundCount != 4 || c.SectionIndex != 0 || c.SectionCount != 2 {
		t.Fatalf("coordinates = %+v", *c)
	}
}

func TestNormalizeLiqMatch_BracketData_MatchList(t *testing.T) {
	m := LiqMatch{
		PageID:          2,
		Date:            "2026-07-25 08:00:00",
		Match2Opponents: []byte(`[{"name":"A","template":"a"},{"name":"B","template":"b"}]`),
		Match2BracketData: []byte(`{"groupRoundIndex":3,"inheritedheader":"July 25, 2026","title":"Round 3 Low Matches",` +
			`"next":"wCFxgw4ieC_0002","matchIndex":1,"bracketindex":5,"type":"matchlist","header":"July 25, 2026"}`),
	}
	out := NormalizeLiqMatch(m, "counterstrike", "finished")

	bd := out.BracketData
	if bd == nil {
		t.Fatal("bracket_data is nil")
	}
	if bd.Type != "matchlist" {
		t.Fatalf("type = %q, want matchlist", bd.Type)
	}
	if bd.Title != "Round 3 Low Matches" {
		t.Fatalf("title = %q", bd.Title)
	}
	if bd.MatchIndex != 1 || bd.BracketIndex != 5 {
		t.Fatalf("match_index = %d, bracket_index = %d", bd.MatchIndex, bd.BracketIndex)
	}
	if bd.Coordinates != nil {
		t.Fatalf("matchlist entries carry no coordinates, got %+v", *bd.Coordinates)
	}
}

func TestNormalizeLiqMatch_BracketData_Absent(t *testing.T) {
	m := LiqMatch{
		PageID:          3,
		Date:            "2026-06-01 18:00:00",
		Match2Opponents: []byte(`[{"name":"A","template":"a"},{"name":"B","template":"b"}]`),
	}
	if out := NormalizeLiqMatch(m, "valorant", ""); out.BracketData != nil {
		t.Fatalf("expected nil bracket_data, got %+v", *out.BracketData)
	}
}
