.PHONY: up down build restart logs lint lint-fix clean help

# Default target
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services
	docker-compose up

up-d: ## Start all services in detached mode
	docker-compose up -d

down: ## Stop all services
	docker-compose down

build: ## Build all services
	docker-compose build

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs for all services
	docker-compose logs -f

logs-backend: ## Show backend logs only
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs only
	docker-compose logs -f frontend

lint: ## Run linting on backend
	cd backend && npm run lint

lint-fix: ## Run linting with auto-fix on backend
	cd backend && npm run lint:fix

clean: ## Remove all containers, images and volumes
	docker-compose down -v --rmi all --remove-orphans

dev-backend: ## Run backend in development mode
	cd backend && npm run dev

install-backend: ## Install backend dependencies
	cd backend && npm install

status: ## Show status of services
	docker-compose ps

start: ## Start in development mode with hot reload
	docker compose -f docker-compose.dev.yml up

dev: ## Start local dev (postgres, redis, backend, frontend - all local)
	docker compose -f docker-compose.dev.yml down --remove-orphans && docker compose -f docker-compose.dev.yml up --build

preview: ## Start frontend local + Railway dev backend (uses .env.preview)
	docker compose --env-file .env.preview -f docker-compose.local-prod.yml down --remove-orphans && docker compose --env-file .env.preview -f docker-compose.local-prod.yml up --build

prod: ## Start frontend local + production backend (uses .env.prod)
	docker compose --env-file .env.prod -f docker-compose.local-prod.yml down --remove-orphans && docker compose --env-file .env.prod -f docker-compose.local-prod.yml up --build

start-d: ## Start in development mode (detached) with hot reload
	docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up --build -d

start-prod: ## Full rebuild and start in production mode (uses .env.prod)
	docker compose --env-file .env.prod down && docker compose --env-file .env.prod up --build

dev-logs: ## Show logs for development services
	docker compose -f docker-compose.dev.yml logs -f

dev-logs-frontend: ## Show frontend logs (development)
	docker compose -f docker-compose.dev.yml logs -f frontend

dev-logs-backend: ## Show backend logs (development)
	docker compose -f docker-compose.dev.yml logs -f backend

dev-down: ## Stop development services
	docker compose -f docker-compose.dev.yml down

preview-down: ## Stop preview services
	docker compose --env-file .env.preview -f docker-compose.local-prod.yml down

preview-logs: ## Show logs for preview frontend
	docker compose --env-file .env.preview -f docker-compose.local-prod.yml logs -f

prod-down: ## Stop local-prod services
	docker compose --env-file .env.prod -f docker-compose.local-prod.yml down

prod-logs: ## Show logs for local-prod frontend
	docker compose --env-file .env.prod -f docker-compose.local-prod.yml logs -f

dev-restart: ## Restart development services
	docker compose -f docker-compose.dev.yml restart

dev-restart-frontend: ## Restart frontend only (development)
	docker compose -f docker-compose.dev.yml restart frontend

seed: ## Import articles only (47 articles)
	@echo "📦 Importing articles..."
	docker-compose exec -T backend ./seed --data=initial_data/articles_rows.json
	@echo "✅ Articles imported!"

reset-db: ## Reset database volumes completely
	@echo "🗑️  Removing all volumes..."
	docker-compose down --volumes
	@echo "✅ Volumes removed!"

feed-all: ## Import all data (users, games, ads, articles) - requires containers to be running
	@echo "🔄 Starting data import..."
	@echo ""
	@echo "1️⃣  Flushing Redis cache..."
	docker-compose exec -T redis redis-cli FLUSHALL
	@echo ""
	@echo "2️⃣  Importing 47 articles..."
	docker-compose exec -T backend ./seed --data=initial_data/articles_rows.json
	@echo ""
	@echo "✅ All done! Data imported:"
	@echo "   - Users: imported via migration 00002_users.sql"
	@echo "   - Games: imported via migration 00003_games.sql (10 games)"
	@echo "   - Ads: imported via migration 00004_ads.sql (2 ads)"
	@echo "   - Articles: imported via seed (47 articles)"
	@echo ""
	@echo "📊 Verifying data..."
	@echo -n "   Users: "
	@docker-compose exec -T postgres psql -U postgres -d esportnews -t -c "SELECT COUNT(*) FROM users;" | xargs
	@echo -n "   Games: "
	@docker-compose exec -T postgres psql -U postgres -d esportnews -t -c "SELECT COUNT(*) FROM games;" | xargs
	@echo -n "   Ads: "
	@docker-compose exec -T postgres psql -U postgres -d esportnews -t -c "SELECT COUNT(*) FROM ads;" | xargs
	@echo -n "   Articles: "
	@docker-compose exec -T postgres psql -U postgres -d esportnews -t -c "SELECT COUNT(*) FROM articles;" | xargs
	@echo ""
	@echo "🚀 Backend ready at http://localhost:4000"
	@echo "🎨 Frontend ready at http://localhost:3002"