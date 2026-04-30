import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFootprintCandles } from '../src/footprints/compute';

describe('footprint compute', () => {
  it('builds candles with POC and imbalance flags', () => {
    const rows = [
      {
        time: new Date('2025-01-01T00:00:00.000Z'),
        price_level: 100,
        tick_grouping: 100,
        bid_volume: 1,
        ask_volume: 9,
        delta: 8,
        total_volume: 10,
      },
      {
        time: new Date('2025-01-01T00:00:00.000Z'),
        price_level: 101,
        tick_grouping: 100,
        bid_volume: 8,
        ask_volume: 4,
        delta: -4,
        total_volume: 12,
      },
    ];

    const candles = buildFootprintCandles(rows, 100, 3);
    assert.equal(candles.length, 1);
    assert.equal(candles[0].poc_price_level, 101);
    assert.equal(candles[0].delta_total, 4);
    assert.ok(candles[0].levels.some((level) => level.imbalance));
  });
});
