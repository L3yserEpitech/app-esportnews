# Go Backend Migration Guide

This guide explains how to migrate from the Node.js/Fastify backend to the new Go/Echo backend with PostgreSQL and Redis.

## Prerequisites

- Docker and Docker Compose installed
- `pg_dump` utility (usually included with PostgreSQL client)
- Go 1.22+ (for local development)

## Quick Start

### 1. Start Docker Services

```bash
cd /Users/jules/Code/freelance/esportnews
docker-compose up -d postgres redis
```

Wait for services to be healthy:
```bash
docker-compose ps
```

You should see:
- `esportnews-db` (postgres) - healthy
- `esportnews-cache` (redis) - healthy

### 2. Migrate Data from Supabase

```bash
cd backend-go
./scripts/migrate-from-supabase.sh
```

The script will:
1. Prompt for your Supabase password
2. Dump all data from Supabase PostgreSQL
3. Restore it to the local PostgreSQL database
4. Keep a backup file in `/tmp/`

### 3. Start the Go Backend

```bash
cd backend-go

# Using Docker Compose:
docker-compose up backend

# OR using Go directly:
export DATABASE_URL="postgres://esportnews:secret@localhost:5432/esportnews"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="jz0t+KB0qyBF/hsv4r0MCdEMYJGSfdFxpJ0V5usLuu8="
export PANDASCORE_API_KEY="rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk"

go run ./cmd/server
```

### 4. Start the Frontend

```bash
cd frontend

# The Docker Compose setup will automatically start it
# OR manually:
npm install
npm run dev
```

## Verification

Once everything is running, verify the setup:

```bash
# Health check - backend
curl http://localhost:4000/health

# Health check - frontend
curl http://localhost:3000

# Check logs for PandaScore poller
docker logs esportnews-backend | grep "PandaScore poller"
```

## Architecture

### Services

| Service | Port | Tech Stack |
|---------|------|-----------|
| **Backend** | 4000 | Go 1.22 + Echo v4 |
| **Frontend** | 3000 | Next.js 14 |
| **Database** | 5432 | PostgreSQL 15 |
| **Cache** | 6379 | Redis 7 |

### Key Components

#### Database Layer
- **Driver**: pgx/v5 with connection pooling (25-100 connections)
- **Migrations**: Goose (SQL migrations in `migrations/` folder)
- **Schema**: 8 tables (users, games, articles, ads, tournaments, matches, games_pandascore)

#### Cache Layer
- **Redis client**: go-redis/v9
- **Key patterns**: Tournaments, Matches, Articles, Games, Auth tokens
- **TTLs**: 5min (dynamic), 1h (articles), 24h (games), 7d (JWT), 14d (refresh tokens)

#### Services
1. **AuthService** - JWT tokens, password hashing (bcrypt cost 12), refresh tokens
2. **GameService** - Game listings with cache
3. **TournamentService** - Tournament sync and caching
4. **MatchService** - Match listings and scheduling
5. **ArticleService** - Article retrieval with view counting
6. **TeamService** - Favorite teams management
7. **PandaScorePoller** - Background goroutine syncing tournaments/matches every 5 minutes

## API Endpoints

### Auth
```
POST   /api/auth/signup          - Create new user
POST   /api/auth/login           - Login user
GET    /api/auth/me              - Get current user
POST   /api/auth/me              - Update profile
POST   /api/auth/avatar          - Upload avatar (TODO)
DELETE /api/auth/avatar          - Delete avatar
POST   /api/auth/logout          - Logout
POST   /api/auth/refresh         - Refresh JWT token
```

### Games
```
GET    /api/games                - List all games (cached 24h)
GET    /api/games/:id            - Get game by ID
GET    /api/games/acronym/:acronym - Get game by acronym
```

### Tournaments
```
GET    /api/tournaments           - List tournaments with filters
GET    /api/tournaments/:id       - Get tournament details
```

### Matches
```
GET    /api/matches?date=YYYY-MM-DD - Get matches by date
GET    /api/matches/:id          - Get match details
```

### Articles
```
GET    /api/articles             - List articles with pagination
GET    /api/articles/:slug       - Get article by slug
GET    /api/articles/:slug/similar - Get similar articles
```

### Ads
```
GET    /api/ads                  - List active ads (cached 1h)
```

### Teams
```
GET    /api/teams/search?q=...   - Search teams
GET    /api/users/favorite-teams - Get user's favorite teams
GET    /api/users/favorite-teams/ids - Get user's favorite team IDs
POST   /api/users/favorite-teams/:teamId - Add favorite team
DELETE /api/users/favorite-teams/:teamId - Remove favorite team
```

### Notifications
```
GET    /api/notifications/preferences - Get notification settings
PATCH  /api/notifications/preferences - Update settings
POST   /api/notifications/:type/toggle - Toggle notification type
```

## Environment Variables

```env
# Server
PORT=4000
ENV=development

# Database
DATABASE_URL=postgres://esportnews:secret@localhost:5432/esportnews

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=jz0t+KB0qyBF/hsv4r0MCdEMYJGSfdFxpJ0V5usLuu8=

# Frontend
FRONTEND_URL=http://localhost:3000

# APIs
PANDASCORE_API_KEY=rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk
```

## Performance Features

1. **Connection Pooling**: pgx with 25-100 connections
2. **Redis Caching**: Multi-level caching with appropriate TTLs
3. **Concurrent Requests**: Go's goroutines for handling thousands of concurrent requests
4. **Request Context Timeouts**: 5s for handlers, 30s for external APIs
5. **Gzip Compression**: Automatic response compression (level 6)
6. **Rate Limiting**: 100 requests/minute per IP
7. **PandaScore Polling**: Background goroutine with 5-minute interval

## Troubleshooting

### PostgreSQL connection refused
```bash
# Check if postgres container is healthy
docker-compose ps postgres

# View logs
docker logs esportnews-db

# Restart postgres
docker-compose restart postgres
```

### Redis connection refused
```bash
# Check if redis container is running
docker-compose ps redis

# View logs
docker logs esportnews-cache

# Restart redis
docker-compose restart redis
```

### PandaScore poller not syncing
```bash
# Check logs
docker logs esportnews-backend | grep "PandaScore"

# Manually trigger sync (would need internal endpoint)
# For now, check that PANDASCORE_API_KEY is set correctly
```

### Build failures
```bash
# Clean and rebuild
cd backend-go
go clean
go mod download
go build -o /tmp/esportnews-backend ./cmd/server
```

## Development Workflow

### Local Development (without Docker)

1. Start PostgreSQL and Redis with Docker:
   ```bash
   docker-compose up -d postgres redis
   ```

2. Run database migrations:
   ```bash
   cd backend-go
   goose -dir migrations postgres "postgres://esportnews:secret@localhost:5432/esportnews" up
   ```

3. Start Go server:
   ```bash
   cd backend-go
   go run ./cmd/server
   ```

4. Start Next.js frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Making Database Changes

1. Create new migration:
   ```bash
   cd backend-go
   goose create migration_name sql
   ```

2. Edit `migrations/TIMESTAMP_migration_name.sql`

3. Apply migration:
   ```bash
   goose -dir migrations postgres "postgres://esportnews:secret@localhost:5432/esportnews" up
   ```

## Next Steps

1. ✅ Backend implemented with all endpoints
2. ✅ Docker Compose setup with PostgreSQL, Redis, Go, Next.js
3. ✅ PandaScore poller for tournament/match sync
4. 📋 Performance benchmarks (Go vs Node.js)
5. 📋 Load testing (k6 or Apache JMeter)
6. 📋 Deployment to VPS with Dockerploy

## Notes

- JWT tokens are stored in Redis for blacklist capability (7-day TTL)
- All user operations require Bearer token in Authorization header
- PandaScore poller runs automatically on startup (no manual trigger needed)
- Cache invalidation happens automatically on data mutations
- TODO: Implement proper avatar upload (currently returns 501)
- TODO: Implement teams table in database (currently searches non-existent table)
