-- Migration: Add Stripe and subscription fields to users table
-- Date: 2025-12-25
-- Purpose: Support premium subscription management

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT,
    ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMP WITH TIME ZONE;

-- Index pour optimiser les requêtes sur les abonnements actifs
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_premium ON public.users(premium);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
