package models

import "time"

type Ad struct {
	ID           int64  `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	Title        *string `json:"title"`
	Position     *int16  `json:"position"`
	Type         *string `json:"type"`
	URL          *string `json:"url"`
	RedirectLink *string `json:"redirect_link"`
}
