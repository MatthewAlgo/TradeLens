import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { useMarketStore } from '../../stores/marketStore';

export const CandlestickChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { candles, interval, setInterval } = useMarketStore();

  useEffect(() => {
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
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    
    // Map backend candles to Lightweight Charts format
    const formattedData: CandlestickData<Time>[] = candles.map(c => {
      // Create a Unix timestamp in seconds
      const ts = new Date(c.time).getTime() / 1000;
      return {
        time: ts as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    }).sort((a, b) => (a.time as number) - (b.time as number));

    // Dedup and clean up time scale conflicts
    const uniqueMap = new Map();
    formattedData.forEach(d => uniqueMap.set(d.time, d));
    const uniqueData = Array.from(uniqueMap.values());

    seriesRef.current.setData(uniqueData);
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
