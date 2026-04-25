import { useUIStore } from './stores/uiStore';
import { useWebSocket } from './hooks/useWebSocket';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Workspace } from './components/layout/Workspace';
import { OrderBook } from './components/orderbook/OrderBook';
import { TradingPanel } from './components/trading/TradingPanel';
import { BacktestDashboard } from './components/backtest/BacktestDashboard';

function App() {
  // Initialize WebSocket connection
  useWebSocket();
  const { view } = useUIStore();

  return (
    <div className={`app-layout animate-fade-in`}>
      <Header />
      
      {view === 'trading' && (
        <>
          <Sidebar />
          <Workspace />
          
          <aside className="app-aside">
            <OrderBook />
            <TradingPanel />
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
