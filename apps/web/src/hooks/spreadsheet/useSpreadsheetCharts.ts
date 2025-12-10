
import { useState, useCallback } from 'react';
import { ChartConfig } from '../../components/charts/ChartOverlay';

export function useSpreadsheetCharts() {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);

  const handleAddChart = useCallback(() => setIsChartDialogOpen(true), []);

  const handleInsertChart = useCallback((chartConfig: any) => {
    const newChart: ChartConfig = {
      id: Math.random().toString(36).substr(2, 9),
      ...chartConfig,
      x: 100, y: 100, width: 400, height: 300,
    };
    setCharts(prev => [...prev, newChart]);
  }, []);

  const handleUpdateChart = useCallback((id: string, updates: Partial<ChartConfig>) => {
    setCharts(prev => prev.map(chart => chart.id === id ? { ...chart, ...updates } : chart));
  }, []);

  const handleRemoveChart = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    charts,
    setCharts,
    isChartDialogOpen,
    setIsChartDialogOpen,
    handleAddChart,
    handleInsertChart,
    handleUpdateChart,
    handleRemoveChart,
  };
}
