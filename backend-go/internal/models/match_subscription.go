package models

import "time"

// MatchSubscription stores per-user match subscriptions for push notifications.
// match2_id identifies the match. match_id is the pageid of its tournament page,
// shared by every match of that page: it is only kept for the push payload and
// for the published app, which still addresses subscriptions by it. Uniqueness is
// a partial index on (user_id, match2_id), see database.EnsureMatchSubscriptionIdentity.
// Snapshot fields (match_name, tournament_name, begin_at) allow display without Redis lookup.
type MatchSubscription struct {
	ID               int64      `json:"id" gorm:"primaryKey"`
	CreatedAt        time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UserID           int64      `json:"user_id" gorm:"not null;index"`
	MatchID          int64      `json:"match_id" gorm:"not null"`
	Match2ID         string     `json:"match2id"` // alphanumeric Liquipedia id — empty only on rows inherited from PandaScore or very old builds
	GameAcronym      string     `json:"game_acronym"`
	MatchName        string     `json:"match_name"`
	TournamentName   string     `json:"tournament_name"`
	BeginAt          *time.Time `json:"begin_at"`
	Status           string     `json:"status" gorm:"default:'upcoming'"` // upcoming, running, finished, canceled
	NotifiedStart    bool       `json:"notified_start" gorm:"default:false"`
	NotifiedSchedule bool       `json:"notified_schedule" gorm:"default:false"`
	FromTournament   *int64     `json:"from_tournament,omitempty"` // non-null if auto-created by tournament subscription
	FromTeam         *int64     `json:"from_team,omitempty"`       // non-null if auto-created by a favorite team (holds its pageid)
}

func (MatchSubscription) TableName() string { return "match_subscription" }
