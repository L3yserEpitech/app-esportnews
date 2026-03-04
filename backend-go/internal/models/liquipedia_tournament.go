package models

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
)

// LiqTournament represents a tournament from the Liquipedia API v3 /tournament endpoint.
// Fields are mapped directly from the Liquipedia response.
type LiqTournament struct {
	PageID             int             `json:"pageid"`
	PageName           string          `json:"pagename"`
	Namespace          int             `json:"namespace"`
	ObjectName         string          `json:"objectname"`
	Name               string          `json:"name"`
	ShortName          string          `json:"shortname"`
	TickerName         string          `json:"tickername"`
	Banner             string          `json:"banner"`
	BannerURL          string          `json:"bannerurl"`
	BannerDark         string          `json:"bannerdark"`
	BannerDarkURL      string          `json:"bannerdarkurl"`
	Icon               string          `json:"icon"`
	IconURL            string          `json:"iconurl"`
	IconDark           string          `json:"icondark"`
	IconDarkURL        string          `json:"icondarkurl"`
	SeriesPage         string          `json:"seriespage"`
	SeriesList         json.RawMessage `json:"serieslist"`
	Previous           string          `json:"previous"`
	Previous2          string          `json:"previous2"`
	Next               string          `json:"next"`
	Next2              string          `json:"next2"`
	Game               string          `json:"game"`
	Mode               string          `json:"mode"`
	Patch              string          `json:"patch"`
	EndPatch           string          `json:"endpatch"`
	Type               string          `json:"type"`
	Organizers         string          `json:"organizers"`
	StartDate          string          `json:"startdate"`
	EndDate            string          `json:"enddate"`
	SortDate           string          `json:"sortdate"`
	Locations          json.RawMessage `json:"locations"`
	PrizePool          json.Number     `json:"prizepool"`
	ParticipantsNumber int             `json:"participantsnumber"`
	LiquipediaTier     string          `json:"liquipediatier"`
	LiquipediaTierType string          `json:"liquipediatiertype"`
	PublisherTier      string          `json:"publishertier"`
	Status             string          `json:"status"`
	Maps               string          `json:"maps"`
	Format             string          `json:"format"`
	Sponsors           string          `json:"sponsors"`
	ExtraData          json.RawMessage `json:"extradata"`
}

// UniqueKey returns a deduplication key for this tournament.
func (t *LiqTournament) UniqueKey() string {
	if t.ObjectName != "" {
		return t.ObjectName
	}
	return t.PageName
}

// ParsedStartDate parses the tournament start date.
func (t *LiqTournament) ParsedStartDate() (time.Time, error) {
	return time.Parse("2006-01-02", t.StartDate)
}

// ParsedEndDate parses the tournament end date.
func (t *LiqTournament) ParsedEndDate() (time.Time, error) {
	return time.Parse("2006-01-02", t.EndDate)
}

// ComputeStatus determines the tournament status based on dates and the status field.
// Returns "running", "upcoming", or "finished".
func (t *LiqTournament) ComputeStatus() string {
	if strings.EqualFold(t.Status, "finished") {
		return "finished"
	}

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	start, errStart := t.ParsedStartDate()
	end, errEnd := t.ParsedEndDate()

	if errStart != nil || errEnd != nil {
		// If we can't parse dates, fall back to status field
		if t.Status != "" {
			return strings.ToLower(t.Status)
		}
		return "upcoming"
	}

	if start.After(today) {
		return "upcoming"
	}
	if (start.Equal(today) || start.Before(today)) && (end.Equal(today) || end.After(today)) {
		return "running"
	}
	// enddate < today and not explicitly finished
	return "finished"
}

// --- Normalization to PandaTournament-compatible JSON ---

// NormalizedTournament is the PandaTournament-shaped struct sent to the frontend.
// It matches the frontend TypeScript PandaTournament interface exactly.
type NormalizedTournament struct {
	ID            int                     `json:"id"`
	Name          string                  `json:"name"`
	Slug          string                  `json:"slug"`
	Status        string                  `json:"status"`
	Type          string                  `json:"type"`
	Tier          string                  `json:"tier"`
	BeginAt       *string                 `json:"begin_at"`
	EndAt         *string                 `json:"end_at"`
	Region        *string                 `json:"region,omitempty"`
	PrizePool     *string                 `json:"prizepool"`
	HasBracket    bool                    `json:"has_bracket"`
	Videogame     *NormalizedVideogame    `json:"videogame,omitempty"`
	League        *NormalizedLeague       `json:"league,omitempty"`
	Teams         []NormalizedTeamCompact `json:"teams"`
	Matches       []NormalizedMatchCompact `json:"matches"`
	ExpectedRoster []interface{}           `json:"expected_roster"`
	WinnerID      *int                    `json:"winner_id"`

	// Extra fields useful for the frontend
	PageName      string                  `json:"pagename,omitempty"`
	BannerURL     string                  `json:"banner_url,omitempty"`
	BannerDarkURL string                  `json:"banner_dark_url,omitempty"`
	IconURL       string                  `json:"icon_url,omitempty"`
	IconDarkURL   string                  `json:"icon_dark_url,omitempty"`
}

type NormalizedVideogame struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type NormalizedLeague struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	URL      *string `json:"url"`
	Slug     string `json:"slug"`
	ImageURL string `json:"image_url"`
}

type NormalizedTeamCompact struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	Acronym  *string `json:"acronym"`
	ImageURL *string `json:"image_url"`
	Template string  `json:"template,omitempty"` // Liquipedia team template/pagename for squad fetching
}

type NormalizedMatchCompact struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Status         *string `json:"status"`
	NumberOfGames  *int    `json:"number_of_games"`
	Live           *struct {
		Supported bool `json:"supported"`
	} `json:"live"`
}

// videogameIDMap maps Liquipedia wiki game names to numeric IDs for the frontend.
var videogameIDMap = map[string]int{
	"valorant":       26,
	"counterstrike":  3,
	"leagueoflegends": 1,
	"dota2":          4,
	"rocketleague":   24,
	"callofduty":     23,
	"rainbowsix":     20,
	"overwatch":      14,
	"fifa":           22,
	"wildrift":       34,
}

// videogameNameMap maps wiki names to display names.
var videogameNameMap = map[string]string{
	"valorant":       "Valorant",
	"counterstrike":  "CS2",
	"leagueoflegends": "League of Legends",
	"dota2":          "Dota 2",
	"rocketleague":   "Rocket League",
	"callofduty":     "Call of Duty",
	"rainbowsix":     "Rainbow Six Siege",
	"overwatch":      "Overwatch",
	"fifa":           "EA FC",
	"wildrift":       "Wild Rift",
}

// videogameSlugMap maps wiki names to slug names (matching frontend).
var videogameSlugMap = map[string]string{
	"valorant":       "valorant",
	"counterstrike":  "cs2",
	"leagueoflegends": "lol",
	"dota2":          "dota2",
	"rocketleague":   "rl",
	"callofduty":     "codmw",
	"rainbowsix":     "r6siege",
	"overwatch":      "ow",
	"fifa":           "fifa",
	"wildrift":       "lol-wild-rift",
}

// mapLiquipediaTier converts Liquipedia numeric tier (1-5, -1) to letter tier (s, a, b, c, d).
func mapLiquipediaTier(liqTier string) string {
	switch liqTier {
	case "1":
		return "s"
	case "2":
		return "a"
	case "3":
		return "b"
	case "4":
		return "c"
	case "5", "-1":
		return "d"
	default:
		return "d"
	}
}

// formatPrizePool converts a numeric prize pool to a formatted string.
// e.g. 1000000 → "$1,000,000", 0 → nil
func formatPrizePool(pp json.Number) *string {
	f, err := pp.Float64()
	if err != nil || f == 0 {
		return nil
	}

	intVal := int64(math.Round(f))
	if intVal <= 0 {
		return nil
	}

	// Format with comma separators
	s := fmt.Sprintf("%d", intVal)
	n := len(s)
	if n <= 3 {
		result := "$" + s
		return &result
	}

	var builder strings.Builder
	builder.WriteString("$")
	remainder := n % 3
	if remainder > 0 {
		builder.WriteString(s[:remainder])
		if n > remainder {
			builder.WriteString(",")
		}
	}
	for i := remainder; i < n; i += 3 {
		if i > remainder {
			builder.WriteString(",")
		}
		builder.WriteString(s[i : i+3])
	}

	result := builder.String()
	return &result
}

// extractRegionFromLocations tries to extract a region string from the locations JSON.
func extractRegionFromLocations(locations json.RawMessage) *string {
	if locations == nil || string(locations) == "null" || string(locations) == "" {
		return nil
	}

	// Locations can be various structures. Try to extract a region/country.
	var locList []map[string]interface{}
	if err := json.Unmarshal(locations, &locList); err == nil && len(locList) > 0 {
		if region, ok := locList[0]["region"].(string); ok && region != "" {
			return &region
		}
		if country, ok := locList[0]["country"].(string); ok && country != "" {
			return &country
		}
	}

	return nil
}

// pageNameToSlug converts a Liquipedia page name to a URL-friendly slug.
func pageNameToSlug(pageName string) string {
	slug := strings.ReplaceAll(pageName, " ", "_")
	slug = strings.ReplaceAll(slug, "/", "_")
	return strings.ToLower(slug)
}

// NormalizeLiqTournament converts a Liquipedia tournament to a PandaTournament-shaped struct.
// wiki is the Liquipedia wiki name used for the query (e.g. "valorant").
func NormalizeLiqTournament(t LiqTournament, wiki string) NormalizedTournament {
	status := t.ComputeStatus()

	// Build begin_at / end_at as ISO 8601
	var beginAt, endAt *string
	if t.StartDate != "" {
		iso := t.StartDate + "T00:00:00Z"
		beginAt = &iso
	}
	if t.EndDate != "" {
		iso := t.EndDate + "T00:00:00Z"
		endAt = &iso
	}

	// Videogame info
	var vg *NormalizedVideogame
	if wiki != "" {
		vgID := videogameIDMap[wiki]
		vgName := videogameNameMap[wiki]
		vgSlug := videogameSlugMap[wiki]
		if vgName == "" {
			vgName = wiki
		}
		if vgSlug == "" {
			vgSlug = wiki
		}
		vg = &NormalizedVideogame{
			ID:   vgID,
			Name: vgName,
			Slug: vgSlug,
		}
	}

	// League info: use series page as the "league"
	var league *NormalizedLeague
	if t.SeriesPage != "" {
		league = &NormalizedLeague{
			ID:       t.PageID,
			Name:     t.SeriesPage,
			Slug:     pageNameToSlug(t.SeriesPage),
			ImageURL: t.IconURL,
		}
	}

	// Prize pool formatting
	prizePool := formatPrizePool(t.PrizePool)

	// Region from locations
	region := extractRegionFromLocations(t.Locations)

	// Name: prefer name, fallback to shortname then tickername
	name := t.Name
	if name == "" {
		name = t.ShortName
	}
	if name == "" {
		name = t.TickerName
	}
	if name == "" {
		name = t.PageName
	}

	return NormalizedTournament{
		ID:             t.PageID,
		Name:           name,
		Slug:           pageNameToSlug(t.PageName),
		Status:         status,
		Type:           t.Type,
		Tier:           mapLiquipediaTier(t.LiquipediaTier),
		BeginAt:        beginAt,
		EndAt:          endAt,
		Region:         region,
		PrizePool:      prizePool,
		HasBracket:     true,
		Videogame:      vg,
		League:         league,
		Teams:          []NormalizedTeamCompact{},
		Matches:        []NormalizedMatchCompact{},
		ExpectedRoster: []interface{}{},
		WinnerID:       nil,
		PageName:       t.PageName,
		BannerURL:      t.BannerURL,
		BannerDarkURL:  t.BannerDarkURL,
		IconURL:        t.IconURL,
		IconDarkURL:    t.IconDarkURL,
	}
}

// --- Enriched tournament detail (used by GET /tournaments/:id) ---

// EnrichedTournamentDetail extends NormalizedTournament with full match data
// and roster info. In Go JSON, outer fields shadow the embedded struct's
// Matches/Teams/ExpectedRoster fields.
type EnrichedTournamentDetail struct {
	NormalizedTournament
	Matches        []NormalizedMatch        `json:"matches"`
	ExpectedRoster []NormalizedRosterEntry   `json:"expected_roster"`
	Teams          []NormalizedTeamCompact   `json:"teams"`
}

// NormalizedRosterEntry matches the frontend PandaRoster interface.
type NormalizedRosterEntry struct {
	Team    *NormalizedRosterTeam    `json:"team"`
	Players []NormalizedRosterPlayer `json:"players"`
}

// NormalizedRosterTeam matches the frontend PandaTeam for roster display.
type NormalizedRosterTeam struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	Acronym  *string `json:"acronym"`
	ImageURL *string `json:"image_url"`
	Location *string `json:"location,omitempty"`
}

// NormalizedRosterPlayer matches the frontend PandaPlayer for roster display.
type NormalizedRosterPlayer struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Active      bool    `json:"active"`
	Role        *string `json:"role,omitempty"`
	ImageURL    *string `json:"image_url,omitempty"`
	FirstName   *string `json:"first_name,omitempty"`
	LastName    *string `json:"last_name,omitempty"`
	Nationality *string `json:"nationality,omitempty"`
}

// ExtractTeamsAndRostersFromMatches extracts unique teams from match opponents
// and builds roster entries. Players are empty (fetching squads would cost
// N additional API calls).
func ExtractTeamsAndRostersFromMatches(matches []NormalizedMatch) ([]NormalizedTeamCompact, []NormalizedRosterEntry) {
	seen := make(map[int]bool)
	var teams []NormalizedTeamCompact
	var rosters []NormalizedRosterEntry

	for _, m := range matches {
		for _, opp := range m.Opponents {
			if opp.Opponent == nil || opp.Opponent.ID == 0 || seen[opp.Opponent.ID] {
				continue
			}
			seen[opp.Opponent.ID] = true
			teams = append(teams, *opp.Opponent)

			rosterTeam := &NormalizedRosterTeam{
				ID:       opp.Opponent.ID,
				Name:     opp.Opponent.Name,
				Slug:     opp.Opponent.Slug,
				Acronym:  opp.Opponent.Acronym,
				ImageURL: opp.Opponent.ImageURL,
			}
			rosters = append(rosters, NormalizedRosterEntry{
				Team:    rosterTeam,
				Players: []NormalizedRosterPlayer{},
			})
		}
	}

	if teams == nil {
		teams = []NormalizedTeamCompact{}
	}
	if rosters == nil {
		rosters = []NormalizedRosterEntry{}
	}

	return teams, rosters
}

// NormalizeLiqTournaments normalizes a slice of Liquipedia tournaments.
func NormalizeLiqTournaments(tournaments []LiqTournament, wiki string) []NormalizedTournament {
	result := make([]NormalizedTournament, 0, len(tournaments))
	seen := make(map[string]bool)

	for _, t := range tournaments {
		key := t.UniqueKey()
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, NormalizeLiqTournament(t, wiki))
	}

	return result
}
