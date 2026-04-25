"""
TradeLens Backtesting Engine — FastAPI service for event-driven strategy backtesting.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import backtest_router, strategy_router

app = FastAPI(
    title="TradeLens Backtester",
    description="Event-driven backtesting engine for trading strategies",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(backtest_router.router, prefix="/api/backtest", tags=["Backtest"])
app.include_router(strategy_router.router, prefix="/api/strategies", tags=["Strategies"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backtester"}


@app.get("/")
def root():
    return {
        "service": "TradeLens Backtester",
        "version": "1.0.0",
        "docs": "/docs",
    }
