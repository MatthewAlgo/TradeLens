import { create } from 'zustand';
import type { OHLCV, FootprintCandle, OrderBook, Tick } from '../types/market';
import type { FootprintViewState } from '../utils/footprint';
import { buildFootprintSeries } from '../utils/footprint';

interface MarketState {
  symbol: string;
  interval: string;
  currentPrice: number;
  candles: OHLCV[];
  footprints: FootprintCandle[];
  rawFootprints: FootprintCandle[];
  orderbook: OrderBook | null;
  recentTicks: Tick[];
  footprintView: FootprintViewState;
  
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setCandles: (candles: OHLCV[]) => void;
  addCandle: (candle: OHLCV) => void;
  setFootprints: (footprints: FootprintCandle[]) => void;
  addFootprint: (footprint: FootprintCandle) => void;
  setFootprintView: (view: Partial<FootprintViewState>) => void;
  setOrderbook: (orderbook: OrderBook) => void;
  addTick: (tick: Tick) => void;
  setCurrentPrice: (price: number) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  symbol: 'BTCUSDT',
  interval: '1m',
  currentPrice: 0,
  candles: [],
  footprints: [],
  rawFootprints: [],
  orderbook: null,
  recentTicks: [],
  footprintView: {
    tickGrouping: 1000,
    displayMode: 'split',
    heatmap: true,
    compactMode: false,
    zoom: 1,
  },

  setSymbol: (symbol) => set({ symbol }),
  setInterval: (interval) => set({ interval }),
  
  setCandles: (candles) => set({ candles }),
  addCandle: (candle) => set((state) => {
    if (!candle || !candle.time) return state;
    // If candle is update to last candle, replace it. Otherwise append.
    const newCandles = [...state.candles];
    if (newCandles.length > 0 && newCandles[newCandles.length - 1].time === candle.time) {
      newCandles[newCandles.length - 1] = candle;
    } else {
      newCandles.push(candle);
    }
    return { candles: newCandles };
  }),

  setFootprints: (footprints) => set((state) => {
    const rawFootprints = footprints || [];
    return {
      rawFootprints,
      footprints: buildFootprintSeries(rawFootprints, state.footprintView),
    };
  }),
  addFootprint: (footprint) => set((state) => {
    if (!footprint || !footprint.time) return state;
    const rawFootprints = [...state.rawFootprints];
    if (rawFootprints.length > 0 && rawFootprints[rawFootprints.length - 1].time === footprint.time) {
      rawFootprints[rawFootprints.length - 1] = footprint;
    } else {
      rawFootprints.push(footprint);
    }
    return {
      rawFootprints,
      footprints: buildFootprintSeries(rawFootprints, state.footprintView),
    };
  }),

  setFootprintView: (view) => set((state) => {
    const nextView = { ...state.footprintView, ...view };
    return {
      footprintView: nextView,
      footprints: buildFootprintSeries(state.rawFootprints, nextView),
    };
  }),

  setOrderbook: (orderbook) => set({ orderbook }),
  
  addTick: (tick) => set((state) => {
    if (!tick || tick.price === undefined) return state;
    const newTicks = [...state.recentTicks, tick].slice(-50); // keep last 50
    return { recentTicks: newTicks, currentPrice: tick.price };
  }),
  
  setCurrentPrice: (price) => set({ currentPrice: price }),
}));
