# ============================================
# TradeLens — Unified Build & Operations
# ============================================

.PHONY: help infra-up infra-down up down build test create-topics health-check run-migrations

# Default target
help:
	@echo "╔══════════════════════════════════════════╗"
	@echo "║         TradeLens — Commands             ║"
	@echo "╠══════════════════════════════════════════╣"
	@echo "║  make infra-up      Start infrastructure ║"
	@echo "║  make infra-down    Stop infrastructure   ║"
	@echo "║  make up            Start everything      ║"
	@echo "║  make down          Stop everything       ║"
	@echo "║  make build         Build all services    ║"
	@echo "║  make test          Run all tests         ║"
	@echo "║  make create-topics Create Redpanda topics║"
	@echo "║  make run-migrations Apply DB migrations   ║"
	@echo "║  make health-check  Check all services    ║"
	@echo "║  make seed-data     Seed sample data      ║"
	@echo "║  make logs          Tail all logs         ║"
	@echo "║  make clean         Remove volumes/data   ║"
	@echo "╚══════════════════════════════════════════╝"

# --- Infrastructure ---
infra-up:
	@echo "🚀 Starting infrastructure..."
	docker compose up -d redpanda redpanda-console timescaledb postgres redis
	@echo "⏳ Waiting for services to be healthy..."
	@sleep 5
	@$(MAKE) health-check
	@$(MAKE) create-topics
	@$(MAKE) run-migrations

infra-down:
	docker compose down redpanda redpanda-console timescaledb postgres redis

# --- Full Stack ---
up:
	@echo "🚀 Starting TradeLens..."
	docker compose up -d --build
	@echo "⏳ Waiting for services..."
	@sleep 8
	@$(MAKE) create-topics
	@echo ""
	@echo "✅ TradeLens is running!"
	@echo "   📊 Frontend:         http://localhost:5173"
	@echo "   🔌 API Gateway:      http://localhost:4000"
	@echo "   📈 Redpanda Console: http://localhost:8080"
	@echo "   🧪 Backtester API:   http://localhost:8000/docs"

down:
	docker compose down

build:
	docker compose build

# --- Redpanda Topics ---
create-topics:
	@echo "📋 Creating Redpanda topics..."
	@docker exec tradelens-redpanda rpk topic create raw_ticks \
		--partitions 4 --config retention.ms=-1 2>/dev/null || true
	@docker exec tradelens-redpanda rpk topic create candles \
		--partitions 4 --config retention.ms=-1 2>/dev/null || true
	@docker exec tradelens-redpanda rpk topic create footprints \
		--partitions 4 --config retention.ms=-1 2>/dev/null || true
	@docker exec tradelens-redpanda rpk topic create order_events \
		--partitions 2 --config retention.ms=-1 2>/dev/null || true
	@docker exec tradelens-redpanda rpk topic create orderbook_updates \
		--partitions 4 --config retention.ms=-1 2>/dev/null || true
	@echo "✅ Topics created"

run-migrations:
	@echo "🗄️ Applying database migrations..."
	@for f in db/migrations/00[1-4]_*.sql; do \
		docker exec -i tradelens-timescaledb psql -U tradelens -d market_data < $$f >/dev/null; \
	done
	@for f in db/migrations/005_*.sql db/migrations/006_*.sql; do \
		docker exec -i tradelens-postgres psql -U tradelens -d tradelens < $$f >/dev/null; \
	done
	@echo "✅ Migrations applied"

# --- Health Checks ---
health-check:
	@echo "🏥 Health check..."
	@docker exec tradelens-redpanda rpk cluster health 2>/dev/null && echo "  ✅ Redpanda" || echo "  ❌ Redpanda"
	@docker exec tradelens-timescaledb pg_isready -U tradelens -d market_data 2>/dev/null && echo "  ✅ TimescaleDB" || echo "  ❌ TimescaleDB"
	@docker exec tradelens-postgres pg_isready -U tradelens -d tradelens 2>/dev/null && echo "  ✅ PostgreSQL" || echo "  ❌ PostgreSQL"
	@docker exec tradelens-redis redis-cli ping 2>/dev/null | grep -q PONG && echo "  ✅ Redis" || echo "  ❌ Redis"

# --- Testing ---
test: test-go test-python test-node test-web

test-go:
	@echo "🧪 Testing Go services..."
	cd services/market-data-ingester && go test ./... -v
	cd services/aggregator && go test ./... -v
	cd services/oms && go test ./... -v

test-python:
	@echo "🧪 Testing Python backtester..."
	cd services/backtester && \
		python3 -m venv .venv && \
		. .venv/bin/activate && \
		python -m pip install -q -r requirements.txt && \
		python -m pytest tests/ -v

test-node:
	@echo "🧪 Testing API Gateway..."
	cd services/api-gateway && npm test

test-web:
	@echo "🧪 Testing frontend..."
	cd web && npm test

test-pipeline:
	@echo "🧪 E2E Pipeline test..."
	@echo "Starting mock exchange → ingester → aggregator pipeline..."
	@./scripts/test-pipeline.sh

test-backtest:
	@echo "🧪 Backtest determinism test..."
	@./scripts/run-backtest.sh

# --- Utilities ---
logs:
	docker compose logs -f --tail=50

logs-ingester:
	docker compose logs -f market-data-ingester

logs-aggregator:
	docker compose logs -f aggregator

seed-data:
	@echo "🌱 Seeding sample data..."
	@./scripts/seed-data.sh

clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v --remove-orphans
	@echo "✅ All volumes and containers removed"

# --- Development ---
dev-gateway:
	cd services/api-gateway && npm run dev

dev-web:
	cd web && npm run dev

dev-backtester:
	cd services/backtester && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
