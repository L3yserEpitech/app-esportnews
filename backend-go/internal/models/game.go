package models

type Game struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	SelectedImage    string  `json:"selected_image"`
	UnselectedImage  string  `json:"unselected_image"`
	Acronym          string  `json:"acronym"`
	FullName         string  `json:"full_name"`
}
