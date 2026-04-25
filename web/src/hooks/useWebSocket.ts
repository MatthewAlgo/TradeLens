import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { useOrderStore } from '../stores/orderStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const { symbol, interval, addCandle, addFootprint, addTick } = useMarketStore();
  const { addOrUpdateOrder } = useOrderStore();
  
  // Connect and reconnect logic
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    
    console.log(`[WS] Connecting to ${WS_URL}...`);
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      console.log('[WS] Connected');
      subscribe(symbol, interval);
    };
    
    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg.channel) return;
        
        if (msg.channel.startsWith('candles:')) {
          addCandle(msg.data);
        } else if (msg.channel.startsWith('footprints:')) {
          addFootprint(msg.data);
        } else if (msg.channel.startsWith('ticks:')) {
          addTick(msg.data);
        } else if (msg.channel === 'orders') {
          if (msg.data.order) {
            addOrUpdateOrder(msg.data.order);
          }
        }
      } catch (err) {
        console.error('[WS] Error parsing message', err);
      }
    };
    
    ws.current.onclose = () => {
      console.log('[WS] Disconnected. Reconnecting in 5s...');
      setTimeout(connect, 5000);
    };
  }, [symbol, interval, addCandle, addFootprint, addTick, addOrUpdateOrder]);
  
  const subscribe = useCallback((sym: string, intv: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    
    // Subscribe to new channels
    ws.current.send(JSON.stringify({ action: 'subscribe', channel: `candles:${sym}:${intv}` }));
    ws.current.send(JSON.stringify({ action: 'subscribe', channel: `footprints:${sym}:${intv}` }));
    ws.current.send(JSON.stringify({ action: 'subscribe', channel: `ticks:${sym}` }));
    ws.current.send(JSON.stringify({ action: 'subscribe', channel: `orders` }));
  }, []);
  
  const unsubscribe = useCallback((sym: string, intv: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    
    ws.current.send(JSON.stringify({ action: 'unsubscribe', channel: `candles:${sym}:${intv}` }));
    ws.current.send(JSON.stringify({ action: 'unsubscribe', channel: `footprints:${sym}:${intv}` }));
    ws.current.send(JSON.stringify({ action: 'unsubscribe', channel: `ticks:${sym}` }));
  }, []);
  
  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);
  
  // Re-subscribe when symbol or interval changes
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      subscribe(symbol, interval);
    }
    
    return () => {
      unsubscribe(symbol, interval);
    };
  }, [symbol, interval, subscribe, unsubscribe]);
  
  return { ws: ws.current };
}
