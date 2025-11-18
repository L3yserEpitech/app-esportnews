package models

import "time"

type Notification struct {
	ID            int64     `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime:milli"`
	UserID        int64     `json:"user_id" gorm:"index"`
	NotifiPush    *bool     `json:"notifi_push" gorm:"column:notifi_push"`
	NotifArticles *bool     `json:"notif_articles" gorm:"column:notif_articles"`
	NotifNews     *bool     `json:"notif_news" gorm:"column:notif_news"`
	NotifMatches  *bool     `json:"notif_matchs" gorm:"column:notif_matchs"`
}

// TableName specifies the table name for GORM
func (Notification) TableName() string {
	return "notifications"
}
