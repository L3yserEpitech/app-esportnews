-- Add age column to users table (nullable, optional)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER NULL;
