'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from './page.module.css';

interface UsageStats {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    topEndpoints: { endpoint: string; count: number }[];
    errorsByEndpoint: { endpoint: string; count: number }[];
}

interface TimeSeriesData {
    timestamp: string;
    count: number;
    avgResponseTime: number;
}

export default function APIUsagePage() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [hours, setHours] = useState(24);

    useEffect(() => {
        fetchData();
    }, [hours]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, timeSeriesRes] = await Promise.all([
                fetch('/api/admin/api-usage/stats', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
                fetch(`/api/admin/api-usage/timeseries?hours=${hours}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
            ]);

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
            if (timeSeriesRes.ok) {
                const data = await timeSeriesRes.json();
                setTimeSeries(data);
            }
        } catch (error) {
            console.error('Failed to fetch API usage:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AdminHeader title="API 사용량" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.filters}>
                    {[24, 48, 168].map(h => (
                        <button
                            key={h}
                            className={`${styles.filterBtn} ${hours === h ? styles.active : ''}`}
                            onClick={() => setHours(h)}
                        >
                            {h === 24 ? '24시간' : h === 48 ? '48시간' : '7일'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : stats ? (
                    <>
                        {/* Overview Stats */}
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{stats.totalRequests.toLocaleString()}</span>
                                <span className={styles.statLabel}>총 요청</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{stats.successRate.toFixed(1)}%</span>
                                <span className={styles.statLabel}>성공률</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{Math.round(stats.avgResponseTime)}ms</span>
                                <span className={styles.statLabel}>평균 응답시간</span>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className={styles.chartsRow}>
                            <div className={styles.chartCard}>
                                <h3>시간별 요청량</h3>
                                <div className={styles.barChart}>
                                    {timeSeries.slice(-12).map((item, idx) => (
                                        <div key={idx} className={styles.barItem}>
                                            <div
                                                className={styles.bar}
                                                style={{
                                                    height: `${Math.min(100, (item.count / Math.max(...timeSeries.map(t => t.count))) * 100)}%`
                                                }}
                                            />
                                            <span className={styles.barLabel}>
                                                {new Date(item.timestamp).getHours()}시
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Top Endpoints */}
                        <div className={styles.tablesRow}>
                            <div className={styles.tableCard}>
                                <h3>인기 엔드포인트</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>엔드포인트</th>
                                            <th>요청 수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.topEndpoints.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className={styles.endpoint}>{item.endpoint}</td>
                                                <td>{item.count.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className={styles.tableCard}>
                                <h3>에러 발생 엔드포인트</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>엔드포인트</th>
                                            <th>에러 수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.errorsByEndpoint.length === 0 ? (
                                            <tr><td colSpan={2} className={styles.emptyRow}>에러 없음 🎉</td></tr>
                                        ) : (
                                            stats.errorsByEndpoint.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className={styles.endpoint}>{item.endpoint}</td>
                                                    <td className={styles.errorCount}>{item.count}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.empty}>데이터를 불러올 수 없습니다.</div>
                )}
            </div>
        </>
    );
}
