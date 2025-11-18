package models

import (
	"time"
)

// Tournament represents a PandaScore tournament
type Tournament struct {
	ID              int64           `json:"id"`
	Name            string          `json:"name"`
	Slug            *string         `json:"slug"`
	Type            *string         `json:"type"`
	Tier            *string         `json:"tier"`
	BeginAt         *time.Time      `json:"begin_at"`
	EndAt           *time.Time      `json:"end_at"`
	Region          *string         `json:"region"`
	Prizepool       *string         `json:"prizepool"`
	Country         *string         `json:"country"`
	DetailedStats   bool            `json:"detailed_stats"`
	HasBracket      bool            `json:"has_bracket"`
	LiveSupported   bool            `json:"live_supported"`
	ModifiedAt      *time.Time      `json:"modified_at"`
	Videogame       *Videogame      `json:"videogame"`
	VideogameTitle  *VideogameTitle `json:"videogame_title"`
	League          *League         `json:"league"`
	Serie           *Serie          `json:"serie"`
	Teams           []PandaTeam     `json:"teams,omitempty"`
	Matches         []PandaMatch    `json:"matches,omitempty"`
	ExpectedRoster  []Roster        `json:"expected_roster,omitempty"`
	LeagueID        *int64          `json:"league_id"`
	SerieID         *int64          `json:"serie_id"`
	WinnerID        *int64          `json:"winner_id"`
	WinnerType      *string         `json:"winner_type"`
}

// Videogame represents a video game
type Videogame struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// VideogameTitle represents a video game title (variant)
type VideogameTitle struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	VideogameID int64  `json:"videogame_id"`
}

// League represents a competitive league
type League struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	Slug       string     `json:"slug"`
	ImageURL   string     `json:"image_url"`
	URL        *string    `json:"url"`
	ModifiedAt *time.Time `json:"modified_at"`
}

// Serie represents a tournament series (season)
type Serie struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	FullName   string     `json:"full_name"`
	Slug       string     `json:"slug"`
	Year       int        `json:"year"`
	BeginAt    *time.Time `json:"begin_at"`
	EndAt      *time.Time `json:"end_at"`
	LeagueID   int64      `json:"league_id"`
	WinnerID   *int64     `json:"winner_id"`
	WinnerType *string    `json:"winner_type"`
	Season     *string    `json:"season"`
	ModifiedAt *time.Time `json:"modified_at"`
}

// PandaTeam represents a team in PandaScore API response
type PandaTeam struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	Acronym          string     `json:"acronym"`
	Slug             string     `json:"slug"`
	Location         *string    `json:"location"`
	ImageURL         string     `json:"image_url"`
	DarkModeImageURL *string    `json:"dark_mode_image_url"`
	ModifiedAt       *time.Time `json:"modified_at"`
	Players          []Player   `json:"players,omitempty"`
}

// Player represents a player
type Player struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	Slug        string     `json:"slug"`
	Role        *string    `json:"role"`
	Age         *int       `json:"age"`
	Birthday    *string    `json:"birthday"`
	Nationality *string    `json:"nationality"`
	Active      bool       `json:"active"`
	ImageURL    *string    `json:"image_url"`
	ModifiedAt  *time.Time `json:"modified_at"`
}

// Roster represents a team's expected roster for a tournament
type Roster struct {
	Team    *PandaTeam `json:"team"`
	Players []Player   `json:"players"`
}

// PandaMatch represents a match in a tournament (from PandaScore API)
type PandaMatch struct {
	ID                  int64              `json:"id"`
	Name                string             `json:"name"`
	Slug                *string            `json:"slug"`
	Status              *string            `json:"status"`
	BeginAt             *time.Time         `json:"begin_at"`
	EndAt               *time.Time         `json:"end_at"`
	ScheduledAt         *time.Time         `json:"scheduled_at"`
	OriginalScheduledAt *time.Time         `json:"original_scheduled_at"`
	MatchType           *string            `json:"match_type"`
	NumberOfGames       *int32             `json:"number_of_games"`
	DetailedStats       bool               `json:"detailed_stats"`
	Draw                bool               `json:"draw"`
	Forfeit             bool               `json:"forfeit"`
	Rescheduled         bool               `json:"rescheduled"`
	GameAdvantage       *int               `json:"game_advantage"`
	WinnerID            *int64             `json:"winner_id"`
	WinnerType          *string            `json:"winner_type"`
	TournamentID        int64              `json:"tournament_id"`
	ModifiedAt          *time.Time         `json:"modified_at"`
	Live                *Live              `json:"live"`
	Opponents           []MatchOpponent    `json:"opponents,omitempty"`
	StreamsList         []Stream           `json:"streams_list,omitempty"`
	Games               []PandaGame        `json:"games,omitempty"`
	LeagueID            *int64             `json:"league_id"`
	League              *League            `json:"league"`
	SerieID             *int64             `json:"serie_id"`
	Serie               *Serie             `json:"serie"`
	Tournament          *Tournament        `json:"tournament"`
	Videogame           *Videogame         `json:"videogame"`
	VideogameTitle      *VideogameTitle    `json:"videogame_title"`
	VideogameVersion    *VideogameVersion  `json:"videogame_version"`
	Results             []MatchResult      `json:"results,omitempty"`
	Winner              *PandaTeam         `json:"winner"`
}

// PandaGame represents a sub-match/game (individual map in a match)
type PandaGame struct {
	ID            int64      `json:"id"`
	MatchID       int64      `json:"match_id"`
	Position      int        `json:"position"`
	Status        *string    `json:"status"`
	BeginAt       *time.Time `json:"begin_at"`
	EndAt         *time.Time `json:"end_at"`
	Complete      bool       `json:"complete"`
	Finished      bool       `json:"finished"`
	DetailedStats bool       `json:"detailed_stats"`
	Forfeit       bool       `json:"forfeit"`
	Length        *int       `json:"length"` // Duration in seconds
	Winner        *WinnerRef `json:"winner"`
	WinnerType    *string    `json:"winner_type"`
}

// WinnerRef represents a reference to a winner (Team or Player)
type WinnerRef struct {
	ID   int64  `json:"id"`
	Type string `json:"type"` // "Team" or "Player"
}

// Live represents live stream information for a match
type Live struct {
	Supported bool       `json:"supported"`
	OpensAt   *time.Time `json:"opens_at"`
	URL       *string    `json:"url"`
}

// MatchOpponent represents an opponent in a match with team details
type MatchOpponent struct {
	Opponent *PandaTeam `json:"opponent"`
	Type     string     `json:"type"` // "Team" or "Unknown"
}

// Stream represents a live stream
type Stream struct {
	Language  string  `json:"language"`
	Main      bool    `json:"main"`
	Official  bool    `json:"official"`
	EmbedURL  *string `json:"embed_url"`
	RawURL    string  `json:"raw_url"`
}

// MatchResult represents the result/score for a team in a match
type MatchResult struct {
	TeamID int64 `json:"team_id"`
	Score  int   `json:"score"`
}

// VideogameVersion represents a version of a video game
type VideogameVersion struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
}

// TournamentFilter is used for filtering tournaments
type TournamentFilter struct {
	GameAcronym string
	Status      *string
	Tier        *string
	Limit       int
	Offset      int
}
