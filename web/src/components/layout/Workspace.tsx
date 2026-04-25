import React, { useState } from 'react';
import { useOrderStore } from '../../stores/orderStore';
import { CandlestickChart } from '../charts/CandlestickChart';
import { FootprintChart } from '../charts/FootprintChart';

export const Workspace: React.FC = () => {
  const [activeChart, setActiveChart] = useState<'candles' | 'footprint'>('candles');
  const { positions, orders } = useOrderStore();
  const openPositions = positions.filter(p => p.quantity > 0);

  return (
    <main className="app-main">
      {/* Chart Area */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: '1px solid var(--border-color)' }}>
        <div className="tabs" style={{ paddingLeft: 'var(--space-md)' }}>
          <button 
            className={`tab ${activeChart === 'candles' ? 'active' : ''}`}
            onClick={() => setActiveChart('candles')}
          >
            Candlesticks
          </button>
          <button 
            className={`tab ${activeChart === 'footprint' ? 'active' : ''}`}
            onClick={() => setActiveChart('footprint')}
          >
            Footprint Flow
          </button>
        </div>
        
        <div style={{ flex: 1, minHeight: 0 }}>
          {activeChart === 'candles' ? <CandlestickChart /> : <FootprintChart />}
        </div>
      </div>

      {/* Positions Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="tabs" style={{ paddingLeft: 'var(--space-md)' }}>
          <button className="tab active">Positions ({openPositions.length})</button>
          <button className="tab">Orders ({orders.filter(o => o.status === 'OPEN').length})</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
          {openPositions.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No open positions
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-strong)' }}>
                  <th style={{ padding: 'var(--space-sm) 0' }}>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Entry Price</th>
                  <th>Mark Price</th>
                  <th>Unrealized PnL</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 'var(--space-md) 0', fontWeight: 600 }}>{pos.symbol}</td>
                    <td>
                      <span className={`badge ${pos.side === 'LONG' ? 'badge-green' : 'badge-red'}`}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="mono">{pos.quantity.toFixed(4)}</td>
                    <td className="mono">${pos.avg_entry_price.toFixed(2)}</td>
                    <td className="mono">${pos.current_price.toFixed(2)}</td>
                    <td className={`mono ${pos.unrealized_pnl >= 0 ? 'price-up' : 'price-down'}`}>
                      ${pos.unrealized_pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
};
