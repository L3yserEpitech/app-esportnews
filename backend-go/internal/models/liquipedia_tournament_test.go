package models

import (
	"encoding/json"
	"reflect"
	"testing"
)

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

// Payloads verbatim from the API (2026-11-14): Worlds 2026, a single venue, a
// venue still to be announced and a country-only entry.
func TestExtractVenues(t *testing.T) {
	worlds := json.RawMessage(`{"city2":"Allen","venuelink3":"https:\/\/www.barclayscenter.com\/","venue3":"Barclays Center","region3":"North America","region1":"North America","country2":"us","venue1":"Riot Games Arena","country3":"us","venue2":"Credit Union of Texas Event Center","city3":"New York City","country1":"us","region2":"North America","city1":"Los Angeles"}`)
	got := extractVenues(worlds)
	want := []NormalizedVenue{
		{Name: "Riot Games Arena", City: "Los Angeles", Country: "us"},
		{Name: "Credit Union of Texas Event Center", City: "Allen", Country: "us"},
		{Name: "Barclays Center", City: "New York City", Country: "us"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("worlds: got %+v", got)
	}

	tba := json.RawMessage(`{"city1":"<abbr title=\"To be announced\">TBA<\/abbr>","region1":"Europe"}`)
	if v := extractVenues(tba); v != nil {
		t.Errorf("TBA: got %+v", v)
	}
	if v := extractVenues(json.RawMessage(`{"region1":"China","country1":"cn"}`)); v != nil {
		t.Errorf("country only: got %+v", v)
	}
	if v := extractVenues(nil); v != nil {
		t.Errorf("nil: got %+v", v)
	}
	if v := extractVenues(json.RawMessage(`[]`)); v != nil {
		t.Errorf("array: got %+v", v)
	}
}
