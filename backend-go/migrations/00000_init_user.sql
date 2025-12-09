-- Create esportnews user and database if they don't exist
-- This script runs once when PostgreSQL initializes

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'esportnews') THEN
    CREATE ROLE esportnews WITH LOGIN PASSWORD 'secret';
    ALTER ROLE esportnews CREATEDB;
  END IF;
END $$;

-- Grant privileges on database
GRANT ALL PRIVILEGES ON DATABASE esportnews TO esportnews;

-- PostgreSQL 15+ requires explicit schema permissions
GRANT ALL ON SCHEMA public TO esportnews;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO esportnews;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO esportnews;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO esportnews;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO esportnews;
