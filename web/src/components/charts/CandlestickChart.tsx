import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { ISeriesApi, CandlestickData, Time, LineData } from 'lightweight-charts';
import { useMarketStore } from '../../stores/marketStore';

export const CandlestickChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const { candles, interval, setInterval } = useMarketStore();

  useEffect(() => {
    try {
      if (!chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(99, 115, 171, 0.1)' },
          horzLines: { color: 'rgba(99, 115, 171, 0.1)' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: 'rgba(99, 115, 171, 0.2)',
        },
        rightPriceScale: {
          borderColor: 'rgba(99, 115, 171, 0.2)',
        },
        crosshair: {
          mode: 1,
          vertLine: { color: 'rgba(255, 255, 255, 0.4)', style: 3 },
          horzLine: { color: 'rgba(255, 255, 255, 0.4)', style: 3 },
        },
      });

      // @ts-ignore
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      // @ts-ignore
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      smaSeriesRef.current = smaSeries;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    } catch (err: any) {
      console.error("CandlestickChart init error:", err.message, err.stack);
    }
  }, []);

  useEffect(() => {
    try {
      if (!seriesRef.current || candles.length === 0) return;
      
      // Map backend candles to Lightweight Charts format with defensive parsing
      const formattedData: CandlestickData<Time>[] = candles
        .filter(c => c && c.time && c.open != null && c.high != null && c.low != null && c.close != null)
        .map(c => {
          // Create a Unix timestamp in seconds
          const ts = Math.floor(new Date(c.time).getTime() / 1000);
          
          return {
            time: ts as Time,
            open: parseFloat(String(c.open)) || 0,
            high: parseFloat(String(c.high)) || 0,
            low: parseFloat(String(c.low)) || 0,
            close: parseFloat(String(c.close)) || 0,
          };
        })
        .filter(d => !isNaN(d.time as number))
        .sort((a, b) => (a.time as number) - (b.time as number));

      // Dedup and clean up time scale conflicts
      const uniqueMap = new Map();
      formattedData.forEach(d => uniqueMap.set(d.time, d));
      const uniqueData = Array.from(uniqueMap.values());

      seriesRef.current.setData(uniqueData);

      // Map SMA data
      if (smaSeriesRef.current) {
        const smaData: LineData<Time>[] = candles
          .filter(c => c && c.time && c.indicators && c.indicators['SMA_20'] != null)
          .map(c => ({
            time: Math.floor(new Date(c.time).getTime() / 1000) as Time,
            value: parseFloat(String(c.indicators!['SMA_20'])) || 0,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        // Dedup SMA data
        const uniqueSmaMap = new Map();
        smaData.forEach(d => uniqueSmaMap.set(d.time, d));
        const uniqueSmaData = Array.from(uniqueSmaMap.values());
        
        smaSeriesRef.current.setData(uniqueSmaData);
      }
    } catch (err: any) {
      console.error("CandlestickChart data error:", err.message, err.stack);
    }
  }, [candles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-toolbar">
        {['1m', '5m', '15m', '1h', '4h', '1d'].map(i => (
          <button
            key={i}
            className={`interval-btn ${interval === i ? 'active' : ''}`}
            onClick={() => setInterval(i)}
          >
            {i}
          </button>
        ))}
      </div>
      <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
};
