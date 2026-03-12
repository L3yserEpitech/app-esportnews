package models

import (
	"encoding/json"
	"strings"
	"time"
)

// --- Liquipedia API v3 raw structs ---

// LiqTeam represents a team from the Liquipedia API v3 /team endpoint.
type LiqTeam struct {
	PageID              int             `json:"pageid"`
	PageName            string          `json:"pagename"`
	Namespace           int             `json:"namespace"`
	ObjectName          string          `json:"objectname"`
	Name                string          `json:"name"`
	Locations           json.RawMessage `json:"locations"`
	Region              string          `json:"region"`
	Logo                string          `json:"logo"`
	LogoURL             string          `json:"logourl"`
	LogoDark            string          `json:"logodark"`
	LogoDarkURL         string          `json:"logodarkurl"`
	TextlessLogoURL     string          `json:"textlesslogourl"`
	TextlessLogoDarkURL string          `json:"textlesslogodarkurl"`
	Status              string          `json:"status"`
	CreateDate          string          `json:"createdate"`
	DisbandDate         string          `json:"disbanddate"`
	Earnings            json.Number     `json:"earnings"`
	EarningsByYear      json.RawMessage `json:"earningsbyyear"`
	Template            string          `json:"template"`
	Links               json.RawMessage `json:"links"`
	ExtraData           json.RawMessage `json:"extradata"`
}

// UniqueKey returns a deduplication key for this team.
func (t *LiqTeam) UniqueKey() string {
	if t.ObjectName != "" {
		return t.ObjectName
	}
	return t.PageName
}

// LiqSquadPlayer represents a player from the Liquipedia API v3 /squadplayer endpoint.
type LiqSquadPlayer struct {
	PageName        string          `json:"pagename"`
	Namespace       int             `json:"namespace"`
	ObjectName      string          `json:"objectname"`
	ID              string          `json:"id"`
	Link            string          `json:"link"`
	Name            string          `json:"name"`
	Nationality     string          `json:"nationality"`
	Position        string          `json:"position"`
	Role            string          `json:"role"`
	Type            string          `json:"type"`
	NewTeam         string          `json:"newteam"`
	TeamTemplate    string          `json:"teamtemplate"`
	NewTeamTemplate string          `json:"newteamtemplate"`
	Status          string          `json:"status"`
	JoinDate        string          `json:"joindate"`
	JoinDateRef     json.RawMessage `json:"joindateref"`
	LeaveDate       string          `json:"leavedate"`
	LeaveDateRef    json.RawMessage `json:"leavedateref"`
	InactiveDate    string          `json:"inactivedate"`
	InactiveDateRef json.RawMessage `json:"inactivedateref"`
	ExtraData       json.RawMessage `json:"extradata"`
}

// UniqueKey returns a deduplication key for this squad entry.
func (sp *LiqSquadPlayer) UniqueKey() string {
	return sp.ObjectName
}

// --- Normalized structs (PandaTeam/PandaPlayer-compatible) ---

// NormalizedTeam matches the frontend Team interface from teamService.ts.
type NormalizedTeam struct {
	ID               int                 `json:"id"`
	Name             string              `json:"name"`
	Location         string              `json:"location"`
	Slug             string              `json:"slug"`
	Players          []NormalizedPlayer   `json:"players"`
	ModifiedAt       string              `json:"modified_at"`
	Acronym          string              `json:"acronym"`
	ImageURL         string              `json:"image_url"`
	DarkModeImageURL *string             `json:"dark_mode_image_url"`
	CurrentVideogame *NormalizedVideogame `json:"current_videogame,omitempty"`
}

// NormalizedPlayer matches the frontend Player interface from teamService.ts.
type NormalizedPlayer struct {
	Active      bool    `json:"active"`
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Role        *string `json:"role"`
	Slug        string  `json:"slug"`
	ModifiedAt  string  `json:"modified_at"`
	Age         *int    `json:"age"`
	Birthday    *string `json:"birthday"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Nationality string  `json:"nationality"`
	ImageURL    string  `json:"image_url"`
}

// --- Normalization functions ---

// NormalizeLiqTeam converts a Liquipedia team to a frontend-compatible NormalizedTeam.
// players can be nil if not fetched yet.
func NormalizeLiqTeam(t LiqTeam, wiki string, players []NormalizedPlayer) NormalizedTeam {
	if players == nil {
		players = []NormalizedPlayer{}
	}

	// Derive acronym from template (often lowercase acronym like "fnatic", "tl")
	acronym := strings.ToUpper(t.Template)
	if acronym == "" {
		// Fallback: take first 3 chars of name
		if len(t.Name) >= 3 {
			acronym = strings.ToUpper(t.Name[:3])
		} else {
			acronym = strings.ToUpper(t.Name)
		}
	}

	// Location: prefer region, fallback to locations JSON
	location := t.Region
	if location == "" {
		loc := extractRegionFromLocations(t.Locations)
		if loc != nil {
			location = *loc
		}
	}

	// Dark mode logo
	var darkURL *string
	if t.LogoDarkURL != "" {
		darkURL = &t.LogoDarkURL
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

	return NormalizedTeam{
		ID:               t.PageID,
		Name:             t.Name,
		Location:         location,
		Slug:             pageNameToSlug(t.PageName),
		Players:          players,
		ModifiedAt:       time.Now().UTC().Format(time.RFC3339),
		Acronym:          acronym,
		ImageURL:         t.LogoURL,
		DarkModeImageURL: darkURL,
		CurrentVideogame: vg,
	}
}

// NormalizeLiqSquadPlayer converts a Liquipedia squad player to a frontend-compatible NormalizedPlayer.
func NormalizeLiqSquadPlayer(sp LiqSquadPlayer) NormalizedPlayer {
	isActive := strings.EqualFold(sp.Status, "active") && sp.Type == "player"

	// Split real name into first/last
	firstName, lastName := splitName(sp.Name)

	// Role: use role field; for actual players it will be "player"
	var role *string
	if sp.Role != "" {
		r := sp.Role
		role = &r
	}

	// Use a stable numeric ID from the objectname hash
	playerID := hashStringToInt(sp.Link)
	if playerID == 0 {
		playerID = hashStringToInt(sp.ID)
	}

	return NormalizedPlayer{
		Active:      isActive,
		ID:          playerID,
		Name:        sp.ID, // IGN / pseudo
		Role:        role,
		Slug:        pageNameToSlug(sp.Link),
		ModifiedAt:  time.Now().UTC().Format(time.RFC3339),
		Age:         nil, // Not available from squadplayer endpoint
		Birthday:    nil, // Not available from squadplayer endpoint
		FirstName:   firstName,
		LastName:    lastName,
		Nationality: sp.Nationality,
		ImageURL:    "", // Not available from squadplayer endpoint
	}
}

// NormalizeLiqSquadPlayers normalizes a slice of squad players with deduplication.
// Only current roster members (type=player, status != former) are included.
func NormalizeLiqSquadPlayers(players []LiqSquadPlayer) []NormalizedPlayer {
	result := make([]NormalizedPlayer, 0, len(players))
	seen := make(map[string]bool)

	for _, sp := range players {
		// Only include players (not staff, coaches, etc.)
		if sp.Type != "player" {
			continue
		}
		// Exclude former players — only keep active and inactive roster members
		if strings.EqualFold(sp.Status, "former") {
			continue
		}

		key := sp.UniqueKey()
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, NormalizeLiqSquadPlayer(sp))
	}

	return result
}

// --- Enriched team detail structs ---

// TeamLinks represents parsed social media links from the team's links JSON.
type TeamLinks struct {
	Website   string `json:"website,omitempty"`
	Twitter   string `json:"twitter,omitempty"`
	Facebook  string `json:"facebook,omitempty"`
	Instagram string `json:"instagram,omitempty"`
	YouTube   string `json:"youtube,omitempty"`
	Discord   string `json:"discord,omitempty"`
	Twitch    string `json:"twitch,omitempty"`
}

// EnrichedTeamDetail is the comprehensive team detail response.
// Returned by GET /api/teams/:id/detail.
type EnrichedTeamDetail struct {
	// Base team fields (backward compatible with NormalizedTeam)
	ID               int                 `json:"id"`
	Name             string              `json:"name"`
	Location         string              `json:"location"`
	Slug             string              `json:"slug"`
	ModifiedAt       string              `json:"modified_at"`
	Acronym          string              `json:"acronym"`
	ImageURL         string              `json:"image_url"`
	DarkModeImageURL *string             `json:"dark_mode_image_url"`
	CurrentVideogame *NormalizedVideogame `json:"current_videogame,omitempty"`

	// Enriched team fields from LiqTeam
	Status              string            `json:"status"`
	CreateDate          *string           `json:"create_date,omitempty"`
	DisbandDate         *string           `json:"disband_date,omitempty"`
	Earnings            *string           `json:"earnings,omitempty"`
	EarningsByYear      map[string]string `json:"earnings_by_year,omitempty"`
	Links               *TeamLinks        `json:"links,omitempty"`
	TextlessLogoURL     string            `json:"textless_logo_url,omitempty"`
	TextlessLogoDarkURL string            `json:"textless_logo_dark_url,omitempty"`
	Region              string            `json:"region,omitempty"`
	Wiki                string            `json:"wiki,omitempty"`
	Template            string            `json:"template,omitempty"`

	// Roster from /squadplayer
	Players []NormalizedPlayer `json:"players"`
}

// NormalizeLiqTeamDetail converts a Liquipedia team to an enriched detail response.
func NormalizeLiqTeamDetail(t LiqTeam, wiki string, players []NormalizedPlayer) EnrichedTeamDetail {
	if players == nil {
		players = []NormalizedPlayer{}
	}

	// Reuse base team normalization for shared fields
	base := NormalizeLiqTeam(t, wiki, players)

	// Parse optional date fields
	var createDate *string
	if t.CreateDate != "" {
		createDate = &t.CreateDate
	}
	var disbandDate *string
	if t.DisbandDate != "" {
		disbandDate = &t.DisbandDate
	}

	return EnrichedTeamDetail{
		// Base fields
		ID:               base.ID,
		Name:             base.Name,
		Location:         base.Location,
		Slug:             base.Slug,
		ModifiedAt:       base.ModifiedAt,
		Acronym:          base.Acronym,
		ImageURL:         base.ImageURL,
		DarkModeImageURL: base.DarkModeImageURL,
		CurrentVideogame: base.CurrentVideogame,
		Players:          base.Players,

		// Enriched fields
		Status:              t.Status,
		CreateDate:          createDate,
		DisbandDate:         disbandDate,
		Earnings:            formatPrizePool(t.Earnings),
		EarningsByYear:      ParseEarningsByYear(t.EarningsByYear),
		Links:               ParseTeamLinks(t.Links),
		TextlessLogoURL:     t.TextlessLogoURL,
		TextlessLogoDarkURL: t.TextlessLogoDarkURL,
		Region:              t.Region,
		Wiki:                wiki,
		Template:            t.Template,
	}
}

// ParseTeamLinks parses the raw links JSON from Liquipedia into a TeamLinks struct.
func ParseTeamLinks(raw json.RawMessage) *TeamLinks {
	if raw == nil || string(raw) == "null" || string(raw) == "" || string(raw) == "[]" {
		return nil
	}

	// Liquipedia links can be a flat object: {"twitter": "url", "website": "url", ...}
	var linksMap map[string]string
	if err := json.Unmarshal(raw, &linksMap); err != nil {
		return nil
	}

	if len(linksMap) == 0 {
		return nil
	}

	links := &TeamLinks{
		Website:   linksMap["website"],
		Twitter:   linksMap["twitter"],
		Facebook:  linksMap["facebook"],
		Instagram: linksMap["instagram"],
		YouTube:   linksMap["youtube"],
		Discord:   linksMap["discord"],
		Twitch:    linksMap["twitch"],
	}

	// Return nil if all fields are empty
	if links.Website == "" && links.Twitter == "" && links.Facebook == "" &&
		links.Instagram == "" && links.YouTube == "" && links.Discord == "" && links.Twitch == "" {
		return nil
	}

	return links
}

// ParseEarningsByYear parses the raw earningsbyyear JSON into a formatted map.
// Input: {"2024": 500000, "2023": 300000} → Output: {"2024": "$500,000", "2023": "$300,000"}
func ParseEarningsByYear(raw json.RawMessage) map[string]string {
	if raw == nil || string(raw) == "null" || string(raw) == "" || string(raw) == "{}" {
		return nil
	}

	var yearMap map[string]json.Number
	if err := json.Unmarshal(raw, &yearMap); err != nil {
		return nil
	}

	if len(yearMap) == 0 {
		return nil
	}

	result := make(map[string]string, len(yearMap))
	for year, amount := range yearMap {
		formatted := formatPrizePool(amount)
		if formatted != nil {
			result[year] = *formatted
		} else {
			// Include year even if earnings are 0
			result[year] = "$0"
		}
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

// TeamMatchesResponse is the response for GET /api/teams/:id/matches.
type TeamMatchesResponse struct {
	Recent   []NormalizedMatch `json:"recent"`
	Upcoming []NormalizedMatch `json:"upcoming"`
}

// --- Placement structs ---

// LiqPlacement represents a placement entry from the Liquipedia API v3 /placement endpoint.
type LiqPlacement struct {
	PageID               int             `json:"pageid"`
	PageName             string          `json:"pagename"`
	ObjectName           string          `json:"objectname"`
	Tournament           string          `json:"tournament"`
	Series               string          `json:"series"`
	Parent               string          `json:"parent"`
	ImageURL             string          `json:"imageurl"`
	ImageDarkURL         string          `json:"imagedarkurl"`
	StartDate            string          `json:"startdate"`
	Date                 string          `json:"date"`
	Placement            string          `json:"placement"`
	PrizeMoney           float64         `json:"prizemoney"`
	IndividualPrizeMoney float64         `json:"individualprizemoney"`
	PrizePoolIndex       int             `json:"prizepoolindex"`
	Weight               float64         `json:"weight"`
	Mode                 string          `json:"mode"`
	Type                 string          `json:"type"`
	LiquipediaTier       string          `json:"liquipediatier"`
	LiquipediaTierType   string          `json:"liquipediatiertype"`
	PublisherTier        string          `json:"publishertier"`
	IconURL              string          `json:"iconurl"`
	IconDarkURL          string          `json:"icondarkurl"`
	Game                 string          `json:"game"`
	LastVsData           json.RawMessage `json:"lastvsdata"`
	OpponentName         string          `json:"opponentname"`
	OpponentTemplate     string          `json:"opponenttemplate"`
	OpponentType         string          `json:"opponenttype"`
	Qualifier            string          `json:"qualifier"`
	Wiki                 string          `json:"wiki"`
}

// NormalizedPlacement is the frontend-ready placement object.
type NormalizedPlacement struct {
	Tournament     string  `json:"tournament"`
	TournamentPage string  `json:"tournament_page"`
	Placement      string  `json:"placement"`
	Date           string  `json:"date"`
	PrizeMoney     float64 `json:"prize_money"`
	Tier           string  `json:"tier"`
	TierType       string  `json:"tier_type"`
	Type           string  `json:"type"`
	IconURL        string  `json:"icon_url"`
	IconDarkURL    string  `json:"icon_dark_url"`
	LastVsName     string  `json:"last_vs_name,omitempty"`
	LastVsScore    *int    `json:"last_vs_score,omitempty"`
}

// NormalizeLiqPlacement converts a raw Liquipedia placement to a frontend-ready struct.
func NormalizeLiqPlacement(p LiqPlacement) NormalizedPlacement {
	np := NormalizedPlacement{
		Tournament:     p.Tournament,
		TournamentPage: p.PageName,
		Placement:      p.Placement,
		Date:           p.Date,
		PrizeMoney:     p.PrizeMoney,
		Tier:           p.LiquipediaTier,
		TierType:       p.LiquipediaTierType,
		Type:           p.Type,
		IconURL:        p.IconURL,
		IconDarkURL:    p.IconDarkURL,
	}

	// Parse lastvsdata for final opponent info
	if p.LastVsData != nil && string(p.LastVsData) != "null" {
		var vs struct {
			OpponentName string `json:"opponentname"`
			Score        *int   `json:"score"`
		}
		if err := json.Unmarshal(p.LastVsData, &vs); err == nil {
			np.LastVsName = vs.OpponentName
			np.LastVsScore = vs.Score
		}
	}

	return np
}

// TeamPlacementsResponse is the response for GET /api/teams/:id/placements.
type TeamPlacementsResponse struct {
	Placements []NormalizedPlacement `json:"placements"`
}

// --- Helpers ---

// splitName splits a full name into first name and last name.
func splitName(fullName string) (string, string) {
	parts := strings.Fields(fullName)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}

// hashStringToInt produces a deterministic positive integer from a string.
// Used to generate stable numeric IDs for players from their string identifiers.
func hashStringToInt(s string) int {
	if s == "" {
		return 0
	}
	// FNV-1a inspired simple hash
	h := 2166136261
	for _, c := range s {
		h ^= int(c)
		h *= 16777619
	}
	if h < 0 {
		h = -h
	}
	return h
}
