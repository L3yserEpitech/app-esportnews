#!/bin/bash
set -e

echo "🚀 Initializing database with schema and data..."

# 1. Exécuter les migrations (schema)
echo "📋 Running migrations..."
for file in /migrations/*.sql; do
    if [ -f "$file" ]; then
        echo "  → Running $(basename $file)"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$file"
    fi
done

# 2. Charger les données initiales
echo "📦 Loading initial data..."
for file in /initial_data/*.sql; do
    if [ -f "$file" ]; then
        echo "  → Loading $(basename $file)"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$file"
    fi
done

echo "✅ Database initialization completed!"
