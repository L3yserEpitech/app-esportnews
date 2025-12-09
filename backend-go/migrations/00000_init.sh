#!/bin/bash
set -e

# Create the esportnews user and database (if not already created by init script)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'esportnews') THEN
        CREATE ROLE esportnews WITH LOGIN PASSWORD 'secret';
        ALTER ROLE esportnews CREATEDB;
      END IF;
    END \$\$;
    
    -- Grant privileges on database
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO esportnews;
    
    -- PostgreSQL 15+ requires explicit schema permissions
    GRANT ALL ON SCHEMA public TO esportnews;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO esportnews;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO esportnews;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO esportnews;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO esportnews;
EOSQL

echo "✅ User 'esportnews' created successfully and granted privileges on $POSTGRES_DB"
