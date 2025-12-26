-- Add article_content column to articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS article_content TEXT;
