# TradeLens API Reference

## Gateway Base URL

- `http://localhost:4000`

## REST Endpoints

### Health

- `GET /health`

### Market Data

- `GET /api/instruments`
- `GET /api/candles/:symbol/:interval?limit=500`
- `GET /api/footprints/:symbol/:interval?limit=100`

### Orders / Portfolio

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/portfolio`
- `GET /api/positions`

### Backtesting

- `POST /api/backtest/run`
- `GET /api/backtest/:id`
- `GET /api/strategies`

## WebSocket

- URL: `ws://localhost:4000/ws`

Client commands:

- `{"action":"subscribe","channel":"candles:BTCUSDT:1m"}`
- `{"action":"unsubscribe","channel":"candles:BTCUSDT:1m"}`

Live channels:

- `candles:{symbol}:{interval}`
- `footprints:{symbol}:{interval}`
- `ticks:{symbol}`
- `orders`
