"""SMA Crossover Strategy — Example built-in strategy."""

from typing import Optional
from app.engine.event import MarketEvent, SignalEvent, FillEvent, SignalType


class SMACrossoverStrategy:
    """
    Simple Moving Average Crossover Strategy.

    Buy when the fast SMA crosses above the slow SMA.
    Sell when the fast SMA crosses below the slow SMA.
    """

    def __init__(self, fast_period: int = 10, slow_period: int = 30):
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.prices: list[float] = []
        self.in_position = False

    def on_data(self, event: MarketEvent) -> Optional[SignalEvent]:
        """Process a market event and potentially generate a signal."""
        self.prices.append(event.close)

        # Need enough data for the slow SMA
        if len(self.prices) < self.slow_period:
            return None

        fast_sma = sum(self.prices[-self.fast_period:]) / self.fast_period
        slow_sma = sum(self.prices[-self.slow_period:]) / self.slow_period

        # Also check previous SMAs for crossover detection
        if len(self.prices) < self.slow_period + 1:
            return None

        prev_fast = sum(self.prices[-(self.fast_period + 1):-1]) / self.fast_period
        prev_slow = sum(self.prices[-(self.slow_period + 1):-1]) / self.slow_period

        # Golden Cross: fast crosses above slow
        if prev_fast <= prev_slow and fast_sma > slow_sma and not self.in_position:
            return SignalEvent(
                timestamp=event.timestamp,
                symbol=event.symbol,
                signal_type=SignalType.BUY,
                strength=1.0,
                metadata={"fast_sma": fast_sma, "slow_sma": slow_sma},
            )

        # Death Cross: fast crosses below slow
        if prev_fast >= prev_slow and fast_sma < slow_sma and self.in_position:
            return SignalEvent(
                timestamp=event.timestamp,
                symbol=event.symbol,
                signal_type=SignalType.SELL,
                strength=1.0,
                metadata={"fast_sma": fast_sma, "slow_sma": slow_sma},
            )

        return None

    def on_fill(self, event: FillEvent) -> None:
        """Update internal state after a fill."""
        if event.side == "BUY":
            self.in_position = True
        elif event.side == "SELL":
            self.in_position = False
