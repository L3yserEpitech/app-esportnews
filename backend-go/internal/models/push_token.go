package models

import "time"

// PushToken stores Expo push notification tokens per user per device
type PushToken struct {
	ID        int64     `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`
	UserID    int64     `json:"user_id" gorm:"index;not null"`
	Token     string    `json:"token" gorm:"uniqueIndex;not null"` // ExponentPushToken[xxx]
	Platform  string    `json:"platform"`                          // "ios" or "android"
	Active    bool      `json:"active" gorm:"default:true"`
}

func (PushToken) TableName() string { return "push_token" }
