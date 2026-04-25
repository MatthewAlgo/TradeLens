"""Pydantic models for backtest API requests and responses."""

from typing import Dict
from pydantic import BaseModel


class BacktestRequest(BaseModel):
    strategy: str = "sma_crossover"
    symbol: str = "BTCUSDT"
    interval: str = "1h"
    start_date: str = "2024-01-01"
    end_date: str = "2024-12-31"
    initial_capital: float = 100000.0
    commission_rate: float = 0.001
    params: Dict[str, float | int | str | bool] = {}
