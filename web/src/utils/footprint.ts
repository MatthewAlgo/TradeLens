import type { FootprintCandle, FootprintLevel } from '../types/market';

export type FootprintDisplayMode = 'split' | 'total';

export interface FootprintViewState {
  tickGrouping: number;
  displayMode: FootprintDisplayMode;
  heatmap: boolean;
  compactMode: boolean;
  zoom: number;
}

const DEFAULT_IMBALANCE_RATIO = 3;

const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeLevels = (levels: FootprintLevel[]): FootprintLevel[] =>
  levels.map((level) => ({
    price_level: toNumber(level.price_level),
    bid_volume: toNumber(level.bid_volume),
    ask_volume: toNumber(level.ask_volume),
    delta: level.delta != null ? toNumber(level.delta) : toNumber(level.ask_volume) - toNumber(level.bid_volume),
    total_volume: level.total_volume != null
      ? toNumber(level.total_volume)
      : toNumber(level.ask_volume) + toNumber(level.bid_volume),
  }));

const applyImbalances = (levels: FootprintLevel[], ratio = DEFAULT_IMBALANCE_RATIO): FootprintLevel[] => {
  if (levels.length < 2) return levels;
  const enriched = levels.map((level) => ({ ...level }));
  for (let i = 0; i < enriched.length - 1; i += 1) {
    const lower = enriched[i];
    const upper = enriched[i + 1];
    if (upper.ask_volume >= lower.bid_volume * ratio && upper.ask_volume > 0) {
      upper.imbalance = 'buy';
    }
    if (lower.bid_volume >= upper.ask_volume * ratio && lower.bid_volume > 0) {
      lower.imbalance = 'sell';
    }
  }
  return enriched;
};

export const rollupFootprintLevels = (levels: FootprintLevel[], targetGrouping: number): FootprintLevel[] => {
  const groupingPrice = targetGrouping / 100;
  const buckets = new Map<number, FootprintLevel>();
  for (const level of levels) {
    const bucketPrice = Math.floor(level.price_level / groupingPrice) * groupingPrice;
    const existing = buckets.get(bucketPrice);
    if (!existing) {
      buckets.set(bucketPrice, {
        price_level: bucketPrice,
        bid_volume: level.bid_volume,
        ask_volume: level.ask_volume,
        delta: level.delta,
        total_volume: level.total_volume,
      });
    } else {
      existing.bid_volume += level.bid_volume;
      existing.ask_volume += level.ask_volume;
      existing.delta += level.delta;
      existing.total_volume += level.total_volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.price_level - b.price_level);
};

export const buildFootprintCandle = (raw: FootprintCandle, tickGrouping: number): FootprintCandle => {
  if (!raw.levels || raw.levels.length === 0) {
    return {
      ...raw,
      tick_grouping: tickGrouping,
      levels: [],
      poc_price_level: null,
      delta_total: 0,
      total_volume: 0,
      unfinished_auction_top: false,
      unfinished_auction_bottom: false,
    };
  }

  const normalized = normalizeLevels(raw.levels);
  const rolled = rollupFootprintLevels(normalized, tickGrouping);
  const sorted = rolled.slice().sort((a, b) => a.price_level - b.price_level);
  const enriched = applyImbalances(sorted, DEFAULT_IMBALANCE_RATIO);

  let pocLevel = enriched[0];
  let deltaTotal = 0;
  let totalVolume = 0;
  for (const level of enriched) {
    deltaTotal += level.delta;
    totalVolume += level.total_volume;
    if (level.total_volume > pocLevel.total_volume) {
      pocLevel = level;
    }
  }

  const top = enriched[enriched.length - 1];
  const bottom = enriched[0];
  const unfinishedTop = top.bid_volume > 0 && top.ask_volume > 0;
  const unfinishedBottom = bottom.bid_volume > 0 && bottom.ask_volume > 0;

  return {
    ...raw,
    tick_grouping: tickGrouping,
    levels: enriched,
    poc_price_level: pocLevel.price_level,
    delta_total: deltaTotal,
    total_volume: totalVolume,
    unfinished_auction_top: unfinishedTop,
    unfinished_auction_bottom: unfinishedBottom,
  };
};

export const applyDeltaDivergence = (candles: FootprintCandle[], lookback = 8): FootprintCandle[] => {
  if (candles.length === 0) return candles;
  const enriched = candles.map((c) => ({ ...c }));
  for (let i = 1; i < enriched.length; i += 1) {
    const windowStart = Math.max(0, i - lookback);
    const history = enriched.slice(windowStart, i);
    const current = enriched[i];

    const maxPrice = Math.max(
      0,
      ...history.map((c) => Math.max(0, ...c.levels.map((l) => l.price_level)))
    );
    const maxDelta = Math.max(0, ...history.map((c) => c.delta_total ?? 0));

    const currentHigh = Math.max(0, ...current.levels.map((l) => l.price_level));
    const currentDelta = current.delta_total ?? 0;

    current.delta_divergence = currentHigh > maxPrice && currentDelta < maxDelta;
  }
  return enriched;
};

export const buildFootprintSeries = (rawCandles: FootprintCandle[], view: FootprintViewState): FootprintCandle[] => {
  const processed = rawCandles.map((candle) => buildFootprintCandle(candle, view.tickGrouping));
  return applyDeltaDivergence(processed);
};
