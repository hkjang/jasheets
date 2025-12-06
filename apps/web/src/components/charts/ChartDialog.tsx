'use client';

import { useState, useMemo } from 'react';
import ChartComponent, { ChartType } from './ChartComponent';
import styles from './ChartDialog.module.css';

interface ChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedData: any[][];
  onInsert?: (chartConfig: any) => void;
}

const CHART_TYPES: { type: ChartType; label: string; icon: string }[] = [
  { type: 'bar', label: '막대 차트', icon: '📊' },
  { type: 'line', label: '꺾은선 차트', icon: '📈' },
  { type: 'pie', label: '원형 차트', icon: '🥧' },
  { type: 'doughnut', label: '도넛 차트', icon: '🍩' },
  { type: 'area', label: '영역 차트', icon: '📉' },
];

export default function ChartDialog({
  isOpen,
  onClose,
  selectedData,
  onInsert,
}: ChartDialogProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('');
  const [showLegend, setShowLegend] = useState(true);
  const [horizontal, setHorizontal] = useState(false);

  const chartOptions = useMemo(() => ({
    title,
    showLegend,
    horizontal,
  }), [title, showLegend, horizontal]);

  const handleInsert = () => {
    onInsert?.({
      type: chartType,
      data: selectedData,
      options: chartOptions,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>📊 차트 삽입</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.sidebar}>
            <div className={styles.section}>
              <label>차트 유형</label>
              <div className={styles.typeGrid}>
                {CHART_TYPES.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    className={`${styles.typeBtn} ${chartType === type ? styles.active : ''}`}
                    onClick={() => setChartType(type)}
                  >
                    <span className={styles.icon}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <label>차트 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목 입력..."
              />
            </div>

            <div className={styles.section}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
                범례 표시
              </label>
            </div>

            {(chartType === 'bar') && (
              <div className={styles.section}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={horizontal}
                    onChange={(e) => setHorizontal(e.target.checked)}
                  />
                  가로 막대
                </label>
              </div>
            )}
          </div>

          <div className={styles.preview}>
            <h3>미리보기</h3>
            <div className={styles.chartWrapper}>
              <ChartComponent
                type={chartType}
                data={selectedData}
                options={chartOptions}
                width={450}
                height={300}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button className={styles.insertBtn} onClick={handleInsert}>
            차트 삽입
          </button>
        </div>
      </div>
    </div>
  );
}
