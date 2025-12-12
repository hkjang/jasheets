'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from '../udf/page.module.css';

interface MacroApproval {
    id: string;
    spreadsheetId: string;
    commandId?: string;
    name: string;
    script: string;
    description?: string;
    requesterId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
    reviewerId?: string;
    reviewNotes?: string;
    lintResults?: { errors: any[]; warnings: any[]; info: any[] };
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requestedAt: string;
    reviewedAt?: string;
}

export default function MacrosPage() {
    const [approvals, setApprovals] = useState<MacroApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [selectedApproval, setSelectedApproval] = useState<MacroApproval | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    useEffect(() => {
        fetchApprovals();
    }, [filter]);

    const fetchApprovals = async () => {
        try {
            const url = filter === 'all'
                ? '/api/admin/macro-approvals'
                : `/api/admin/macro-approvals?status=${filter}`;
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

    const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
        if (!selectedApproval) return;

        try {
            const res = await fetch(`/api/admin/macro-approvals/${selectedApproval.id}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ status, reviewNotes }),
            });

            if (res.ok) {
                fetchApprovals();
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
            <AdminHeader title="매크로 승인 관리" backLink="/admin/sheets" />
            <div className={styles.container}>
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

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : approvals.length === 0 ? (
                    <div className={styles.empty}>매크로 승인 요청이 없습니다.</div>
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
                                {approval.lintResults && (
                                    <div className={styles.cardMeta}>
                                        <span>오류: {approval.lintResults.errors.length}</span>
                                        <span>경고: {approval.lintResults.warnings.length}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {selectedApproval && (
                    <div className={styles.modal} onClick={() => setSelectedApproval(null)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2>{selectedApproval.name}</h2>
                                <button onClick={() => setSelectedApproval(null)}>×</button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.codeSection}>
                                    <h4>스크립트</h4>
                                    <pre>{selectedApproval.script}</pre>
                                </div>

                                {selectedApproval.lintResults && (
                                    <div className={styles.riskSection}>
                                        <h4>린트 결과</h4>
                                        {selectedApproval.lintResults.errors.length > 0 && (
                                            <ul>
                                                {selectedApproval.lintResults.errors.map((e, idx) => (
                                                    <li key={idx} className={styles.riskCritical}>Line {e.line}: {e.message}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {selectedApproval.lintResults.warnings.length > 0 && (
                                            <ul>
                                                {selectedApproval.lintResults.warnings.map((w, idx) => (
                                                    <li key={idx} className={styles.riskMedium}>Line {w.line}: {w.message}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {selectedApproval.lintResults.errors.length === 0 &&
                                            selectedApproval.lintResults.warnings.length === 0 && (
                                                <p>문제 없음 ✓</p>
                                            )}
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
