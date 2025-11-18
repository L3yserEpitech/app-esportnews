package models

import "time"

type Game struct {
	ID               int64     `json:"id" gorm:"primaryKey"`
	CreatedAt        time.Time `json:"created_at" gorm:"autoCreateTime:milli"`
	Name             *string   `json:"name"`
	SelectedImage    *string   `json:"selected_image"`
	UnselectedImage  *string   `json:"unselected_image"`
	Acronym          *string   `json:"acronym"`
	FullName         *string   `json:"full_name"`
}

// TableName specifies the table name for GORM
func (Game) TableName() string {
	return "games"
}
