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

-- Unique index on transaction_id (existing behavior per GORM tag)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_iap_transaction_id
    ON public.users(iap_transaction_id)
    WHERE iap_transaction_id IS NOT NULL;

-- Index on original_transaction_id — used by webhook handler to locate the user
-- when Apple sends a renewal/expiration notification. Not unique: in edge cases
-- (family sharing, account merges) the same original id could map to two users
-- momentarily; webhook handler picks the most recent one.
CREATE INDEX IF NOT EXISTS idx_users_iap_original_transaction_id
    ON public.users(iap_original_transaction_id)
    WHERE iap_original_transaction_id IS NOT NULL;

-- Index on expiration — used by the daily re-validation cron to find
-- subscriptions expiring in the next 7 days.
CREATE INDEX IF NOT EXISTS idx_users_iap_expires_at
    ON public.users(iap_expires_at)
    WHERE iap_platform IS NOT NULL;
