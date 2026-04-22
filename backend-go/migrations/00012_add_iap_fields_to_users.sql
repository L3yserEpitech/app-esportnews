-- Migration: Add IAP (In-App Purchase) fields to users table
-- Date: 2026-04-22
-- Purpose: Support Apple App Store and Google Play subscription tracking
--
-- Idempotent : ADD COLUMN IF NOT EXISTS. Some environments may already have the
-- base iap_* columns (added via GORM AutoMigrate in dev); this migration
-- guarantees presence in prod and adds iap_original_transaction_id which is
-- required to match Apple Server Notifications V2 with the right user.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS iap_platform TEXT,
    ADD COLUMN IF NOT EXISTS iap_product_id TEXT,
    ADD COLUMN IF NOT EXISTS iap_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS iap_original_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS iap_expires_at TIMESTAMP WITH TIME ZONE;

-- Index (non-unique) on transaction_id — used for lookups. We deliberately do
-- NOT make this unique: in sandbox (and on family-shared Apple IDs) the same
-- transaction id can be associated with multiple local users when test
-- accounts are reused, which would otherwise break INSERT/UPDATE silently.
DROP INDEX IF EXISTS idx_users_iap_transaction_id;
CREATE INDEX IF NOT EXISTS idx_users_iap_transaction_id
    ON public.users(iap_transaction_id)
    WHERE iap_transaction_id IS NOT NULL;

-- Index on original_transaction_id — used by webhook handler to locate the user
-- when Apple sends a renewal/expiration notification. Stable across renewals.
CREATE INDEX IF NOT EXISTS idx_users_iap_original_transaction_id
    ON public.users(iap_original_transaction_id)
    WHERE iap_original_transaction_id IS NOT NULL;

-- Index on expiration — used by the daily re-validation cron to find
-- subscriptions expiring within the revalidation window (48h, see
-- iap_validation_scheduler.go).
CREATE INDEX IF NOT EXISTS idx_users_iap_expires_at
    ON public.users(iap_expires_at)
    WHERE iap_platform IS NOT NULL;
