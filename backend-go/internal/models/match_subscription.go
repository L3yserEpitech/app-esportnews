package models

import "time"

// MatchSubscription stores per-user match subscriptions for push notifications.
// match_id references a Liquipedia normalized match ID (volatile, stored in Redis only).
// Snapshot fields (match_name, tournament_name, begin_at) allow display without Redis lookup.
type MatchSubscription struct {
	ID               int64      `json:"id" gorm:"primaryKey"`
	CreatedAt        time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UserID           int64      `json:"user_id" gorm:"uniqueIndex:idx_user_match;not null;index"`
	MatchID          int64      `json:"match_id" gorm:"uniqueIndex:idx_user_match;not null"`
	GameAcronym      string     `json:"game_acronym"`
	MatchName        string     `json:"match_name"`
	TournamentName   string     `json:"tournament_name"`
	BeginAt          *time.Time `json:"begin_at"`
	Status           string     `json:"status" gorm:"default:'upcoming'"` // upcoming, running, finished, canceled
	NotifiedStart    bool       `json:"notified_start" gorm:"default:false"`
	NotifiedSchedule bool       `json:"notified_schedule" gorm:"default:false"`
	FromTournament   *int64     `json:"from_tournament,omitempty"` // non-null if auto-created by tournament subscription
}

func (MatchSubscription) TableName() string { return "match_subscription" }
