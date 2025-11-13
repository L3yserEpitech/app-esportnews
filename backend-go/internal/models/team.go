package models

type Team struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Acronym *string `json:"acronym"`
	Logo   *string `json:"logo"`
	PandaID int64 `json:"panda_id"`
}
