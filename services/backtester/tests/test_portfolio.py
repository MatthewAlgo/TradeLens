from app.engine.event import FillEvent, SignalEvent, SignalType
from app.engine.portfolio import Portfolio


def test_portfolio_generates_buy_order_from_signal():
    portfolio = Portfolio(initial_capital=1000.0, commission_rate=0.001, position_size_pct=0.5)
    signal = SignalEvent(timestamp=1.0, symbol="BTCUSDT", signal_type=SignalType.BUY)

    order = portfolio.on_signal(signal, current_price=100.0)

    assert order is not None
    assert order.side == "BUY"
    assert order.quantity > 0


def test_portfolio_updates_position_and_trade_history_on_fill_cycle():
    portfolio = Portfolio(initial_capital=1000.0, commission_rate=0.001, position_size_pct=0.5)

    buy_fill = FillEvent(
        timestamp=1.0,
        symbol="BTCUSDT",
        side="BUY",
        quantity=2.0,
        fill_price=100.0,
        commission=0.2,
    )
    portfolio.on_fill(buy_fill)
    assert "BTCUSDT" in portfolio.positions

    sell_fill = FillEvent(
        timestamp=2.0,
        symbol="BTCUSDT",
        side="SELL",
        quantity=2.0,
        fill_price=110.0,
        commission=0.22,
    )
    portfolio.on_fill(sell_fill)

    assert "BTCUSDT" not in portfolio.positions
    assert len(portfolio.trades) == 1
    assert portfolio.trades[0].pnl > 0
