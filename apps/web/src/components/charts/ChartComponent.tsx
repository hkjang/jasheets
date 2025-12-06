'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import styles from './ChartComponent.module.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area';

interface ChartComponentProps {
  type: ChartType;
  data: any[][];
  options?: {
    title?: string;
    labels?: string[];
    colors?: string[];
    showLegend?: boolean;
    horizontal?: boolean;
  };
  width?: number;
  height?: number;
}

const DEFAULT_COLORS = [
  '#4285f4',
  '#ea4335',
  '#34a853',
  '#fbbc04',
  '#9c27b0',
  '#00bcd4',
  '#ff5722',
  '#795548',
  '#607d8b',
  '#e91e63',
];

export default function ChartComponent({
  type,
  data,
  options = {},
  width = 400,
  height = 300,
}: ChartComponentProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] };
    }

    const hasHeaders = typeof data[0]?.[0] === 'string' && isNaN(Number(data[0]?.[1]));
    const startRow = hasHeaders ? 1 : 0;
    
    // Labels from first column
    const labels = data.slice(startRow).map(row => String(row[0] ?? ''));
    
    // If we have column headers, use them as dataset labels
    const columnHeaders = hasHeaders ? data[0].slice(1) : [];
    
    // Create datasets for each numeric column
    const numCols = data[0]?.length ?? 0;
    const datasets = [];
    
    for (let col = 1; col < numCols; col++) {
      const values = data.slice(startRow).map(row => {
        const val = row[col];
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      });
      
      const color = options.colors?.[col - 1] ?? DEFAULT_COLORS[(col - 1) % DEFAULT_COLORS.length];
      
      datasets.push({
        label: columnHeaders[col - 1] ? String(columnHeaders[col - 1]) : `Series ${col}`,
        data: values,
        backgroundColor: type === 'line' || type === 'area' 
          ? `${color}33`
          : values.map((_, i) => options.colors?.[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
        borderColor: color,
        borderWidth: type === 'line' || type === 'area' ? 2 : 1,
        fill: type === 'area',
        tension: 0.3,
      });
    }

    // For pie/doughnut with single series, restructure data
    if ((type === 'pie' || type === 'doughnut') && datasets.length === 1) {
      datasets[0].backgroundColor = labels.map((_, i) => 
        options.colors?.[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      );
    }

    return { labels, datasets };
  }, [data, type, options.colors]);

  const chartOptions: ChartOptions<any> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: options.horizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: options.showLegend !== false,
        position: 'top' as const,
        labels: {
          font: { size: 12 },
          padding: 12,
        },
      },
      title: {
        display: !!options.title,
        text: options.title,
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: { size: 12 },
        bodyFont: { size: 11 },
        cornerRadius: 4,
      },
    },
    scales: type === 'pie' || type === 'doughnut' ? undefined : {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { font: { size: 11 } },
        beginAtZero: true,
      },
    },
  }), [options.title, options.showLegend, options.horizontal, type]);

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'line':
      case 'area':
        return <Line data={chartData} options={chartOptions} />;
      case 'pie':
        return <Pie data={chartData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={chartOptions} />;
      default:
        return <Bar data={chartData} options={chartOptions} />;
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className={styles.empty}>
        차트를 생성하려면 데이터를 선택하세요.
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ width, height }}>
      {renderChart()}
    </div>
  );
}
