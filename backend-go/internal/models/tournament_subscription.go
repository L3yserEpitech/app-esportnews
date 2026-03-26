package models

import "time"

// TournamentSubscription stores per-user tournament subscriptions.
// tournament_id references a Liquipedia normalized tournament ID (volatile, stored in Redis only).
type TournamentSubscription struct {
	ID             int64      `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UserID         int64      `json:"user_id" gorm:"uniqueIndex:idx_user_tournament;not null;index"`
	TournamentID   int64      `json:"tournament_id" gorm:"uniqueIndex:idx_user_tournament;not null"`
	GameAcronym    string     `json:"game_acronym"`
	TournamentName string     `json:"tournament_name"`
	BeginAt        *time.Time `json:"begin_at"`
	EndAt          *time.Time `json:"end_at"`
	Status         string     `json:"status" gorm:"default:'running'"` // running, upcoming, finished
}

func (TournamentSubscription) TableName() string { return "tournament_subscription" }
