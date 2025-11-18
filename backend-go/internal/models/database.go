package models

import (
	"database/sql"
	"time"
)

// DatabaseTournament represents a tournament stored in the database
// This is different from Tournament which is from PandaScore API
type DatabaseTournament struct {
	ID          int64          `json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	PandaID     int64          `json:"panda_id"`
	Name        string         `json:"name"`
	Slug        *string        `json:"slug"`
	Type        *string        `json:"type"`
	Status      *string        `json:"status"`
	BeginAt     *time.Time     `json:"begin_at"`
	EndAt       *time.Time     `json:"end_at"`
	Region      *string        `json:"region"`
	Tier        *string        `json:"tier"`
	Prizepool   *string        `json:"prizepool"`
	HasBracket  bool           `json:"has_bracket"`
	VideogameID *int64         `json:"videogame_id"`
	LeagueID    *int64         `json:"league_id"`
	SerieID     *int64         `json:"serie_id"`
	WinnerID    *int64         `json:"winner_id"`
	ModifiedAt  *time.Time     `json:"modified_at"`
	RawData     sql.NullString `json:"raw_data"`
}
