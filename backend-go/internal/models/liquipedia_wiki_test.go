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

func TestVideogameMapsCoverEveryWiki(t *testing.T) {
	for acronym, wiki := range GameWikiMapping {
		if videogameIDMap[wiki] == 0 {
			t.Errorf("%s: no videogame id for wiki %q", acronym, wiki)
		}
		if videogameNameMap[wiki] == "" {
			t.Errorf("%s: no videogame name for wiki %q", acronym, wiki)
		}
		if videogameSlugMap[wiki] == "" {
			t.Errorf("%s: no videogame slug for wiki %q", acronym, wiki)
		}
	}
}

func TestEASportsFCVideogameKeepsItsStoredSlug(t *testing.T) {
	if got := videogameNameMap["easportsfc"]; got != "EA Sports FC" {
		t.Errorf("name = %q", got)
	}
	// match_subscription.game_acronym already holds this value on mobile.
	if got := videogameSlugMap["easportsfc"]; got != "easportsfc" {
		t.Errorf("slug = %q", got)
	}
	if wiki, ok := ResolveWiki("easportsfc"); !ok || wiki != "easportsfc" {
		t.Errorf("ResolveWiki = %q, %v", wiki, ok)
	}
}
