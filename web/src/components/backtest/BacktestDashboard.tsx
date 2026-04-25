import React, { useState } from 'react';
import { Play } from 'lucide-react';
import type { BacktestResult } from '../../types/orders';

export const BacktestDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'sma_crossover',
          symbol: 'BTCUSDT',
          interval: '1h',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          initial_capital: 100000,
          commission_rate: 0.001
        })
      });
      
      const data = await res.json();
      
      // Poll for result
      const poll = setInterval(async () => {
        const statusRes = await fetch(`${apiUrl}/backtest/${data.backtest_id}`);
        const statusData = await statusRes.json();
        
        if (statusData.status === 'completed') {
          clearInterval(poll);
          setResult(statusData);
          setLoading(false);
        } else if (statusData.status === 'failed') {
          clearInterval(poll);
          alert('Backtest failed');
          setLoading(false);
        }
      }, 1000);
      
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
      {/* Settings Panel */}
      <div style={{ width: 320, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Backtest Engine</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label className="stat-label">Strategy</label>
          <select className="select">
            <option>SMA Crossover</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label className="stat-label">Instrument</label>
          <select className="select">
            <option>BTCUSDT</option>
            <option>ETHUSDT</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', flex: 1 }}>
            <label className="stat-label">Interval</label>
            <select className="select">
              <option>1h</option>
              <option>15m</option>
              <option>1m</option>
            </select>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ marginTop: 'var(--space-lg)' }}
          onClick={runBacktest}
          disabled={loading}
        >
          {loading ? 'Running...' : (
            <>
              <Play size={16} />
              Run Backtest
            </>
          )}
        </button>
      </div>

      {/* Results Panel */}
      <div style={{ flex: 1, padding: 'var(--space-xl)', overflowY: 'auto' }}>
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
              <div className="glass-panel" style={{ padding: 'var(--space-md)' }}>
                <div className="stat-label">Total Return</div>
                <div className={`stat-value ${result.total_return_pct! >= 0 ? 'price-up' : 'price-down'}`}>
                  {result.total_return_pct?.toFixed(2)}%
                </div>
              </div>
              <div className="glass-panel" style={{ padding: 'var(--space-md)' }}>
                <div className="stat-label">Win Rate</div>
                <div className="stat-value">{result.win_rate_pct?.toFixed(2)}%</div>
              </div>
              <div className="glass-panel" style={{ padding: 'var(--space-md)' }}>
                <div className="stat-label">Sharpe Ratio</div>
                <div className="stat-value">{result.sharpe_ratio?.toFixed(2)}</div>
              </div>
              <div className="glass-panel" style={{ padding: 'var(--space-md)' }}>
                <div className="stat-label">Max Drawdown</div>
                <div className="stat-value price-down">{result.max_drawdown_pct?.toFixed(2)}%</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 'var(--space-lg)' }}>
              <h3 className="panel-section-title" style={{ marginBottom: 'var(--space-md)' }}>Trades Executed</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-strong)' }}>
                    <th style={{ padding: 'var(--space-sm) 0' }}>Side</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades?.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 'var(--space-sm) 0' }}>
                        <span className={`badge ${t.side === 'LONG' ? 'badge-green' : 'badge-red'}`}>{t.side}</span>
                      </td>
                      <td className="mono">${t.entry_price.toFixed(2)}</td>
                      <td className="mono">${t.exit_price.toFixed(2)}</td>
                      <td className={`mono ${t.pnl >= 0 ? 'price-up' : 'price-down'}`}>
                        ${t.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Configure and run a backtest to see results here.
          </div>
        )}
      </div>
    </div>
  );
};
