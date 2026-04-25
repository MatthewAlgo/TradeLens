# TradeLens Architecture

## Services

- `market-data-ingester` (Go): reads exchange trade streams and publishes normalized ticks to `raw_ticks`.
- `aggregator` (Go): builds candles and footprint levels from `raw_ticks`; writes to TimescaleDB.
- `oms` (Go): paper trading engine and order lifecycle APIs.
- `backtester` (Python/FastAPI): event-driven strategy simulation engine.
- `api-gateway` (Node/TS): single REST/WebSocket ingress for UI clients.
- `mock-exchange` (Python): deterministic local market stream source.

## Infrastructure

- Redpanda: event backbone (`raw_ticks`, `candles`, `footprints`, `order_events`).
- TimescaleDB: candle and footprint historical storage.
- PostgreSQL: order and user state tables.
- Redis: low-latency cache and ephemeral state.

## Data Flow

1. Exchange ticks enter through `market-data-ingester`.
2. `raw_ticks` are consumed by `aggregator` and `oms`.
3. Aggregated outputs are persisted and re-published as `candles`/`footprints`.
4. API Gateway forwards historical REST queries and streams live channel updates to the UI.

## MVP Non-Goals

- Multi-exchange failover and reconciliation.
- Production deployment topology (Kubernetes, service mesh, multi-region DR).
- Advanced risk and margining models.
