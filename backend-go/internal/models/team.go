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
	isActive := sp.Status == "active" && sp.Type == "player"

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
// Only players (type=player) are included, both active and inactive.
func NormalizeLiqSquadPlayers(players []LiqSquadPlayer) []NormalizedPlayer {
	result := make([]NormalizedPlayer, 0, len(players))
	seen := make(map[string]bool)

	for _, sp := range players {
		// Only include players (not staff, coaches, etc.)
		if sp.Type != "player" {
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
