import React from 'react';
import { useMarketStore } from '../../stores/marketStore';

export const RecentTrades: React.FC = () => {
  const { recentTicks } = useMarketStore();

  return (
    <div className="panel recent-trades" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="panel-header" style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Recent Trades</span>
      </div>
      
      <div className="panel-content" style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-app)', zIndex: 1 }}>
              <th style={{ padding: 'var(--space-sm) 0' }}>Price</th>
              <th>Qty</th>
              <th style={{ textAlign: 'right' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentTicks.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: 'var(--space-xl) 0', color: 'var(--text-muted)' }}>
                  Waiting for trades...
                </td>
              </tr>
            ) : (
              [...recentTicks].reverse().map((tick, i) => (
                <tr key={`${tick.trade_id}-${i}`} style={{ borderBottom: '1px solid var(--border-color)', opacity: 1 - (i * 0.015) }}>
                  <td style={{ padding: '4px 0', fontWeight: 600 }} className={tick.is_buyer_maker ? 'price-down' : 'price-up'}>
                    {tick.price.toFixed(2)}
                  </td>
                  <td className="mono">{tick.quantity.toFixed(4)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {new Date(tick.timestamp_ms).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
