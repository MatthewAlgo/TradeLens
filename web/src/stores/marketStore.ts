import { create } from 'zustand';
import type { OHLCV, FootprintCandle, OrderBook, Tick } from '../types/market';

interface MarketState {
  symbol: string;
  interval: string;
  currentPrice: number;
  candles: OHLCV[];
  footprints: FootprintCandle[];
  orderbook: OrderBook | null;
  recentTicks: Tick[];
  
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setCandles: (candles: OHLCV[]) => void;
  addCandle: (candle: OHLCV) => void;
  setFootprints: (footprints: FootprintCandle[]) => void;
  addFootprint: (footprint: FootprintCandle) => void;
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
  orderbook: null,
  recentTicks: [],

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

  setFootprints: (footprints) => set({ footprints }),
  addFootprint: (footprint) => set((state) => {
    if (!footprint || !footprint.time) return state;
    const newFp = [...state.footprints];
    if (newFp.length > 0 && newFp[newFp.length - 1].time === footprint.time) {
      newFp[newFp.length - 1] = footprint;
    } else {
      newFp.push(footprint);
    }
    return { footprints: newFp };
  }),

  setOrderbook: (orderbook) => set({ orderbook }),
  
  addTick: (tick) => set((state) => {
    if (!tick || tick.price === undefined) return state;
    const newTicks = [...state.recentTicks, tick].slice(-50); // keep last 50
    return { recentTicks: newTicks, currentPrice: tick.price };
  }),
  
  setCurrentPrice: (price) => set({ currentPrice: price }),
}));
