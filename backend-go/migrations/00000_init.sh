#!/bin/bash
set -e

# Create the esportnews user and database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER esportnews WITH PASSWORD 'secret';
    ALTER USER esportnews CREATEDB;
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO esportnews;
EOSQL

echo "✅ User 'esportnews' created successfully"
