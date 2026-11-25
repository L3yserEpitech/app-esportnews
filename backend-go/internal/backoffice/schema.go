package backoffice

import (
	"fmt"

	"gorm.io/gorm"
)

// schemaStatements is applied at every boot, like the ALTERs of database.InitGORM:
// each statement is idempotent, and the legacy tables are altered with IF EXISTS
// so a fresh dev database (created later by AutoMigrate) doesn't break startup.
var schemaStatements = []string{
	// users: one role column for the back-office. `admin` stays the flag the site
	// reads; setRole keeps the two in step.
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'`,
	`UPDATE users SET role = 'admin' WHERE admin = true AND role = 'user'`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS team_since timestamptz`,
	`UPDATE users SET team_since = now() WHERE role <> 'user' AND team_since IS NULL`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_bo_login_at timestamptz`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS signup_source text`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS premium_gifted boolean NOT NULL DEFAULT false`,
	`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS premium_gift_note text`,
	`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role <> 'user'`,

	// articles: drafts and scheduled publication. Every existing row is published.
	`ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'`,
	`ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS scheduled_at timestamptz`,
	`ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS notify_on_publish boolean NOT NULL DEFAULT true`,
	`ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS author_id bigint`,
	`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status) WHERE status <> 'published'`,

	`CREATE TABLE IF NOT EXISTS bo_totp (
		user_id bigint PRIMARY KEY,
		secret text NOT NULL,
		enabled_at timestamptz,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS bo_backup_code (
		id bigserial PRIMARY KEY,
		user_id bigint NOT NULL,
		code_hash text NOT NULL,
		used_at timestamptz
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_backup_code_user ON bo_backup_code(user_id)`,
	`CREATE TABLE IF NOT EXISTS bo_trusted_device (
		id bigserial PRIMARY KEY,
		user_id bigint NOT NULL,
		token_hash text NOT NULL UNIQUE,
		label text,
		created_at timestamptz NOT NULL DEFAULT now(),
		expires_at timestamptz NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_trusted_device_user ON bo_trusted_device(user_id)`,

	`CREATE TABLE IF NOT EXISTS bo_audit_log (
		id bigserial PRIMARY KEY,
		created_at timestamptz NOT NULL DEFAULT now(),
		actor_id bigint,
		actor_name text NOT NULL DEFAULT '',
		action text NOT NULL,
		target_type text NOT NULL DEFAULT '',
		target_id text NOT NULL DEFAULT '',
		target_label text NOT NULL DEFAULT '',
		detail text NOT NULL DEFAULT '',
		ip text NOT NULL DEFAULT '',
		device text NOT NULL DEFAULT '',
		city text NOT NULL DEFAULT ''
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_audit_log_created ON bo_audit_log(created_at DESC)`,

	`CREATE TABLE IF NOT EXISTS bo_push_log (
		id bigserial PRIMARY KEY,
		created_at timestamptz NOT NULL DEFAULT now(),
		kind text NOT NULL,
		title text NOT NULL DEFAULT '',
		body text NOT NULL DEFAULT '',
		audience text NOT NULL DEFAULT '',
		ref text NOT NULL DEFAULT '',
		actor_id bigint,
		sent integer NOT NULL DEFAULT 0,
		delivered integer NOT NULL DEFAULT 0,
		failed integer NOT NULL DEFAULT 0,
		deactivated integer NOT NULL DEFAULT 0,
		receipts_checked_at timestamptz
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_push_log_created ON bo_push_log(created_at DESC)`,
	`CREATE TABLE IF NOT EXISTS bo_push_ticket (
		id bigserial PRIMARY KEY,
		push_log_id bigint NOT NULL,
		ticket_id text NOT NULL,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_push_ticket_log ON bo_push_ticket(push_log_id)`,

	`CREATE TABLE IF NOT EXISTS bo_setting (
		key text PRIMARY KEY,
		value text NOT NULL,
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,

	`CREATE TABLE IF NOT EXISTS bo_article_version (
		id bigserial PRIMARY KEY,
		article_id bigint NOT NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		actor_id bigint,
		actor_name text NOT NULL DEFAULT '',
		label text NOT NULL DEFAULT '',
		snapshot jsonb NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bo_article_version_article ON bo_article_version(article_id, created_at DESC)`,

	// No personal data here: only that an account existed and when it went.
	`CREATE TABLE IF NOT EXISTS bo_deleted_account (
		id bigserial PRIMARY KEY,
		user_id bigint NOT NULL,
		registered_at timestamptz,
		deleted_at timestamptz NOT NULL DEFAULT now(),
		deleted_by text NOT NULL DEFAULT '',
		reason text NOT NULL DEFAULT ''
	)`,

	`CREATE TABLE IF NOT EXISTS bo_http_error (
		hour timestamptz PRIMARY KEY,
		count integer NOT NULL DEFAULT 0
	)`,

	`CREATE TABLE IF NOT EXISTS ad_spot (
		key text PRIMARY KEY,
		label text NOT NULL DEFAULT '',
		format text NOT NULL DEFAULT '',
		placement text NOT NULL DEFAULT '',
		sort integer NOT NULL DEFAULT 0,
		mode text NOT NULL DEFAULT 'adsense',
		adsense_slot text NOT NULL DEFAULT '',
		title text NOT NULL DEFAULT '',
		media_url text NOT NULL DEFAULT '',
		media_type text NOT NULL DEFAULT 'image',
		redirect_link text NOT NULL DEFAULT '',
		starts_at timestamptz,
		ends_at timestamptz,
		updated_at timestamptz NOT NULL DEFAULT now(),
		updated_by text NOT NULL DEFAULT ''
	)`,
}

func EnsureSchema(db *gorm.DB) error {
	for _, stmt := range schemaStatements {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("backoffice schema: %w (%.60s)", err, stmt)
		}
	}
	return nil
}
