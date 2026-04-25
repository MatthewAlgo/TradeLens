import { useMarketStore } from '../../stores/marketStore';
import { useUIStore } from '../../stores/uiStore';
import { Activity, Settings, Code, BarChart2 } from 'lucide-react';

export const Header: React.FC = () => {
  const { symbol, currentPrice } = useMarketStore();
  const { view, setView } = useUIStore();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', width: '200px' }}>
        <div style={{ width: 32, height: 32, background: 'var(--accent-gradient)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={20} color="white" />
        </div>
        <div style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'white' }}>TRADELENS</div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1, justifyContent: 'center' }}>
        <button 
          className={`tab ${view === 'trading' ? 'active' : ''}`}
          onClick={() => setView('trading')}
        >
          <BarChart2 size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
          Trading
        </button>
        <button 
          className={`tab ${view === 'backtest' ? 'active' : ''}`}
          onClick={() => setView('backtest')}
        >
          <Code size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
          Backtesting
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', justifyContent: 'flex-end', width: '300px' }}>
        <div className="stat-card" style={{ alignItems: 'flex-end' }}>
          <span className="stat-label">{symbol}</span>
          <span className={`stat-value ${currentPrice > 0 ? 'price-up' : ''}`}>
            ${currentPrice > 0 ? currentPrice.toFixed(2) : '---'}
          </span>
        </div>
        <button className="btn btn-ghost" style={{ padding: '8px' }}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
