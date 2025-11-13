package models

import (
	"time"
)

type User struct {
	ID                  int64         `json:"id"`
	CreatedAt           time.Time     `json:"created_at"`
	Name                string         `json:"name"`
	Email               string         `json:"email"`
	Password            string         `json:"-"` // Never expose password
	Avatar              *string        `json:"avatar"`
	Admin               bool           `json:"admin"`
	FavoriteTeams       []int64        `json:"favorite_teams"`
	NotifiPush          *bool          `json:"notifi_push"`
	NotifArticles       *bool          `json:"notif_articles"`
	NotifNews           *bool          `json:"notif_news"`
	NotifMatches        *bool          `json:"notif_matchs"`
}

type CreateUserInput struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type LoginInput struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         *User  `json:"user"`
}

type UpdateUserInput struct {
	Name   *string `json:"name"`
	Email  *string `json:"email"`
	Avatar *string `json:"avatar"`
}

type NotificationPreferences struct {
	UserID       int64 `json:"user_id"`
	NotifiPush   bool  `json:"notifi_push"`
	NotifNews    bool  `json:"notif_news"`
	NotifArticles bool `json:"notif_articles"`
	NotifMatches bool  `json:"notif_matchs"`
}
