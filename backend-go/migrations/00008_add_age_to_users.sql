-- Add age column to users table
-- First, add the column as nullable temporarily
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER NULL;

-- Set a default value for existing users (e.g., 18)
UPDATE public.users SET age = 18 WHERE age IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.users ALTER COLUMN age SET NOT NULL;

