import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useMarketStore } from '../../stores/marketStore';

export const FootprintChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const { footprints } = useMarketStore();

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

  const renderFootprints = () => {
    if (!pixiAppRef.current || footprints.length === 0) return;
    
    const app = pixiAppRef.current;
    
    // Clear previous stage
    app.stage.removeChildren();
    
    const candleWidth = 80;
    const padding = 10;
    
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

      candle.levels.forEach(level => {
        const price = parseFloat(String(level.price_level));
        if (isNaN(price)) return;
        
        const y = getPriceY(price);
        const cellHeight = Math.max(2, scaleY * 5); // Minimum height to be visible
        
        const delta = parseFloat(String(level.delta)) || 0;
        let color = 0x1e293b; // Default neutral cold
        
        if (delta > 0) {
          // Intensity based on ratio to max volume
          const intensity = Math.min(1, delta / (maxVolInCandle || 1));
          color = PIXI.Color.shared.setValue([0.1, 0.4 + (0.5 * intensity), 0.8]).toNumber();
        } else if (delta < 0) {
          const intensity = Math.min(1, Math.abs(delta) / (maxVolInCandle || 1));
          color = PIXI.Color.shared.setValue([0.4 + (0.5 * intensity), 0.1, 0.1]).toNumber();
        }

        // Draw the background cell
        const graphics = new PIXI.Graphics();
        graphics.rect(x, y - cellHeight / 2, candleWidth - padding * 2, cellHeight - 1);
        graphics.fill({ color, alpha: 0.8 });
        mainContainer.addChild(graphics);

        // Draw bid x ask text if there's enough space
        if (cellHeight > 12) {
          const textStyle = new PIXI.TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fill: 0xe8ecf4,
            align: 'center',
          });
          
          const bidVol = parseFloat(String(level.bid_volume)) || 0;
          const askVol = parseFloat(String(level.ask_volume)) || 0;
          const text = new PIXI.Text({
            text: `${bidVol.toFixed(0)}x${askVol.toFixed(0)}`, 
            style: textStyle
          });
          
          text.anchor.set(0.5);
          text.x = x + (candleWidth - padding * 2) / 2;
          text.y = y;
          
          mainContainer.addChild(text);
        }
      });
    });
  };

  // Re-render when footprints change
  useEffect(() => {
    renderFootprints();
  }, [footprints]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chart-toolbar">
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Footprint Chart (WebGL)
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }} />
    </div>
  );
};
