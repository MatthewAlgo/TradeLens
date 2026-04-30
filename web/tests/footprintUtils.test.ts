import { describe, expect, it } from 'vitest';
import { buildFootprintCandle, rollupFootprintLevels } from '../src/utils/footprint';

describe('footprint utils', () => {
  it('rolls up levels into grouping buckets', () => {
    const levels = [
      { price_level: 100, bid_volume: 1, ask_volume: 1, delta: 0, total_volume: 2 },
      { price_level: 101, bid_volume: 2, ask_volume: 2, delta: 0, total_volume: 4 },
    ];

    const rolled = rollupFootprintLevels(levels, 200);
    expect(rolled).toHaveLength(1);
    expect(rolled[0].total_volume).toBe(6);
  });

  it('calculates POC, totals, and unfinished auction flags', () => {
    const candle = buildFootprintCandle({
      time: '2025-01-01T00:00:00.000Z',
      levels: [
        { price_level: 100, bid_volume: 1, ask_volume: 1, delta: 0, total_volume: 2 },
        { price_level: 101, bid_volume: 5, ask_volume: 2, delta: -3, total_volume: 7 },
      ],
    }, 100);

    expect(candle.poc_price_level).toBe(101);
    expect(candle.total_volume).toBe(9);
    expect(candle.unfinished_auction_top).toBe(true);
  });
});
