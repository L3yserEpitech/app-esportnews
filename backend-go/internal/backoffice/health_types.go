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

type HealthSnapshot struct {
	RefreshedAt time.Time       `json:"refreshed_at"`
	Services    []HealthService `json:"services"`
	Alerts      []HealthAlert   `json:"alerts"`
}
