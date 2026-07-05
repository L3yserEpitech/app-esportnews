package handlers

import (
	"testing"

	"github.com/esportnews/backend/internal/models"
)

func liqMatch(objectName, date string) models.LiqMatch {
	return models.LiqMatch{ObjectName: objectName, Date: date}
}

func TestFilterLiqMatchesByDate(t *testing.T) {
	matches := []models.LiqMatch{
		liqMatch("m1", "2026-07-06 00:00:00"),
		liqMatch("m2", "2026-07-06 23:59:59"),
		liqMatch("m3", "2026-07-07 00:00:00"),
		liqMatch("m4", "2026-07-05 12:00:00"),
		liqMatch("m2", "2026-07-06 23:59:59"), // duplicate across poller caches
		liqMatch("m5", "invalid"),
	}

	got := filterLiqMatchesByDate(matches, "2026-07-06")

	if len(got) != 2 {
		t.Fatalf("expected 2 matches, got %d", len(got))
	}
	if got[0].ObjectName != "m1" || got[1].ObjectName != "m2" {
		t.Fatalf("unexpected matches: %s, %s", got[0].ObjectName, got[1].ObjectName)
	}
}

func TestFilterLiqMatchesByDateEmpty(t *testing.T) {
	got := filterLiqMatchesByDate(nil, "2026-07-06")
	if got == nil || len(got) != 0 {
		t.Fatalf("expected empty non-nil slice, got %v", got)
	}
}

func tournament(pageName, begin, end string) models.NormalizedTournament {
	t := models.NormalizedTournament{PageName: pageName}
	if begin != "" {
		b := begin + "T00:00:00Z"
		t.BeginAt = &b
	}
	if end != "" {
		e := end + "T00:00:00Z"
		t.EndAt = &e
	}
	return t
}

func TestFilterTournamentsActiveOn(t *testing.T) {
	tournaments := []models.NormalizedTournament{
		tournament("spans", "2026-07-01", "2026-07-10"),
		tournament("starts_on_day", "2026-07-06", "2026-07-08"),
		tournament("ends_on_day", "2026-07-01", "2026-07-06"),
		tournament("single_day", "2026-07-06", "2026-07-06"),
		tournament("before", "2026-06-01", "2026-06-10"),
		tournament("after", "2026-07-07", "2026-07-12"),
		tournament("no_dates", "", ""),
		tournament("spans", "2026-07-01", "2026-07-10"), // duplicate across poller caches
	}

	got := filterTournamentsActiveOn(tournaments, "2026-07-06")

	if len(got) != 4 {
		t.Fatalf("expected 4 tournaments, got %d", len(got))
	}
	want := []string{"spans", "starts_on_day", "ends_on_day", "single_day"}
	for i, w := range want {
		if got[i].PageName != w {
			t.Fatalf("expected %s at index %d, got %s", w, i, got[i].PageName)
		}
	}
}
