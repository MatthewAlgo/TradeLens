import { describe, expect, it } from 'vitest';
import { useMarketStore } from '../src/stores/marketStore';

describe('marketStore', () => {
  it('adds and updates candles by timestamp', () => {
    useMarketStore.setState({ candles: [] });

    useMarketStore.getState().addCandle({
      time: '2025-01-01T00:00:00.000Z',
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 10,
      trade_count: 2,
    });

    useMarketStore.getState().addCandle({
      time: '2025-01-01T00:00:00.000Z',
      open: 100,
      high: 111,
      low: 89,
      close: 106,
      volume: 12,
      trade_count: 3,
    });

    const state = useMarketStore.getState();
    expect(state.candles).toHaveLength(1);
    expect(state.candles[0].high).toBe(111);
  });

  it('caps recent ticks to 50 and updates current price', () => {
    useMarketStore.setState({ recentTicks: [], currentPrice: 0 });

    for (let i = 0; i < 55; i += 1) {
      useMarketStore.getState().addTick({
        timestamp_ms: i,
        symbol: 'BTCUSDT',
        price: 100 + i,
        quantity: 0.1,
        is_buyer_maker: false,
        trade_id: i,
        exchange: 'mock',
      });
    }

    const state = useMarketStore.getState();
    expect(state.recentTicks).toHaveLength(50);
    expect(state.currentPrice).toBe(154);
  });

  it('derives footprint metadata when view changes', () => {
    useMarketStore.setState({ rawFootprints: [], footprints: [] });

    const raw = [{
      time: '2025-01-01T00:00:00.000Z',
      levels: [
        { price_level: 100, bid_volume: 1, ask_volume: 4, delta: 3, total_volume: 5 },
        { price_level: 101, bid_volume: 6, ask_volume: 1, delta: -5, total_volume: 7 },
      ],
    }];

    useMarketStore.getState().setFootprints(raw as any);
    useMarketStore.getState().setFootprintView({ tickGrouping: 100 });

    const state = useMarketStore.getState();
    expect(state.footprints).toHaveLength(1);
    expect(state.footprints[0].poc_price_level).toBe(101);
    expect(state.footprints[0].delta_total).toBe(-2);
  });
});
