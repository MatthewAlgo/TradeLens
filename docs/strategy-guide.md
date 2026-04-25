# Strategy Guide

TradeLens backtesting strategies are Python classes loaded dynamically from
`services/backtester/app/strategies`.

## Required Interface

Each strategy class must implement:

- `on_data(self, event: MarketEvent) -> Optional[SignalEvent]`
- `on_fill(self, event: FillEvent) -> None`

## Example

```python
from app.engine.event import MarketEvent, SignalEvent, FillEvent, SignalType

class ExampleStrategy:
    def __init__(self, lookback: int = 20):
        self.lookback = lookback
        self.prices: list[float] = []

    def on_data(self, event: MarketEvent):
        self.prices.append(event.close)
        if len(self.prices) < self.lookback:
            return None
        if self.prices[-1] > sum(self.prices[-self.lookback:]) / self.lookback:
            return SignalEvent(timestamp=event.timestamp, symbol=event.symbol, signal_type=SignalType.BUY)
        return None

    def on_fill(self, event: FillEvent):
        return None
```

## Running a Backtest

```bash
curl -X POST http://localhost:4000/api/backtest/run \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"sma_crossover","symbol":"BTCUSDT","interval":"1h","start_date":"2024-01-01","end_date":"2024-01-31"}'
```
