"""Backtest API endpoints."""
from fastapi import APIRouter, BackgroundTasks, HTTPException
import uuid
from app.engine.executor import BacktestExecutor
from app.models.backtest import BacktestRequest

router = APIRouter()

@router.post("/run")
async def run_backtest(req: BacktestRequest, background_tasks: BackgroundTasks):
    backtest_id = str(uuid.uuid4())
    background_tasks.add_task(
        BacktestExecutor.run_backtest,
        backtest_id=backtest_id, strategy_name=req.strategy,
        symbol=req.symbol, interval=req.interval,
        start_date=req.start_date, end_date=req.end_date,
        initial_capital=req.initial_capital, commission_rate=req.commission_rate,
        params=req.params,
    )
    return {"backtest_id": backtest_id, "status": "started"}

@router.get("/{backtest_id}")
async def get_result(backtest_id: str):
    result = BacktestExecutor.results_store.get(backtest_id)
    if not result:
        raise HTTPException(status_code=404, detail="Not found")
    return result

@router.get("/")
async def list_backtests():
    return {"backtests": [{"id": k, "status": v.get("status")} for k, v in BacktestExecutor.results_store.items()]}
