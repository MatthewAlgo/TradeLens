# Agent Workspaces Guide

This project leverages GitHub Workspaces and local development setups meant to be driven by autonomous coding agents.
When you are assigned a task on TradeLens, strictly adhere to the guidelines established in `CLAUDE.md`.

## Workflow for Agents

1. **Understand the Architecture**: Read the `README.md` diagram to understand data flows.
2. **Setup**: If running locally, ALWAYS ensure you execute `make up` to verify your changes haven't broken the pipeline.
3. **Adding New Components**: If adding a new component (e.g. a new exchange adapter), place it in `services/market-data-ingester/internal/adapters/`.
4. **Modifying Schemas**: Any schema changes MUST be made in `proto/` and you must run `buf generate` or the equivalent generation step to update bindings across Go, Python, and TypeScript.
5. **Testing**: Run `make test` before pushing to ensure all integration and unit tests pass.

## Microservices Breakdown for Agents

- `mock-exchange`: Generates synthetic crypto trades. Written in Python. Use for local isolated development.
- `market-data-ingester`: Go service. Normalizes exchange WS JSON into Protobuf and publishes to Redpanda.
- `aggregator`: Go service. Subscribes to raw ticks from Redpanda, aggregates them into OHLCV and Footprint clusters, writes to TimescaleDB.
- `oms`: Go service. Order Management System that handles paper trading logic and portfolio state.
- `backtester`: Python FastAPI service. Runs event-driven backtests over historical TimescaleDB data.
- `api-gateway`: Node.js/TypeScript service. Central entrypoint for frontend. Handles REST routing and WebSocket multiplexing.
- `web`: React/Vite/TS frontend. Consumes Gateway API.

Please ensure any Dockerfile updates maintain the `node:20-alpine` standard for web/gateway to prevent QEMU segfaults on ARM architectures.
