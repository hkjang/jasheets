'use client';

import { useState, useRef, useEffect } from 'react';
import ChartComponent, { ChartType } from './ChartComponent';
import styles from './ChartComponent.module.css'; // Reusing styles or create new

export interface ChartConfig {
  id: string;
  type: ChartType;
  data: any[][];
  options: any;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ChartOverlayProps {
  charts: ChartConfig[];
  onUpdateChart: (id: string, updates: Partial<ChartConfig>) => void;
  onRemoveChart: (id: string) => void;
}

export default function ChartOverlay({
  charts,
  onUpdateChart,
  onRemoveChart,
}: ChartOverlayProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, id: string, x: number, y: number) => {
    // Prevent dragging if clicking buttons/controls inside the chart
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    
    setDraggingId(id);
    setDragOffset({
      x: e.clientX - x,
      y: e.clientY - y,
    });
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    onUpdateChart(draggingId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove as any);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove as any);
    };
  }, [draggingId, dragOffset]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Allow clicks to pass through to canvas when not hitting a chart
        zIndex: 10,
        overflow: 'hidden'
      }}
    >
      {charts.map(chart => (
        <div
          key={chart.id}
          style={{
            position: 'absolute',
            left: chart.x,
            top: chart.y,
            width: chart.width,
            height: chart.height,
            backgroundColor: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '8px',
            pointerEvents: 'auto',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseDown={(e) => handleMouseDown(e, chart.id, chart.x, chart.y)}
        >
          <div style={{ 
            padding: '8px', 
            display: 'flex', 
            justifyContent: 'flex-end',
            borderBottom: '1px solid #f3f4f6',
            cursor: 'move',
            background: '#f9fafb',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          }}>
            <button
              onClick={() => onRemoveChart(chart.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, padding: '8px', minHeight: 0 }}>
            <ChartComponent
              type={chart.type}
              data={chart.data}
              options={chart.options}
              width={chart.width - 16}
              height={chart.height - 40}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
