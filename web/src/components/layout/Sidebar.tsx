import React from 'react';
import { useMarketStore } from '../../stores/marketStore';

const PAIRS = ['BTCUSDT', 'ETHUSDT'];

export const Sidebar: React.FC = () => {
  const { symbol, setSymbol } = useMarketStore();

  return (
    <aside className="app-sidebar">
      {PAIRS.map(pair => (
        <button
          key={pair}
          className={`btn btn-ghost ${symbol === pair ? 'btn-primary' : ''}`}
          style={{ width: 40, height: 40, padding: 0, borderRadius: 'var(--border-radius-md)' }}
          onClick={() => setSymbol(pair)}
          title={pair}
        >
          <span style={{ fontSize: 10, fontWeight: 700 }}>{pair.replace('USDT', '')}</span>
        </button>
      ))}
    </aside>
  );
};
