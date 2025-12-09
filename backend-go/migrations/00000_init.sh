#!/bin/bash
set -e

# Grant schema permissions (PostgreSQL 15+ requirement)
# User is already created by Docker via POSTGRES_USER environment variable
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- PostgreSQL 15+ requires explicit schema permissions
    GRANT ALL ON SCHEMA public TO PUBLIC;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC;
EOSQL

echo "✅ Schema permissions granted on $POSTGRES_DB"
