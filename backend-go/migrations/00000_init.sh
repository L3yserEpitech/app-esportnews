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
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO esportnews;
EOSQL

echo "✅ User 'esportnews' created successfully and granted privileges on $POSTGRES_DB"
