package models

import "testing"

func TestNormalizeLiqMatch_MatchLevelExtras(t *testing.T) {
	m := LiqMatch{
		PageID:          42,
		Date:            "2026-06-01 18:00:00",
		Finished:        1,
		Winner:          "1",
		BestOf:          3,
		Vod:             "https://youtu.be/vod1",
		Patch:           "14.11",
		ExtraData:       []byte(`{"mvp":"Faker"}`),
		Links:           []byte(`{"dotabuff":"https://dotabuff.com/x","stratz":"https://stratz.com/y"}`),
		Match2Opponents: []byte(`[{"name":"T1","template":"t1","score":2},{"name":"GEN","template":"gen","score":1}]`),
	}
	out := NormalizeLiqMatch(m, "leagueoflegends", "finished")

	if out.Vod == nil || *out.Vod != "https://youtu.be/vod1" {
		t.Fatalf("vod = %v, want https://youtu.be/vod1", out.Vod)
	}
	if out.Patch == nil || *out.Patch != "14.11" {
		t.Fatalf("patch = %v, want 14.11", out.Patch)
	}
	if out.Mvp == nil || *out.Mvp != "Faker" {
		t.Fatalf("mvp = %v, want Faker", out.Mvp)
	}
	if out.Links["dotabuff"] != "https://dotabuff.com/x" || out.Links["stratz"] != "https://stratz.com/y" {
		t.Fatalf("links = %v", out.Links)
	}
}

func TestNormalizeLiqMatch_NoExtras(t *testing.T) {
	m := LiqMatch{
		PageID:          1,
		Date:            "2026-06-01 18:00:00",
		Match2Opponents: []byte(`[{"name":"A","template":"a"},{"name":"B","template":"b"}]`),
	}
	out := NormalizeLiqMatch(m, "valorant", "")
	if out.Vod != nil || out.Patch != nil || out.Mvp != nil || out.Links != nil {
		t.Fatalf("expected all nil extras, got vod=%v patch=%v mvp=%v links=%v", out.Vod, out.Patch, out.Mvp, out.Links)
	}
}
