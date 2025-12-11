'use client';

import { useState, useEffect } from 'react';
import styles from './ProfilerPanel.module.css';

interface ColumnProfile {
    columnIndex: number;
    columnName?: string;
    dataType: string;
    statistics: {
        count: number;
        nonEmpty: number;
        unique: number;
        missing: number;
        missingPercent: number;
        min?: number;
        max?: number;
        mean?: number;
        median?: number;
        stdDev?: number;
    };
    distribution: {
        type: string;
        bins?: { range: string; count: number; percent: number }[];
        topValues?: { value: any; count: number; percent: number }[];
    };
    quality: {
        completeness: number;
        uniqueness: number;
        validity: number;
        overallScore: number;
        issues: string[];
    };
}

interface SheetProfile {
    sheetName: string;
    totalRows: number;
    totalCols: number;
    columns: ColumnProfile[];
    summary: {
        overallQuality: number;
        totalMissing: number;
        totalOutliers: number;
        insights: string[];
    };
}

interface ProfilerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[][];
    headers?: string[];
    sheetName?: string;
    apiUrl?: string;
}

export default function ProfilerPanel({
    isOpen,
    onClose,
    data,
    headers,
    sheetName = 'Sheet',
    apiUrl = 'http://localhost:4000/api',
}: ProfilerPanelProps) {
    const [profile, setProfile] = useState<SheetProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && data.length > 0) {
            analyzeData();
        }
    }, [isOpen, data]);

    const analyzeData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/profiler/sheet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    data,
                    options: {
                        sheetName,
                        headers,
                        detectOutliers: true,
                        calculateCorrelations: true,
                    },
                }),
            });

            if (response.ok) {
                const result = await response.json();
                setProfile(result);
            } else {
                throw new Error('데이터 분석에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const getQualityColor = (score: number): string => {
        if (score >= 80) return '#34a853';
        if (score >= 60) return '#fbbc04';
        return '#ea4335';
    };

    if (!isOpen) return null;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h3>
                    <span>📊</span>
                    데이터 프로파일러
                </h3>
                <button className={styles.closeBtn} onClick={onClose}>
                    ×
                </button>
            </div>

            <div className={styles.content}>
                {isLoading && (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <span>데이터를 분석하고 있습니다...</span>
                    </div>
                )}

                {error && <div className={styles.error}>{error}</div>}

                {!isLoading && !error && !profile && data.length === 0 && (
                    <div className={styles.empty}>
                        분석할 데이터가 없습니다.
                    </div>
                )}

                {profile && (
                    <>
                        {/* Summary Cards */}
                        <div className={styles.summary}>
                            <div className={`${styles.summaryCard} ${styles.qualityScore}`}>
                                <div className={styles.value}>
                                    {Math.round(profile.summary.overallQuality)}%
                                </div>
                                <div className={styles.label}>품질 점수</div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.value}>{profile.totalRows}</div>
                                <div className={styles.label}>행 수</div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.value}>{profile.totalCols}</div>
                                <div className={styles.label}>열 수</div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.value}>{profile.summary.totalMissing}</div>
                                <div className={styles.label}>결측치</div>
                            </div>
                        </div>

                        {/* Insights */}
                        {profile.summary.insights.length > 0 && (
                            <div className={styles.insights}>
                                <h4>💡 인사이트</h4>
                                <ul>
                                    {profile.summary.insights.map((insight, i) => (
                                        <li key={i}>{insight}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Column Profiles */}
                        <div className={styles.columns}>
                            {profile.columns.map((col, i) => (
                                <div key={i} className={styles.columnCard}>
                                    <div className={styles.columnHeader}>
                                        <span className={styles.columnName}>{col.columnName}</span>
                                        <span className={styles.columnType}>{col.dataType}</span>
                                    </div>

                                    <div className={styles.stats}>
                                        <div className={styles.stat}>
                                            <div className={styles.statValue}>{col.statistics.count}</div>
                                            <div className={styles.statLabel}>총 개수</div>
                                        </div>
                                        <div className={styles.stat}>
                                            <div className={styles.statValue}>{col.statistics.unique}</div>
                                            <div className={styles.statLabel}>고유값</div>
                                        </div>
                                        <div className={styles.stat}>
                                            <div className={styles.statValue}>
                                                {col.statistics.missingPercent.toFixed(1)}%
                                            </div>
                                            <div className={styles.statLabel}>결측치</div>
                                        </div>
                                        {col.dataType === 'numeric' && col.statistics.mean !== undefined && (
                                            <div className={styles.stat}>
                                                <div className={styles.statValue}>
                                                    {col.statistics.mean.toFixed(2)}
                                                </div>
                                                <div className={styles.statLabel}>평균</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quality Bar */}
                                    <div className={styles.qualityBar}>
                                        <div
                                            className={styles.qualityFill}
                                            style={{
                                                width: `${col.quality.overallScore}%`,
                                                background: getQualityColor(col.quality.overallScore),
                                            }}
                                        />
                                    </div>

                                    {/* Distribution Histogram */}
                                    {col.distribution.bins && col.distribution.bins.length > 0 && (
                                        <div className={styles.distribution}>
                                            <h5>분포</h5>
                                            {col.distribution.bins.slice(0, 5).map((bin, bi) => (
                                                <div key={bi} className={styles.histogramBar}>
                                                    <span className={styles.histogramLabel}>{bin.range}</span>
                                                    <div
                                                        className={styles.histogramFill}
                                                        style={{ width: `${bin.percent}%` }}
                                                    />
                                                    <span className={styles.histogramPercent}>
                                                        {bin.percent.toFixed(1)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Issues */}
                                    {col.quality.issues.length > 0 && (
                                        <div className={styles.issues}>
                                            {col.quality.issues.map((issue, ii) => (
                                                <div key={ii} className={styles.issue}>{issue}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {profile && (
                <div className={styles.actions}>
                    <button className={styles.exportBtn} onClick={() => {
                        const json = JSON.stringify(profile, null, 2);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${sheetName}_profile.json`;
                        a.click();
                    }}>
                        JSON 내보내기
                    </button>
                </div>
            )}
        </div>
    );
}
