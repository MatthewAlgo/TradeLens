// Order & trading types
export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stop_price?: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: string;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  quantity: number;
  filled_quantity: number;
  price?: number;
  stop_price?: number;
  avg_fill_price?: number;
  commission: number;
  created_at: string;
  updated_at: string;
  filled_at?: string;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
}

export interface Portfolio {
  balance: number;
  locked_balance: number;
  total_pnl: number;
  positions: Position[];
  open_orders: number;
}

export interface BacktestRequest {
  strategy: string;
  symbol: string;
  interval: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  commission_rate: number;
  params: Record<string, number>;
}

export interface BacktestResult {
  backtest_id: string;
  status: string;
  strategy?: string;
  symbol?: string;
  initial_capital?: number;
  final_equity?: number;
  total_return_pct?: number;
  max_drawdown_pct?: number;
  sharpe_ratio?: number;
  total_trades?: number;
  win_rate_pct?: number;
  profit_factor?: number;
  equity_curve?: number[];
  trades?: Array<{
    symbol: string; side: string; entry_price: number;
    exit_price: number; quantity: number; pnl: number;
  }>;
  progress?: number;
  error?: string;
}
