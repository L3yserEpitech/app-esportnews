// Mirrors backend-go/internal/backoffice/health_types.go.

export type HealthStatus = 'ok' | 'warn' | 'down' | 'unconfigured';

export interface HealthMetric {
  label: string;
  value: string;
  mono?: boolean;
  // Set when the value is a moment: worded again from it as time passes.
  at?: string;
}

export interface HealthService {
  key: string;
  name: string;
  status: HealthStatus;
  note?: string;
  missing?: string[];
  metrics: HealthMetric[];
  link?: { label: string; url: string };
}

export interface HealthWiki {
  game: string;
  wiki: string;
  budget_used: number;
  budget_limit: number;
  running_refreshed_at: string | null;
  upcoming_refreshed_at: string | null;
  running_expired: boolean;
  upcoming_expired: boolean;
  last_webhook_at: string | null;
}

export interface HealthSnapshot {
  refreshed_at: string;
  counts: { ok: number; warn: number; down: number };
  services: HealthService[];
  wikis: HealthWiki[];
}
