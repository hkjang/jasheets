'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from './page.module.css';

interface UDFApproval {
    id: string;
    spreadsheetId: string;
    name: string;
    description?: string;
    code: string;
    requesterId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
    reviewerId?: string;
    reviewNotes?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskDetails?: { pattern: string; risk: string; message: string; line?: number }[];
    requestedAt: string;
    reviewedAt?: string;
}

export default function UDFApprovalPage() {
    const [approvals, setApprovals] = useState<UDFApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
    const [selectedApproval, setSelectedApproval] = useState<UDFApproval | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, revoked: 0 });

    useEffect(() => {
        fetchApprovals();
        fetchStats();
    }, [filter]);

    const fetchApprovals = async () => {
        try {
            const url = filter === 'all'
                ? '/api/admin/udf-approvals'
                : `/api/admin/udf-approvals?status=${filter}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setApprovals(data);
            }
        } catch (error) {
            console.error('Failed to fetch approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/udf-approvals/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
        if (!selectedApproval) return;

        try {
            const res = await fetch(`/api/admin/udf-approvals/${selectedApproval.id}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ status, reviewNotes }),
            });

            if (res.ok) {
                fetchApprovals();
                fetchStats();
                setSelectedApproval(null);
                setReviewNotes('');
            }
        } catch (error) {
            console.error('Failed to review:', error);
        }
    };

    const getRiskBadgeClass = (risk?: string) => {
        switch (risk) {
            case 'CRITICAL': return styles.riskCritical;
            case 'HIGH': return styles.riskHigh;
            case 'MEDIUM': return styles.riskMedium;
            default: return styles.riskLow;
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'APPROVED': return styles.statusApproved;
            case 'REJECTED': return styles.statusRejected;
            case 'REVOKED': return styles.statusRevoked;
            default: return styles.statusPending;
        }
    };

    return (
        <>
            <AdminHeader title="UDF 승인 관리" backLink="/admin/sheets" />
            <div className={styles.container}>
                {/* Stats */}
                <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{stats.pending}</span>
                        <span className={styles.statLabel}>대기 중</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{stats.approved}</span>
                        <span className={styles.statLabel}>승인됨</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{stats.rejected}</span>
                        <span className={styles.statLabel}>거절됨</span>
                    </div>
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? '전체' : f === 'PENDING' ? '대기 중' : f === 'APPROVED' ? '승인됨' : '거절됨'}
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : approvals.length === 0 ? (
                    <div className={styles.empty}>UDF 승인 요청이 없습니다.</div>
                ) : (
                    <div className={styles.list}>
                        {approvals.map(approval => (
                            <div key={approval.id} className={styles.card} onClick={() => setSelectedApproval(approval)}>
                                <div className={styles.cardHeader}>
                                    <h3>{approval.name}</h3>
                                    <div className={styles.badges}>
                                        {approval.riskLevel && (
                                            <span className={`${styles.badge} ${getRiskBadgeClass(approval.riskLevel)}`}>
                                                {approval.riskLevel}
                                            </span>
                                        )}
                                        <span className={`${styles.badge} ${getStatusBadgeClass(approval.status)}`}>
                                            {approval.status}
                                        </span>
                                    </div>
                                </div>
                                <p className={styles.cardDesc}>{approval.description || '설명 없음'}</p>
                                <div className={styles.cardMeta}>
                                    <span>요청: {new Date(approval.requestedAt).toLocaleDateString('ko-KR')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detail Modal */}
                {selectedApproval && (
                    <div className={styles.modal} onClick={() => setSelectedApproval(null)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2>{selectedApproval.name}</h2>
                                <button onClick={() => setSelectedApproval(null)}>×</button>
                            </div>

                            <div className={styles.modalBody}>
                                <div className={styles.codeSection}>
                                    <h4>코드</h4>
                                    <pre>{selectedApproval.code}</pre>
                                </div>

                                {selectedApproval.riskDetails && selectedApproval.riskDetails.length > 0 && (
                                    <div className={styles.riskSection}>
                                        <h4>위험 분석 결과</h4>
                                        <ul>
                                            {selectedApproval.riskDetails.map((detail, idx) => (
                                                <li key={idx} className={getRiskBadgeClass(detail.risk)}>
                                                    Line {detail.line}: {detail.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedApproval.status === 'PENDING' && (
                                    <div className={styles.reviewSection}>
                                        <h4>리뷰</h4>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={e => setReviewNotes(e.target.value)}
                                            placeholder="리뷰 메모 (선택사항)"
                                        />
                                        <div className={styles.reviewActions}>
                                            <button onClick={() => handleReview('REJECTED')} className={styles.rejectBtn}>
                                                거절
                                            </button>
                                            <button onClick={() => handleReview('APPROVED')} className={styles.approveBtn}>
                                                승인
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
