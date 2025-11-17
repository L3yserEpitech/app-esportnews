-- Create esportnews user and database if they don't exist
-- This script runs once when PostgreSQL initializes

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'esportnews') THEN
    CREATE ROLE esportnews WITH LOGIN PASSWORD 'secret';
    ALTER ROLE esportnews CREATEDB;
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE esportnews TO esportnews;
