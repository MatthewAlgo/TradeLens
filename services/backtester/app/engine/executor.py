"""Backtest executor — the main event-driven simulation loop."""

import importlib.util
import os

from app.engine.event import FillEvent
from app.engine.data_handler import DataHandler
from app.engine.portfolio import Portfolio


class SimulatedExecutor:
    """Simulates order execution with slippage and commission."""

    def __init__(self, commission_rate: float = 0.001, slippage_bps: float = 5.0):
        self.commission_rate = commission_rate
        self.slippage_bps = slippage_bps

    def execute(self, order, current_price: float) -> FillEvent:
        """Execute an order against the current market price."""
        slippage = current_price * (self.slippage_bps / 10000.0)
        if order.side == "BUY":
            fill_price = current_price + slippage
        else:
            fill_price = current_price - slippage

        cost = fill_price * order.quantity
        commission = cost * self.commission_rate

        return FillEvent(
            timestamp=order.timestamp,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            fill_price=fill_price,
            commission=commission,
            slippage=slippage * order.quantity,
        )


class BacktestExecutor:
    """Runs a complete backtest for a given strategy and parameters."""

    # Storage for in-progress and completed backtests
    results_store: dict = {}

    @classmethod
    def run_backtest(
        cls,
        backtest_id: str,
        strategy_name: str,
        symbol: str,
        interval: str,
        start_date: str,
        end_date: str,
        initial_capital: float = 100000.0,
        commission_rate: float = 0.001,
        params: dict = None,
    ) -> dict:
        """Execute a full backtest and return results."""

        cls.results_store[backtest_id] = {"status": "running", "progress": 0}

        try:
            # Load strategy
            strategy = cls._load_strategy(strategy_name, params or {})

            # Initialize components
            data_handler = DataHandler(symbol, interval, start_date, end_date)
            data_handler.load_data()

            portfolio = Portfolio(
                initial_capital=initial_capital,
                commission_rate=commission_rate,
            )
            executor = SimulatedExecutor(commission_rate=commission_rate)

            # Main event loop
            total_bars = len(data_handler.data) if data_handler.data is not None else 0
            bar_count = 0

            for market_event in data_handler.get_bars():
                bar_count += 1

                # Update progress
                if total_bars > 0 and bar_count % 50 == 0:
                    progress = int((bar_count / total_bars) * 100)
                    cls.results_store[backtest_id]["progress"] = progress

                # 1. Strategy processes market data → may produce a signal
                signal = strategy.on_data(market_event)

                # 2. If signal, portfolio converts it to an order
                if signal:
                    order = portfolio.on_signal(signal, market_event.close)

                    # 3. If order, executor simulates the fill
                    if order:
                        fill = executor.execute(order, market_event.close)

                        # 4. Portfolio updates state with the fill
                        portfolio.on_fill(fill)

                        # 5. Notify strategy of the fill
                        strategy.on_fill(fill)

                # Update equity curve
                portfolio.update_equity(
                    market_event.timestamp,
                    {symbol: market_event.close}
                )

            # Get results
            results = portfolio.get_results()
            results["backtest_id"] = backtest_id
            results["strategy"] = strategy_name
            results["symbol"] = symbol
            results["interval"] = interval
            results["status"] = "completed"

            cls.results_store[backtest_id] = results
            return results

        except Exception as e:
            error_result = {
                "backtest_id": backtest_id,
                "status": "failed",
                "error": str(e),
            }
            cls.results_store[backtest_id] = error_result
            raise

    @classmethod
    def _load_strategy(cls, name: str, params: dict):
        """Load a strategy by name from the built-in strategies directory."""
        strategies_dir = os.path.join(os.path.dirname(__file__), "..", "strategies")
        strategy_file = os.path.join(strategies_dir, f"{name}.py")

        if not os.path.exists(strategy_file):
            raise FileNotFoundError(f"Strategy not found: {name}")

        spec = importlib.util.spec_from_file_location(name, strategy_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Look for a class that has on_data and on_fill methods
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type) and
                hasattr(attr, "on_data") and
                hasattr(attr, "on_fill") and
                attr_name != "Strategy"):
                return attr(**params)

        raise ValueError(f"No valid strategy class found in {name}.py")
