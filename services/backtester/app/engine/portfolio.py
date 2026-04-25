"""Simulated portfolio and position management for backtesting."""

from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np

from app.engine.event import SignalEvent, OrderEvent, FillEvent, OrderType, SignalType


@dataclass
class TradeRecord:
    """Record of a completed trade."""
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    commission: float
    entry_time: float
    exit_time: float


@dataclass
class PositionState:
    symbol: str
    side: str  # "LONG" or "SHORT"
    quantity: float
    avg_entry: float
    entry_time: float


class Portfolio:
    """
    Manages the simulated portfolio during a backtest.
    Converts signals into orders and tracks equity.
    """

    def __init__(
        self,
        initial_capital: float = 100000.0,
        commission_rate: float = 0.001,
        position_size_pct: float = 0.1,  # 10% of capital per trade
    ):
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.commission_rate = commission_rate
        self.position_size_pct = position_size_pct
        self.positions: Dict[str, PositionState] = {}
        self.trades: List[TradeRecord] = []
        self.equity_curve: List[float] = [initial_capital]
        self.timestamps: List[float] = [0]

    def on_signal(self, signal: SignalEvent, current_price: float) -> Optional[OrderEvent]:
        """Convert a signal into an order based on position sizing rules."""
        symbol = signal.symbol

        if signal.signal_type == SignalType.BUY:
            if symbol in self.positions:
                return None  # Already in a position

            # Calculate position size
            trade_value = self.cash * self.position_size_pct
            quantity = trade_value / current_price

            return OrderEvent(
                timestamp=signal.timestamp,
                symbol=symbol,
                order_type=OrderType.MARKET,
                side="BUY",
                quantity=quantity,
                price=current_price,
            )

        elif signal.signal_type == SignalType.SELL:
            if symbol not in self.positions:
                return None  # No position to close

            pos = self.positions[symbol]
            return OrderEvent(
                timestamp=signal.timestamp,
                symbol=symbol,
                order_type=OrderType.MARKET,
                side="SELL",
                quantity=pos.quantity,
                price=current_price,
            )

        elif signal.signal_type == SignalType.EXIT:
            if symbol not in self.positions:
                return None

            pos = self.positions[symbol]
            side = "SELL" if pos.side == "LONG" else "BUY"
            return OrderEvent(
                timestamp=signal.timestamp,
                symbol=symbol,
                order_type=OrderType.MARKET,
                side=side,
                quantity=pos.quantity,
                price=current_price,
            )

        return None

    def on_fill(self, fill: FillEvent):
        """Update portfolio state after an order fill."""
        symbol = fill.symbol

        if fill.side == "BUY":
            self.cash -= (fill.fill_price * fill.quantity + fill.commission)
            self.positions[symbol] = PositionState(
                symbol=symbol,
                side="LONG",
                quantity=fill.quantity,
                avg_entry=fill.fill_price,
                entry_time=fill.timestamp,
            )
        elif fill.side == "SELL":
            self.cash += (fill.fill_price * fill.quantity - fill.commission)

            if symbol in self.positions:
                pos = self.positions[symbol]
                pnl = (fill.fill_price - pos.avg_entry) * fill.quantity - fill.commission
                self.trades.append(TradeRecord(
                    symbol=symbol,
                    side="LONG",
                    entry_price=pos.avg_entry,
                    exit_price=fill.fill_price,
                    quantity=fill.quantity,
                    pnl=pnl,
                    commission=fill.commission,
                    entry_time=pos.entry_time,
                    exit_time=fill.timestamp,
                ))
                del self.positions[symbol]

    def update_equity(self, timestamp: float, prices: Dict[str, float]):
        """Update equity curve with current market values."""
        total = self.cash
        for symbol, pos in self.positions.items():
            if symbol in prices:
                total += prices[symbol] * pos.quantity
        self.equity_curve.append(total)
        self.timestamps.append(timestamp)

    def get_results(self) -> dict:
        """Calculate and return backtest performance metrics."""
        equity = np.array(self.equity_curve)
        returns = np.diff(equity) / equity[:-1] if len(equity) > 1 else np.array([0])

        total_return = (equity[-1] / self.initial_capital - 1) * 100
        max_drawdown = self._max_drawdown(equity) * 100
        sharpe = self._sharpe_ratio(returns)
        win_rate = self._win_rate()

        return {
            "initial_capital": self.initial_capital,
            "final_equity": round(equity[-1], 2),
            "total_return_pct": round(total_return, 2),
            "max_drawdown_pct": round(max_drawdown, 2),
            "sharpe_ratio": round(sharpe, 4),
            "total_trades": len(self.trades),
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": round(self._profit_factor(), 4),
            "avg_trade_pnl": round(np.mean([t.pnl for t in self.trades]), 2) if self.trades else 0,
            "equity_curve": [round(e, 2) for e in self.equity_curve],
            "trades": [
                {
                    "symbol": t.symbol,
                    "side": t.side,
                    "entry_price": round(t.entry_price, 2),
                    "exit_price": round(t.exit_price, 2),
                    "quantity": round(t.quantity, 6),
                    "pnl": round(t.pnl, 2),
                    "commission": round(t.commission, 2),
                }
                for t in self.trades
            ],
        }

    def _max_drawdown(self, equity: np.ndarray) -> float:
        peak = np.maximum.accumulate(equity)
        drawdown = (peak - equity) / peak
        return float(np.max(drawdown)) if len(drawdown) > 0 else 0.0

    def _sharpe_ratio(self, returns: np.ndarray, risk_free: float = 0.0) -> float:
        if len(returns) == 0 or np.std(returns) == 0:
            return 0.0
        excess = returns - risk_free / 252
        return float(np.mean(excess) / np.std(excess) * np.sqrt(252))

    def _win_rate(self) -> float:
        if not self.trades:
            return 0.0
        winners = sum(1 for t in self.trades if t.pnl > 0)
        return (winners / len(self.trades)) * 100

    def _profit_factor(self) -> float:
        gross_profit = sum(t.pnl for t in self.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if t.pnl < 0))
        if gross_loss == 0:
            return float("inf") if gross_profit > 0 else 0.0
        return gross_profit / gross_loss
