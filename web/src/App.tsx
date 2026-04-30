import { useUIStore } from './stores/uiStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useInitialData } from './hooks/useInitialData';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Workspace } from './components/layout/Workspace';
import { OrderBook } from './components/orderbook/OrderBook';
import { TradingPanel } from './components/trading/TradingPanel';
import { RecentTrades } from './components/trading/RecentTrades';
import { BacktestDashboard } from './components/backtest/BacktestDashboard';

function App() {
  // Initialize WebSocket connection and fetch initial data
  useWebSocket();
  useInitialData();
  
  const { view } = useUIStore();

  return (
    <div className={`app-layout animate-fade-in`}>
      <Header />
      
      {view === 'trading' && (
        <>
          <Sidebar />
          <Workspace />
          
          <aside className="app-aside" style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
              <OrderBook />
            </div>
            <div style={{ flex: '0 0 35%', minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--border-color)' }}>
              <RecentTrades />
            </div>
            <div style={{ flex: '0 0 25%', minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--border-color)' }}>
              <TradingPanel />
            </div>
          </aside>
        </>
      )}

      {view === 'backtest' && (
        <div style={{ gridArea: 'sidebar / sidebar / aside / aside', display: 'flex' }}>
          <BacktestDashboard />
        </div>
      )}
    </div>
  );
}

export default App;
