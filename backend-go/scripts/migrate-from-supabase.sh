#!/bin/bash
# Migrate data from Supabase to local PostgreSQL

set -e

echo "🔄 Starting Supabase to PostgreSQL migration..."

# Supabase credentials
SUPABASE_HOST="db.olybccviffjiqjmnsysn.supabase.co"
SUPABASE_USER="postgres"
SUPABASE_PORT="5432"
SUPABASE_DB="postgres"

# Local PostgreSQL credentials (from docker-compose)
LOCAL_HOST="localhost"
LOCAL_USER="esportnews"
LOCAL_PASSWORD="secret"
LOCAL_PORT="5432"
LOCAL_DB="esportnews"

# Temporary dump file
DUMP_FILE="/tmp/supabase_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "📦 Dumping data from Supabase..."
# Prompt for Supabase password
read -sp "Enter Supabase password (postgres): " SUPABASE_PASSWORD
echo ""

PGPASSWORD="$SUPABASE_PASSWORD" pg_dump \
  -h "$SUPABASE_HOST" \
  -U "$SUPABASE_USER" \
  -p "$SUPABASE_PORT" \
  -d "$SUPABASE_DB" \
  --no-owner \
  --no-acl \
  --if-exists \
  --schema=public \
  -f "$DUMP_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to dump Supabase data"
  exit 1
fi

echo "✅ Supabase dump created: $DUMP_FILE"
echo "📊 Dump file size: $(du -h "$DUMP_FILE" | cut -f1)"

echo ""
echo "⚙️  Restoring to local PostgreSQL..."

# Wait a moment for Docker containers to be ready
sleep 2

# Restore to local database
PGPASSWORD="$LOCAL_PASSWORD" psql \
  -h "$LOCAL_HOST" \
  -U "$LOCAL_USER" \
  -p "$LOCAL_PORT" \
  -d "$LOCAL_DB" \
  -f "$DUMP_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to restore to local database"
  echo "💡 Make sure docker-compose is running: docker-compose up -d"
  exit 1
fi

echo "✅ Migration completed successfully!"
echo "📁 Dump file: $DUMP_FILE (kept for backup)"
echo ""
echo "🎯 Next steps:"
echo "  1. Start the Go backend: go run ./cmd/server"
echo "  2. PandaScore poller will start automatically (5-min polling interval)"
echo "  3. Check logs for 'PandaScore poller started'"
