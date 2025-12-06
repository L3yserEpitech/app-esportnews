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

start: ## Full rebuild and start
	docker compose down && docker compose up --build

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