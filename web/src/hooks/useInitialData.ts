import { useEffect, useCallback } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { useOrderStore } from '../stores/orderStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useInitialData() {
  const { symbol, interval, footprintView, setCandles, setFootprints } = useMarketStore();
  const { setOrders, setPositions } = useOrderStore();

  const fetchHistory = useCallback(async () => {
    try {
      console.log(`[API] Fetching initial data for ${symbol} (${interval})...`);
      
      // Fetch candles
      const candlesResp = await fetch(`${API_URL}/api/candles/${symbol}/${interval}?limit=500`);
      if (candlesResp.ok) {
        const data = await candlesResp.json();
        setCandles(data);
      }

      // Fetch footprints
      const footprintsResp = await fetch(
        `${API_URL}/api/footprints/${symbol}/${interval}?limit=100&tickGrouping=${footprintView.tickGrouping}`
      );
      if (footprintsResp.ok) {
        const data = await footprintsResp.json();
        setFootprints(data);
      }

      // Fetch active orders and positions
      const ordersResp = await fetch(`${API_URL}/api/orders`);
      if (ordersResp.ok) {
        setOrders(await ordersResp.json());
      }

      const positionsResp = await fetch(`${API_URL}/api/positions`);
      if (positionsResp.ok) {
        setPositions(await positionsResp.json());
      }

    } catch (err) {
      console.error('[API] Error fetching initial data', err);
    }
  }, [symbol, interval, footprintView.tickGrouping, setCandles, setFootprints, setOrders, setPositions]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { refresh: fetchHistory };
}
