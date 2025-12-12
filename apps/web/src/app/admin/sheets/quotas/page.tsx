'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from '../permissions/page.module.css';

interface Quota {
    id: string;
    targetType: 'USER' | 'SHEET' | 'SPREADSHEET';
    targetId: string;
    maxRows: number;
    maxColumns: number;
    maxCells: number;
    maxFileSize: number;
    usedRows: number;
    usedColumns: number;
    usedCells: number;
    createdAt: string;
}

export default function QuotasPage() {
    const [quotas, setQuotas] = useState<Quota[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'USER' | 'SHEET' | 'SPREADSHEET'>('all');
    const [defaults, setDefaults] = useState({ maxRows: 0, maxColumns: 0, maxCells: 0, maxFileSize: 0 });

    useEffect(() => {
        fetchQuotas();
        fetchDefaults();
    }, [filter]);

    const fetchQuotas = async () => {
        try {
            const url = filter === 'all'
                ? '/api/admin/quotas'
                : `/api/admin/quotas?type=${filter}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setQuotas(data);
            }
        } catch (error) {
            console.error('Failed to fetch quotas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDefaults = async () => {
        try {
            const res = await fetch('/api/admin/quotas/defaults', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDefaults(data);
            }
        } catch (error) {
            console.error('Failed to fetch defaults:', error);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const getUsagePercent = (used: number, max: number) => {
        return max > 0 ? Math.min(100, (used / max) * 100) : 0;
    };

    const getUsageColor = (percent: number) => {
        if (percent >= 90) return '#ef4444';
        if (percent >= 70) return '#f97316';
        if (percent >= 50) return '#eab308';
        return '#22c55e';
    };

    return (
        <>
            <AdminHeader title="할당량 관리" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <p className={styles.description}>사용자 및 시트별 리소스 할당량을 관리합니다.</p>
                        <p className={styles.description} style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                            기본값: 행 {defaults.maxRows.toLocaleString()}개 | 열 {defaults.maxColumns.toLocaleString()}개 |
                            셀 {defaults.maxCells.toLocaleString()}개 | 파일 {formatSize(defaults.maxFileSize)}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {(['all', 'USER', 'SHEET', 'SPREADSHEET'] as const).map(f => (
                        <button
                            key={f}
                            className={styles.addButton}
                            style={{
                                background: filter === f ? '#3b82f6' : '#f1f5f9',
                                color: filter === f ? 'white' : '#64748b'
                            }}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? '전체' : f === 'USER' ? '사용자' : f === 'SHEET' ? '시트' : '스프레드시트'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : quotas.length === 0 ? (
                    <div className={styles.empty}>설정된 할당량이 없습니다. (기본값 적용 중)</div>
                ) : (
                    <div className={styles.table}>
                        <table>
                            <thead>
                                <tr>
                                    <th>타입</th>
                                    <th>대상 ID</th>
                                    <th>행 사용량</th>
                                    <th>열 사용량</th>
                                    <th>셀 사용량</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotas.map(quota => {
                                    const rowPercent = getUsagePercent(quota.usedRows, quota.maxRows);
                                    const colPercent = getUsagePercent(quota.usedColumns, quota.maxColumns);
                                    const cellPercent = getUsagePercent(quota.usedCells, quota.maxCells);

                                    return (
                                        <tr key={quota.id}>
                                            <td>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    background: '#e0f2fe',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {quota.targetType}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                {quota.targetId.slice(0, 8)}...
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '60px',
                                                        height: '8px',
                                                        background: '#e2e8f0',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${rowPercent}%`,
                                                            height: '100%',
                                                            background: getUsageColor(rowPercent)
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {rowPercent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '60px',
                                                        height: '8px',
                                                        background: '#e2e8f0',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${colPercent}%`,
                                                            height: '100%',
                                                            background: getUsageColor(colPercent)
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {colPercent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '60px',
                                                        height: '8px',
                                                        background: '#e2e8f0',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${cellPercent}%`,
                                                            height: '100%',
                                                            background: getUsageColor(cellPercent)
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {cellPercent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <button>수정</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
