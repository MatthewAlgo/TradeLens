import React, { useState } from 'react';
import { useOrderStore } from '../../stores/orderStore';
import { useMarketStore } from '../../stores/marketStore';

export const TradingPanel: React.FC = () => {
  const { symbol } = useMarketStore();
  const { portfolio } = useOrderStore();
  
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState('0.1');
  const [price, setPrice] = useState('');

  const submitOrder = async (side: 'BUY' | 'SELL') => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          order_type: orderType,
          quantity: parseFloat(quantity),
          price: orderType === 'LIMIT' ? parseFloat(price) : undefined,
        })
      });
      if (!res.ok) {
        const err = await res.text();
        alert(`Order failed: ${err}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to OMS');
    }
  };

  return (
    <div className="panel-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <h3 className="panel-section-title">Order Entry</h3>
      
      <div className="tabs">
        <button 
          className={`tab ${orderType === 'MARKET' ? 'active' : ''}`} 
          style={{ flex: 1 }}
          onClick={() => setOrderType('MARKET')}
        >Market</button>
        <button 
          className={`tab ${orderType === 'LIMIT' ? 'active' : ''}`} 
          style={{ flex: 1 }}
          onClick={() => setOrderType('LIMIT')}
        >Limit</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="stat-label">Available Margin</span>
          <span className="mono">${portfolio?.balance?.toFixed(2) || '0.00'}</span>
        </div>
        
        {orderType === 'LIMIT' && (
          <input 
            type="number" 
            className="input" 
            placeholder="Price" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        )}
        
        <div style={{ position: 'relative' }}>
          <input 
            type="number" 
            className="input" 
            placeholder="Quantity" 
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-muted)' }}>
            {symbol.replace('USDT', '')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button className="btn btn-buy" style={{ flex: 1 }} onClick={() => submitOrder('BUY')}>
          Buy / Long
        </button>
        <button className="btn btn-sell" style={{ flex: 1 }} onClick={() => submitOrder('SELL')}>
          Sell / Short
        </button>
      </div>
    </div>
  );
};
