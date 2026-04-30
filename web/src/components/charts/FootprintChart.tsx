import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useMarketStore } from '../../stores/marketStore';

const tickGroupingPresets = [100, 500, 1000, 5000, 10000];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getHeatColor = (delta: number, intensity: number, heatmap: boolean) => {
  if (!heatmap) return 0x1e293b;
  if (delta > 0) {
    const strength = clamp(0.3 + intensity * 0.7, 0.2, 1);
    return PIXI.Color.shared.setValue([0.1, strength, 0.6 + intensity * 0.3]).toNumber();
  }
  if (delta < 0) {
    const strength = clamp(0.3 + intensity * 0.7, 0.2, 1);
    return PIXI.Color.shared.setValue([0.6 + intensity * 0.3, 0.1, strength * 0.2]).toNumber();
  }
  return 0x1e293b;
};

const getTextColor = (color: number) => {
  const rgb = PIXI.Color.shared.setValue(color).toRgbArray();
  const luminance = (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
  return luminance > 0.5 ? 0x0b0d12 : 0xe8ecf4;
};

export const FootprintChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const { footprints, footprintView, setFootprintView } = useMarketStore();
  const [isMobile, setIsMobile] = useState(false);

  const effectiveCompact = footprintView.compactMode || isMobile;

  const tickGroupingLabel = useMemo(() => {
    const dollars = (footprintView.tickGrouping / 100).toFixed(0);
    return `$${dollars}`;
  }, [footprintView.tickGrouping]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize PixiJS application for WebGL accelerated rendering
    const app = new PIXI.Application();
    
    // Setup function to handle async initialization in v8+
    const setupPixi = async () => {
      await app.init({
        resizeTo: containerRef.current!,
        backgroundColor: 0x0a0e1a,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
      });
      
      containerRef.current?.appendChild(app.canvas);
      pixiAppRef.current = app;
      
      renderFootprints();
    };
    
    setupPixi();

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true, texture: true });
        pixiAppRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };
    handleChange(media);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const renderFootprints = () => {
    if (!pixiAppRef.current || footprints.length === 0) return;
    
    const app = pixiAppRef.current;
    
    // Clear previous stage
    app.stage.removeChildren();
    
    const candleWidth = 56 + (footprintView.zoom * 18);
    const padding = 8;
    
    // Set up a container we can pan/zoom
    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);

    // Simple auto-scaling logic based on visible data
    // In a real app, this would be highly interactive with zoom/pan handlers
    const lastVisibleCount = Math.min(footprints.length, Math.floor(app.screen.width / candleWidth));
    const visibleData = footprints.slice(-lastVisibleCount);
    
    if (visibleData.length === 0) return;

    // Find min/max price in visible range to scale Y axis
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    visibleData.forEach(fp => {
      if (!fp.levels) return;
      fp.levels.forEach(level => {
        const price = parseFloat(String(level.price_level));
        if (!isNaN(price)) {
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }
      });
    });

    if (minPrice === Infinity) return;

    // Add some padding to Y axis
    const priceRange = maxPrice - minPrice || 10;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;

    const scaleY = app.screen.height / (maxPrice - minPrice);
    const getPriceY = (price: number) => app.screen.height - ((price - minPrice) * scaleY);

    // Draw footprints
    visibleData.forEach((candle, i) => {
      const x = app.screen.width - ((lastVisibleCount - i) * candleWidth) + padding;
      
      // Calculate max volume for color intensity scaling
      const maxVolInCandle = Math.max(0, ...candle.levels.map(l => parseFloat(String(l.total_volume)) || 0));
      const pocPrice = candle.poc_price_level;

      candle.levels.forEach(level => {
        const price = parseFloat(String(level.price_level));
        if (isNaN(price)) return;
        
        const y = getPriceY(price);
        const cellHeight = Math.max(2, scaleY * 5); // Minimum height to be visible
        
        const delta = parseFloat(String(level.delta)) || 0;
        const intensity = Math.min(1, (Math.abs(delta) || 0) / (maxVolInCandle || 1));
        const color = getHeatColor(delta, intensity, footprintView.heatmap);

        // Draw the background cell
        const graphics = new PIXI.Graphics();
        graphics.rect(x, y - cellHeight / 2, candleWidth - padding * 2, cellHeight - 1);
        graphics.fill({ color, alpha: 0.8 });
        mainContainer.addChild(graphics);

        if (pocPrice != null && Math.abs(pocPrice - price) < 0.0001) {
          const pocBox = new PIXI.Graphics();
          pocBox.rect(x, y - cellHeight / 2, candleWidth - padding * 2, cellHeight - 1);
          pocBox.stroke({ color: 0xfbbf24, width: 1 });
          mainContainer.addChild(pocBox);
        }

        if (level.imbalance === 'buy' || level.imbalance === 'sell') {
          const imbalance = new PIXI.Graphics();
          const color = level.imbalance === 'buy' ? 0x22d3ee : 0xf472b6;
          const markerWidth = 4;
          const markerX = level.imbalance === 'buy'
            ? x + candleWidth - padding * 2 - markerWidth
            : x;
          imbalance.rect(markerX, y - cellHeight / 2, markerWidth, cellHeight - 1);
          imbalance.fill({ color, alpha: 0.9 });
          mainContainer.addChild(imbalance);
        }

        // Draw bid x ask text if there's enough space
        const showNumbers = !effectiveCompact && cellHeight > 12 && candleWidth >= 70;
        if (showNumbers) {
          const textStyle = new PIXI.TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fill: getTextColor(color),
            align: 'center',
          });
          
          const bidVol = parseFloat(String(level.bid_volume)) || 0;
          const askVol = parseFloat(String(level.ask_volume)) || 0;
          const totalVol = parseFloat(String(level.total_volume)) || 0;
          const deltaValue = parseFloat(String(level.delta)) || 0;
          const deltaText = deltaValue >= 0 ? `+${deltaValue.toFixed(0)}` : `${deltaValue.toFixed(0)}`;
          const textValue = footprintView.displayMode === 'split'
            ? `${bidVol.toFixed(0)}x${askVol.toFixed(0)}`
            : `${totalVol.toFixed(0)} (${deltaText})`;

          const text = new PIXI.Text({ text: textValue, style: textStyle });
          
          text.anchor.set(0.5);
          text.x = x + (candleWidth - padding * 2) / 2;
          text.y = y;
          text.alpha = clamp((footprintView.zoom - 0.5) / 2, 0.2, 1);
          
          mainContainer.addChild(text);
        }
      });

      if (candle.unfinished_auction_top) {
        const topLevel = candle.levels[candle.levels.length - 1];
        const y = getPriceY(topLevel.price_level);
        const marker = new PIXI.Graphics();
        marker.rect(x, y - 2, candleWidth - padding * 2, 2);
        marker.fill({ color: 0xf97316, alpha: 0.9 });
        mainContainer.addChild(marker);
      }

      if (candle.unfinished_auction_bottom) {
        const bottomLevel = candle.levels[0];
        const y = getPriceY(bottomLevel.price_level);
        const marker = new PIXI.Graphics();
        marker.rect(x, y, candleWidth - padding * 2, 2);
        marker.fill({ color: 0xf97316, alpha: 0.9 });
        mainContainer.addChild(marker);
      }

      if (candle.delta_divergence) {
        const high = candle.levels[candle.levels.length - 1];
        const y = getPriceY(high.price_level) - 10;
        const divergence = new PIXI.Graphics();
        divergence.circle(x + (candleWidth - padding * 2) / 2, y, 4);
        divergence.fill({ color: 0xfacc15, alpha: 0.9 });
        mainContainer.addChild(divergence);
      }
    });
  };

  // Re-render when footprints change
  useEffect(() => {
    renderFootprints();
  }, [footprints, footprintView, effectiveCompact]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-toolbar">
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Footprint Chart
        </span>
        <div className="chart-toolbar-group">
          <button
            className={`interval-btn ${footprintView.displayMode === 'split' ? 'active' : ''}`}
            onClick={() => setFootprintView({ displayMode: 'split' })}
          >
            Bid/Ask
          </button>
          <button
            className={`interval-btn ${footprintView.displayMode === 'total' ? 'active' : ''}`}
            onClick={() => setFootprintView({ displayMode: 'total' })}
          >
            Total + Delta
          </button>
        </div>
        <div className="chart-toolbar-group">
          <label className="chart-toolbar-label">Grouping</label>
          <select
            className="chart-toolbar-select"
            value={footprintView.tickGrouping}
            onChange={(event) => setFootprintView({ tickGrouping: Number(event.target.value) })}
          >
            {tickGroupingPresets.map((preset) => (
              <option key={preset} value={preset}>${preset / 100}</option>
            ))}
          </select>
          <span className="chart-toolbar-pill">{tickGroupingLabel}</span>
        </div>
        <div className="chart-toolbar-group">
          <button
            className={`interval-btn ${footprintView.heatmap ? 'active' : ''}`}
            onClick={() => setFootprintView({ heatmap: !footprintView.heatmap })}
          >
            Heatmap
          </button>
          <button
            className={`interval-btn ${effectiveCompact ? 'active' : ''}`}
            onClick={() => setFootprintView({ compactMode: !footprintView.compactMode })}
          >
            Compact
          </button>
        </div>
        <div className="chart-toolbar-group chart-toolbar-zoom">
          <label className="chart-toolbar-label">Zoom</label>
          <input
            className="chart-toolbar-range"
            type="range"
            min={1}
            max={4}
            step={0.5}
            value={footprintView.zoom}
            onChange={(event) => setFootprintView({ zoom: Number(event.target.value) })}
          />
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }} />
    </div>
  );
};
