'use client';

import { useState, useEffect } from 'react';
import styles from './HistoryTimelinePanel.module.css';

interface Revision {
    id: string;
    action: string;
    targetRange?: string;
    description?: string;
    previousData?: any;
    newData?: any;
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
    };
}

interface RevisionStats {
    totalRevisions: number;
    revisionsByAction: Array<{ action: string; count: number }>;
    activityByDay: Record<string, number>;
}

interface HistoryTimelinePanelProps {
    isOpen: boolean;
    onClose: () => void;
    sheetId: string;
    onRollback?: (revisionId: string) => void;
}

export default function HistoryTimelinePanel({
    isOpen,
    onClose,
    sheetId,
    onRollback,
}: HistoryTimelinePanelProps) {
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [stats, setStats] = useState<RevisionStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
    const [filter, setFilter] = useState('');
    const [rolling, setRolling] = useState(false);

    useEffect(() => {
        if (isOpen && sheetId) {
            fetchRevisions();
            fetchStats();
        }
    }, [isOpen, sheetId]);

    const fetchRevisions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url = filter
                ? `/api/sheets/${sheetId}/revisions?action=${filter}`
                : `/api/sheets/${sheetId}/revisions`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setRevisions(data.revisions || []);
            }
        } catch (err) {
            console.error('Failed to fetch revisions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/revisions/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const handleRollback = async (revisionId: string) => {
        if (!confirm('이 시점으로 되돌리시겠습니까? 이후 변경사항이 모두 취소됩니다.')) return;

        setRolling(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/revisions/${revisionId}/rollback`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                onRollback?.(revisionId);
                fetchRevisions();
                setSelectedRevision(null);
                alert('롤백이 완료되었습니다.');
            }
        } catch (err) {
            console.error('Rollback failed:', err);
            alert('롤백에 실패했습니다.');
        } finally {
            setRolling(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            CELL_UPDATE: '셀 수정',
            BULK_UPDATE: '일괄 수정',
            ROLLBACK: '롤백',
            ROW_INSERT: '행 추가',
            ROW_DELETE: '행 삭제',
            COL_INSERT: '열 추가',
            COL_DELETE: '열 삭제',
        };
        return labels[action] || action;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h2>변경 기록</h2>
                <button className={styles.closeButton} onClick={onClose}>×</button>
            </div>

            {stats && (
                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{stats.totalRevisions}</span>
                        <span className={styles.statLabel}>총 변경</span>
                    </div>
                    {stats.revisionsByAction.slice(0, 3).map(({ action, count }) => (
                        <div key={action} className={styles.statItem}>
                            <span className={styles.statValue}>{count}</span>
                            <span className={styles.statLabel}>{getActionLabel(action)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.filterBar}>
                <select
                    value={filter}
                    onChange={e => {
                        setFilter(e.target.value);
                        setTimeout(fetchRevisions, 0);
                    }}
                    className={styles.filterSelect}
                >
                    <option value="">전체 작업</option>
                    <option value="CELL_UPDATE">셀 수정</option>
                    <option value="BULK_UPDATE">일괄 수정</option>
                    <option value="ROLLBACK">롤백</option>
                </select>
            </div>

            <div className={styles.timeline}>
                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : revisions.length === 0 ? (
                    <div className={styles.empty}>변경 기록이 없습니다.</div>
                ) : (
                    revisions.map((rev, index) => (
                        <div
                            key={rev.id}
                            className={`${styles.revisionItem} ${selectedRevision?.id === rev.id ? styles.selected : ''}`}
                            onClick={() => setSelectedRevision(selectedRevision?.id === rev.id ? null : rev)}
                        >
                            <div className={styles.timelineDot} />
                            {index < revisions.length - 1 && <div className={styles.timelineLine} />}

                            <div className={styles.revisionContent}>
                                <div className={styles.revisionHeader}>
                                    <span className={styles.actionBadge}>{getActionLabel(rev.action)}</span>
                                    <span className={styles.time}>{formatDate(rev.createdAt)}</span>
                                </div>

                                <div className={styles.revisionMeta}>
                                    <div className={styles.userInfo}>
                                        {rev.user.avatar ? (
                                            <img src={rev.user.avatar} alt="" className={styles.avatar} />
                                        ) : (
                                            <div className={styles.avatarPlaceholder}>
                                                {rev.user.name[0]}
                                            </div>
                                        )}
                                        <span>{rev.user.name}</span>
                                    </div>
                                    {rev.targetRange && (
                                        <span className={styles.range}>{rev.targetRange}</span>
                                    )}
                                </div>

                                {rev.description && (
                                    <div className={styles.description}>{rev.description}</div>
                                )}

                                {selectedRevision?.id === rev.id && (
                                    <div className={styles.details}>
                                        {rev.previousData && (
                                            <div className={styles.dataPreview}>
                                                <h4>이전 데이터</h4>
                                                <pre>{JSON.stringify(rev.previousData, null, 2).slice(0, 200)}</pre>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleRollback(rev.id)}
                                            className={styles.rollbackButton}
                                            disabled={rolling}
                                        >
                                            {rolling ? '롤백 중...' : '이 시점으로 되돌리기'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
