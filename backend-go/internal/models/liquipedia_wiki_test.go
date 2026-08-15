package models

import "testing"

// The mobile app stores match_subscription.game_acronym from videogame.slug,
// which is not the acronym for every game — resolving both shapes is what keeps
// counterstrike subscriptions from being dropped as "unknown game".
func TestResolveWiki(t *testing.T) {
	cases := []struct {
		in       string
		wantWiki string
		wantOK   bool
	}{
		{"csgo", "counterstrike", true},
		{"cs2", "counterstrike", true},
		{"counterstrike", "counterstrike", true},
		{"valorant", "valorant", true},
		{"fifa", "easportsfc", true},
		{"easportsfc", "easportsfc", true},
		{"mlbb", "mobilelegends", true},
		{"mobilelegends", "mobilelegends", true},
		{"", "", false},
		{"pandascore", "", false},
	}

	for _, tc := range cases {
		wiki, ok := ResolveWiki(tc.in)
		if wiki != tc.wantWiki || ok != tc.wantOK {
			t.Errorf("ResolveWiki(%q) = (%q, %v), want (%q, %v)", tc.in, wiki, ok, tc.wantWiki, tc.wantOK)
		}
	}
}
