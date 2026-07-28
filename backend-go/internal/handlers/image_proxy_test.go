package handlers

import "testing"

func TestValidateImageURL(t *testing.T) {
	cases := []struct {
		name   string
		url    string
		wantOK bool
	}{
		{"commons thumb", "https://liquipedia.net/commons/images/thumb/a/ab/Logo.png/48px-Logo.png", true},
		{"commons original", "https://liquipedia.net/commons/images/a/ab/Logo.png", true},
		{"commons with wiki hint", "https://liquipedia.net/commons/images/a/ab/Logo.png?w=valorant", true},
		{"www host commons", "https://www.liquipedia.net/commons/images/a/ab/Logo.png", true},
		// The ban trigger: wiki PAGE URLs must be rejected (never fetched).
		{"wiki page", "https://liquipedia.net/leagueoflegends/Hextech_Series_Division_2", false},
		{"wiki page root", "https://liquipedia.net/valorant/VCT", false},
		{"special filepath rejected", "https://liquipedia.net/commons/Special:FilePath/Foo.png", false}, // PHP redirect, not static media
		{"disallowed host", "https://example.com/commons/images/x.png", false},
		{"not https", "http://liquipedia.net/commons/images/x.png", false},
		{"no path", "https://liquipedia.net", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			key, ok := validateImageURL(c.url)
			if ok != c.wantOK {
				t.Fatalf("validateImageURL(%q) ok=%v, want %v", c.url, ok, c.wantOK)
			}
			if ok && key == "" {
				t.Fatalf("validateImageURL(%q) returned ok but empty cache key", c.url)
			}
		})
	}
}
