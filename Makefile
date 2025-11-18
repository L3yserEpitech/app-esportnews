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

start:
	docker compose down && docker compose build && docker compose up