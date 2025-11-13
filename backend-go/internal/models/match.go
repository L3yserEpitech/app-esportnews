package models

import (
	"database/sql"
	"time"
)

type Match struct {
	ID                  int64          `json:"id"`
	CreatedAt           time.Time      `json:"created_at"`
	PandaID             int64          `json:"panda_id"`
	Name                string         `json:"name"`
	Slug                *string        `json:"slug"`
	Status              *string        `json:"status"`
	MatchType           *string        `json:"match_type"`
	NumberOfGames       *int32         `json:"number_of_games"`
	BeginAt             *time.Time     `json:"begin_at"`
	EndAt               *time.Time     `json:"end_at"`
	ScheduledAt         *time.Time     `json:"scheduled_at"`
	OriginalScheduledAt *time.Time     `json:"original_scheduled_at"`
	TournamentID        *int64         `json:"tournament_id"`
	SerieID             *int64         `json:"serie_id"`
	LeagueID            *int64         `json:"league_id"`
	WinnerID            *int64         `json:"winner_id"`
	WinnerType          *string        `json:"winner_type"`
	Rescheduled         bool           `json:"rescheduled"`
	Forfeit             bool           `json:"forfeit"`
	Draw                bool           `json:"draw"`
	DetailedStats       bool           `json:"detailed_stats"`
	GameAdvantage       *string        `json:"game_advantage"`
	LiveSupported       bool           `json:"live_supported"`
	LiveURL             *string        `json:"live_url"`
	ModifiedAt          *time.Time     `json:"modified_at"`
	RawData             sql.NullString `json:"raw_data"`
}

type MatchFilter struct {
	Date        string // YYYY-MM-DD
	GameAcronym string
	Limit       int
	Offset      int
}
