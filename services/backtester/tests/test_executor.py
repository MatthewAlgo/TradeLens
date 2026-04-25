from app.engine.executor import BacktestExecutor


def test_run_backtest_completes_with_synthetic_data():
    backtest_id = "test-backtest-001"

    result = BacktestExecutor.run_backtest(
        backtest_id=backtest_id,
        strategy_name="sma_crossover",
        symbol="BTCUSDT",
        interval="1h",
        start_date="2024-01-01",
        end_date="2024-01-03",
        initial_capital=100000.0,
        commission_rate=0.001,
        params={"fast_period": 5, "slow_period": 20},
    )

    assert result["status"] == "completed"
    assert result["backtest_id"] == backtest_id
    assert isinstance(result["equity_curve"], list)
    assert len(result["equity_curve"]) > 1
    assert BacktestExecutor.results_store[backtest_id]["status"] == "completed"
