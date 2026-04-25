import React from 'react';
import { useMarketStore } from '../../stores/marketStore';

export const OrderBook: React.FC = () => {
  const { recentTicks } = useMarketStore();
  
  // Since we don't have a full orderbook stream yet, we'll simulate a recent trades tape
  // which is also a critical component of a footprint trading platform.

  return (
    <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <h3 className="panel-section-title">Recent Trades (Tape)</h3>
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--font-size-xs)' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th style={{ padding: 'var(--space-xs) 0', textAlign: 'left' }}>Time</th>
              <th>Price</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {[...recentTicks].reverse().map((tick, i) => {
              const time = new Date(tick.timestamp_ms).toLocaleTimeString([], { hour12: false, second: '2-digit' });
              // is_buyer_maker = true means the aggressor was a SELLER (they matched with a resting maker buy)
              const isAggressiveBuy = !tick.is_buyer_maker;
              
              return (
                <tr key={tick.trade_id || i}>
                  <td style={{ padding: '4px 0', textAlign: 'left', color: 'var(--text-muted)' }}>{time}</td>
                  <td className={`mono ${isAggressiveBuy ? 'price-up' : 'price-down'}`}>
                    {tick.price.toFixed(2)}
                  </td>
                  <td className="mono">{tick.quantity.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
