# TradeLens — AI Agent Guidelines

Welcome to the TradeLens repository! This file provides instructions for AI agents (like Claude, Cursor, or other LLMs) working on this codebase.

## Tech Stack Overview

- **Go**: Market Data Ingester, Aggregator, OMS (Order Management System).
- **Python**: Backtesting Engine (`FastAPI`, `NumPy`, `Pandas`).
- **Node.js/TypeScript**: API Gateway (REST + WebSockets).
- **React/TypeScript**: Frontend UI with `TradingView Lightweight Charts` and `PixiJS` WebGL footprints.
- **Infrastructure**: Docker Compose, Redpanda (Kafka), PostgreSQL, TimescaleDB, Redis.

## Important Architectural Notes

1. **Protobuf is the Source of Truth**: All data passing through Redpanda must be serialized using Protobuf schemas defined in `proto/`. Do not use JSON for inter-service messaging.
2. **Microservices Communication**:
   - High-throughput market data (ticks, candles, orderbook) flows via **Redpanda**.
   - Direct synchronous queries (e.g., getting portfolio balance) use REST APIs between services.
   - Real-time updates to the frontend are multiplexed via the **API Gateway** over WebSockets.
3. **Database Usage**:
   - `TimescaleDB`: ONLY used for time-series data (Ticks, Candles, Footprints).
   - `PostgreSQL`: Used for stateful entities (Users, Orders, Positions).
   - `Redis`: Used for ephemeral states like the live Order Book and session caching.

## Build and Run Commands

The repository relies heavily on `make`. Always use these commands when testing or running the stack:

- `make infra-up`: Starts the underlying databases and message brokers.
- `make up`: Builds and starts all application microservices.
- `make test`: Runs all unit tests across all languages.
- `make test-pipeline`: Runs an E2E test verifying data flow from Mock Exchange to TimescaleDB.
- `make test-backtest`: Runs an E2E test verifying deterministic backtester execution.
- `make clean`: Completely removes all Docker volumes and orphans (use carefully).

## Development Rules

1. **Always add tests**: Any new feature must have accompanying unit tests in its respective language.
2. **No hardcoded credentials**: Always use environment variables defined in `.env`.
3. **Namespace isolation**: All application containers MUST include the `namespace=tradelens-app` label in `docker-compose.yml`.
4. **Formatting**: Use standard formatting (`go fmt`, `black`, `prettier`) before committing.
