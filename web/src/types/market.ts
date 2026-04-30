// Market data types shared across the frontend
export interface Tick {
  timestamp_ms: number;
  symbol: string;
  price: number;
  quantity: number;
  is_buyer_maker: boolean;
  trade_id: number;
  exchange: string;
}

export interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
}

export interface FootprintLevel {
  price_level: number;
  bid_volume: number;
  ask_volume: number;
  delta: number;
  total_volume: number;
  imbalance?: 'buy' | 'sell';
}

export interface FootprintCandle {
  time: string;
  tick_grouping?: number;
  levels: FootprintLevel[];
  poc_price_level?: number | null;
  delta_total?: number;
  total_volume?: number;
  unfinished_auction_top?: boolean;
  unfinished_auction_bottom?: boolean;
  delta_divergence?: boolean;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface Instrument {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  asset_class: string;
  tick_size: number;
  lot_size: number;
  status: string;
}

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
