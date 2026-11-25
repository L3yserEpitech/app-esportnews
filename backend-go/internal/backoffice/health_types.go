package backoffice

import "time"

// The health screen and the dashboard share this picture of the system.

type HealthStatus string

const (
	HealthOK           HealthStatus = "ok"           // « Opérationnel »
	HealthWarn         HealthStatus = "warn"         // « À surveiller »
	HealthDown         HealthStatus = "down"         // « En panne »
	HealthUnconfigured HealthStatus = "unconfigured" // credentials missing: says so, shows no number
)

type HealthMetric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Mono  bool   `json:"mono,omitempty"`
	// At is set when the value is a moment (« il y a 40 s »): Value holds it as
	// worded when the snapshot was built, a screen can word it again from At.
	At *time.Time `json:"at,omitempty"`
}

type HealthLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type HealthService struct {
	Key     string         `json:"key"`
	Name    string         `json:"name"`
	Status  HealthStatus   `json:"status"`
	Note    string         `json:"note,omitempty"`    // one line under the metrics
	Missing []string       `json:"missing,omitempty"` // env vars to set when unconfigured
	Metrics []HealthMetric `json:"metrics"`
	Link    *HealthLink    `json:"link,omitempty"`
}

// HealthAlert is a line of the dashboard's « À regarder » card.
type HealthAlert struct {
	Level  string `json:"level"` // "important" or "info"
	Title  string `json:"title"`
	Detail string `json:"detail"`
	Href   string `json:"href"` // back-office path, e.g. /sante
}

// HealthCounts feeds the three tiles; an unconfigured service is in none.
type HealthCounts struct {
	OK   int `json:"ok"`
	Warn int `json:"warn"`
	Down int `json:"down"`
}

// HealthWiki is a row of « Liquipedia par wiki ». A list never fetched since
// the last restart has a null time.
type HealthWiki struct {
	Game                string     `json:"game"`
	Wiki                string     `json:"wiki"`
	BudgetUsed          int        `json:"budget_used"`
	BudgetLimit         int        `json:"budget_limit"`
	RunningRefreshedAt  *time.Time `json:"running_refreshed_at"`
	UpcomingRefreshedAt *time.Time `json:"upcoming_refreshed_at"`
	RunningExpired      bool       `json:"running_expired"`
	UpcomingExpired     bool       `json:"upcoming_expired"`
	LastWebhookAt       *time.Time `json:"last_webhook_at"`
}

type HealthSnapshot struct {
	RefreshedAt time.Time       `json:"refreshed_at"`
	Counts      HealthCounts    `json:"counts"`
	Services    []HealthService `json:"services"`
	Wikis       []HealthWiki    `json:"wikis"`
	Alerts      []HealthAlert   `json:"alerts"`
}
