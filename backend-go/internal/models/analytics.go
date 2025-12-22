package models

import (
	"time"
)

// PageView represents a single page view for analytics tracking
type PageView struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	VisitorID string    `gorm:"type:uuid;not null;index:idx_page_views_visitor_id" json:"visitor_id"`
	UserID    *int64    `gorm:"index:idx_page_views_user_id" json:"user_id,omitempty"`
	Path      string    `gorm:"type:text;not null;index:idx_page_views_path" json:"path"`
	Referer   string    `gorm:"type:text" json:"referer,omitempty"`
	UserAgent string    `gorm:"type:text" json:"user_agent,omitempty"`
	CreatedAt time.Time `gorm:"not null;default:now();index:idx_page_views_created_at" json:"created_at"`
}

// TableName overrides the table name
func (PageView) TableName() string {
	return "page_views"
}

// TrackPageViewInput is the input for recording a page view
type TrackPageViewInput struct {
	VisitorID string `json:"visitor_id" validate:"required,uuid"`
	UserID    *int64 `json:"user_id,omitempty"`
	Path      string `json:"path" validate:"required"`
	Referer   string `json:"referer,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
}

// VisitorStats represents visitor statistics for a given timeline
type VisitorStats struct {
	Timeline       string             `json:"timeline"`        // "24h", "week", "month", "year"
	TotalVisitors  int64              `json:"total_visitors"`  // Unique visitors count
	TotalPageViews int64              `json:"total_pageviews"` // Total page views
	AvgPerDay      float64            `json:"avg_per_day"`     // Average visitors per day
	Breakdown      []VisitorBreakdown `json:"breakdown"`       // Daily breakdown for charts
}

// VisitorBreakdown represents visitor count for a specific date
type VisitorBreakdown struct {
	Date     string `json:"date"`     // Format: "2025-12-09"
	Visitors int64  `json:"visitors"` // Unique visitors on this date
	Views    int64  `json:"views"`    // Total page views on this date
}

// RegistrationStats represents user registration statistics for a given timeline
type RegistrationStats struct {
	Timeline   string                  `json:"timeline"`    // "day", "week", "month", "year"
	TotalUsers int64                   `json:"total_users"` // New registrations in period
	AvgPerDay  float64                 `json:"avg_per_day"` // Average registrations per day
	Breakdown  []RegistrationBreakdown `json:"breakdown"`   // Daily breakdown for charts
}

// RegistrationBreakdown represents registration count for a specific date
type RegistrationBreakdown struct {
	Date  string `json:"date"`  // Format: "2025-12-09"
	Count int64  `json:"count"` // Registrations on this date
}

// ExportDataRow represents a single row for CSV/Excel export
type ExportDataRow struct {
	Date             string `json:"date"`
	UniqueVisitors   int64  `json:"unique_visitors"`
	TotalPageViews   int64  `json:"total_pageviews"`
	NewRegistrations int64  `json:"new_registrations"`
}

// AgeStats represents age distribution statistics for users
type AgeStats struct {
	AgeRange string `json:"age_range"` // "0-16", "16-25", "25-40", "40-60", "60+"
	Count    int64  `json:"count"`     // Number of users in this age range
}

// AgeDistribution represents the complete age distribution for users
type AgeDistribution struct {
	TotalUsers int64      `json:"total_users"` // Total users with age data (excludes NULL)
	Breakdown  []AgeStats `json:"breakdown"`   // Age distribution breakdown
}
