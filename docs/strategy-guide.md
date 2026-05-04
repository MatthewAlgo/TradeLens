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

## Using the Indicator Library

Vectorized technical indicators are available in `app.engine.indicators`:

```python
from app.engine.indicators import Indicators

# In your strategy
sma = Indicators.sma(self.price_series, window=20)
rsi = Indicators.rsi(self.price_series, window=14)
```

## Security & Sandboxing

All strategies are subjected to **static code analysis** before execution.
- **Allowed Imports**: `math`, `datetime`, `pandas`, `numpy`, `app.engine.*`.
- **Forbidden**: `os`, `sys`, `subprocess`, `socket`, `requests`, and unsafe built-ins like `eval` or `exec`.

## Running a Backtest

```bash
curl -X POST http://localhost:4000/api/backtest/run \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"sma_crossover","symbol":"BTCUSDT","interval":"1h","start_date":"2024-01-01","end_date":"2024-01-31"}'
```
