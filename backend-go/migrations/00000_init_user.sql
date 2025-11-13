-- Create esportnews user and database if they don't exist
-- This script runs once when PostgreSQL initializes

CREATE USER IF NOT EXISTS esportnews WITH PASSWORD 'secret';
ALTER USER esportnews CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE esportnews TO esportnews;
