export type ImbalanceSide = 'buy' | 'sell';

export interface FootprintLevel {
  price_level: number;
  bid_volume: number;
  ask_volume: number;
  delta: number;
  total_volume: number;
  imbalance?: ImbalanceSide;
}

export interface FootprintCandle {
  time: string;
  tick_grouping: number;
  levels: FootprintLevel[];
  poc_price_level: number | null;
  delta_total: number;
  total_volume: number;
  unfinished_auction_top: boolean;
  unfinished_auction_bottom: boolean;
}

interface FootprintRow {
  time: Date | string;
  price_level: number | string;
  tick_grouping: number | string;
  bid_volume: number | string;
  ask_volume: number | string;
  delta?: number | string | null;
  total_volume?: number | string | null;
}

const DEFAULT_IMBALANCE_RATIO = 3;

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLevel(row: FootprintRow): FootprintLevel {
  const bid = toNumber(row.bid_volume);
  const ask = toNumber(row.ask_volume);
  const delta = row.delta != null ? toNumber(row.delta) : ask - bid;
  const total = row.total_volume != null ? toNumber(row.total_volume) : ask + bid;
  return {
    price_level: toNumber(row.price_level),
    bid_volume: bid,
    ask_volume: ask,
    delta,
    total_volume: total,
  };
}

function applyImbalances(levels: FootprintLevel[], ratio: number): FootprintLevel[] {
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
}

export function rollupFootprintLevels(levels: FootprintLevel[], targetGrouping: number): FootprintLevel[] {
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
}

export function buildFootprintCandle(
  time: string,
  levels: FootprintLevel[],
  tickGrouping: number,
  imbalanceRatio = DEFAULT_IMBALANCE_RATIO
): FootprintCandle {
  if (levels.length === 0) {
    return {
      time,
      tick_grouping: tickGrouping,
      levels: [],
      poc_price_level: null,
      delta_total: 0,
      total_volume: 0,
      unfinished_auction_top: false,
      unfinished_auction_bottom: false,
    };
  }

  const sorted = levels.slice().sort((a, b) => a.price_level - b.price_level);
  const enriched = applyImbalances(sorted, imbalanceRatio);

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
    time,
    tick_grouping: tickGrouping,
    levels: enriched,
    poc_price_level: pocLevel.price_level,
    delta_total: deltaTotal,
    total_volume: totalVolume,
    unfinished_auction_top: unfinishedTop,
    unfinished_auction_bottom: unfinishedBottom,
  };
}

export function buildFootprintCandles(
  rows: FootprintRow[],
  targetGrouping: number,
  imbalanceRatio = DEFAULT_IMBALANCE_RATIO
): FootprintCandle[] {
  if (rows.length === 0) return [];

  const grouped = new Map<string, FootprintLevel[]>();
  for (const row of rows) {
    const time = row.time instanceof Date ? row.time.toISOString() : String(row.time);
    const level = normalizeLevel(row);
    const existing = grouped.get(time);
    if (!existing) {
      grouped.set(time, [level]);
    } else {
      existing.push(level);
    }
  }

  const candles: FootprintCandle[] = [];
  for (const [time, levels] of grouped.entries()) {
    const rolled = rollupFootprintLevels(levels, targetGrouping);
    candles.push(buildFootprintCandle(time, rolled, targetGrouping, imbalanceRatio));
  }

  return candles.sort((a, b) => a.time.localeCompare(b.time));
}

export function enrichFootprintPayload(payload: any): any {
  if (!payload || !Array.isArray(payload.levels)) {
    return payload;
  }
  const levels = payload.levels.map((level: any) => ({
    price_level: toNumber(level.price_level),
    bid_volume: toNumber(level.bid_volume),
    ask_volume: toNumber(level.ask_volume),
    delta: level.delta != null ? toNumber(level.delta) : toNumber(level.ask_volume) - toNumber(level.bid_volume),
    total_volume: level.total_volume != null ? toNumber(level.total_volume) : toNumber(level.ask_volume) + toNumber(level.bid_volume),
  }));
  const tickGrouping = Number.isFinite(payload.tick_grouping) ? Number(payload.tick_grouping) : 1000;
  const candle = buildFootprintCandle(String(payload.time), levels, tickGrouping);
  return {
    ...payload,
    ...candle,
  };
}
