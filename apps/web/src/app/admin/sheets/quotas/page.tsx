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

const TARGET_TYPES = ['USER', 'SHEET', 'SPREADSHEET'] as const;

export default function QuotasPage() {
    const [quotas, setQuotas] = useState<Quota[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'USER' | 'SHEET' | 'SPREADSHEET'>('all');
    const [defaults, setDefaults] = useState({ maxRows: 10000, maxColumns: 26, maxCells: 1000000, maxFileSize: 10485760 });

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingQuota, setEditingQuota] = useState<Quota | null>(null);
    const [form, setForm] = useState({
        targetType: 'USER' as 'USER' | 'SHEET' | 'SPREADSHEET',
        targetId: '',
        maxRows: 10000,
        maxColumns: 26,
        maxCells: 1000000,
        maxFileSize: 10485760,
    });

    useEffect(() => {
        fetchQuotas();
        fetchDefaults();
    }, [filter]);

    const fetchQuotas = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const url = filter === 'all' ? '/api/admin/quotas' : `/api/admin/quotas?type=${filter}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setQuotas(await res.json());
        } catch (error) {
            console.error('Failed to fetch quotas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDefaults = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/admin/quotas/defaults', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setDefaults(await res.json());
        } catch (error) {
            console.error('Failed to fetch defaults:', error);
        }
    };

    const handleSave = async () => {
        const token = localStorage.getItem('auth_token');
        const url = editingQuota ? `/api/admin/quotas/${editingQuota.id}` : '/api/admin/quotas';
        const method = editingQuota ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                fetchQuotas();
                setShowModal(false);
                resetForm();
            }
        } catch (error) {
            console.error('Failed to save quota:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`/api/admin/quotas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) fetchQuotas();
        } catch (error) {
            console.error('Failed to delete quota:', error);
        }
    };

    const openEdit = (quota: Quota) => {
        setEditingQuota(quota);
        setForm({
            targetType: quota.targetType,
            targetId: quota.targetId,
            maxRows: quota.maxRows,
            maxColumns: quota.maxColumns,
            maxCells: quota.maxCells,
            maxFileSize: quota.maxFileSize,
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingQuota(null);
        setForm({
            targetType: 'USER',
            targetId: '',
            maxRows: defaults.maxRows,
            maxColumns: defaults.maxColumns,
            maxCells: defaults.maxCells,
            maxFileSize: defaults.maxFileSize,
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const getUsagePercent = (used: number, max: number) => max > 0 ? Math.min(100, (used / max) * 100) : 0;
    const getUsageColor = (percent: number) => {
        if (percent >= 90) return '#ef4444';
        if (percent >= 70) return '#f97316';
        if (percent >= 50) return '#eab308';
        return '#22c55e';
    };

    const ProgressBar = ({ used, max }: { used: number; max: number }) => {
        const percent = getUsagePercent(used, max);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: getUsageColor(percent) }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{percent.toFixed(0)}%</span>
            </div>
        );
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
                    <button className={styles.addButton} onClick={() => { resetForm(); setShowModal(true); }}>
                        + 할당량 추가
                    </button>
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
                                {quotas.map(quota => (
                                    <tr key={quota.id}>
                                        <td>
                                            <span style={{ padding: '4px 8px', background: '#e0f2fe', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                {quota.targetType}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {quota.targetId.slice(0, 8)}...
                                        </td>
                                        <td><ProgressBar used={quota.usedRows} max={quota.maxRows} /></td>
                                        <td><ProgressBar used={quota.usedColumns} max={quota.maxColumns} /></td>
                                        <td><ProgressBar used={quota.usedCells} max={quota.maxCells} /></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className={styles.addButton} onClick={() => openEdit(quota)}>수정</button>
                                                <button
                                                    className={styles.addButton}
                                                    style={{ background: '#fee2e2', color: '#dc2626' }}
                                                    onClick={() => handleDelete(quota.id)}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem' }}>
                            {editingQuota ? '할당량 수정' : '할당량 추가'}
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>대상 타입</label>
                                <select
                                    value={form.targetType}
                                    onChange={e => setForm({ ...form, targetType: e.target.value as any })}
                                    disabled={!!editingQuota}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                >
                                    {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>대상 ID</label>
                                <input
                                    value={form.targetId}
                                    onChange={e => setForm({ ...form, targetId: e.target.value })}
                                    disabled={!!editingQuota}
                                    placeholder="사용자 ID 또는 시트 ID"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>최대 행</label>
                                    <input
                                        type="number"
                                        value={form.maxRows}
                                        onChange={e => setForm({ ...form, maxRows: parseInt(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>최대 열</label>
                                    <input
                                        type="number"
                                        value={form.maxColumns}
                                        onChange={e => setForm({ ...form, maxColumns: parseInt(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>최대 셀</label>
                                    <input
                                        type="number"
                                        value={form.maxCells}
                                        onChange={e => setForm({ ...form, maxCells: parseInt(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>최대 파일 크기 (bytes)</label>
                                    <input
                                        type="number"
                                        value={form.maxFileSize}
                                        onChange={e => setForm({ ...form, maxFileSize: parseInt(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
