-- Add credit column to articles table for source attribution
ALTER TABLE public.articles ADD COLUMN credit TEXT NULL;
