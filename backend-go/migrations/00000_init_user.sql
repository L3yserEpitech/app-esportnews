-- Grant permissions to the user created by POSTGRES_USER env var
-- This script runs once when PostgreSQL initializes
-- Note: User is already created by Docker via POSTGRES_USER environment variable

-- PostgreSQL 15+ requires explicit schema permissions for non-superuser
-- Grant permissions to PUBLIC (all users including the one created by POSTGRES_USER)
GRANT ALL ON SCHEMA public TO PUBLIC;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO PUBLIC;