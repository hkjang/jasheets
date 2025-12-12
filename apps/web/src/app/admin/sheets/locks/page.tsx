'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from '../permissions/page.module.css';

interface SheetLock {
    id: string;
    sheetId: string;
    lockedById: string;
    reason?: string;
    lockedAt: string;
    expiresAt?: string;
    sheet?: { id: string; name: string; spreadsheetName?: string };
    lockedBy?: { email: string; name?: string };
}

export default function LocksPage() {
    const [locks, setLocks] = useState<SheetLock[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLocks();
    }, []);

    const fetchLocks = async () => {
        try {
            const res = await fetch('/api/admin/sheet-locks', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setLocks(data);
            }
        } catch (error) {
            console.error('Failed to fetch locks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleForceUnlock = async (sheetId: string) => {
        if (!confirm('정말 강제로 잠금을 해제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/admin/sheet-locks/${sheetId}/force`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });

            if (res.ok) {
                fetchLocks();
            }
        } catch (error) {
            console.error('Failed to unlock sheet:', error);
        }
    };

    const handleCleanup = async () => {
        try {
            const res = await fetch('/api/admin/sheet-locks/cleanup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });

            if (res.ok) {
                const data = await res.json();
                alert(`${data.cleaned}개의 만료된 잠금이 정리되었습니다.`);
                fetchLocks();
            }
        } catch (error) {
            console.error('Failed to cleanup:', error);
        }
    };

    return (
        <>
            <AdminHeader title="시트 잠금 관리" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.header}>
                    <p className={styles.description}>강제 잠금된 시트를 관리하고 잠금을 해제합니다.</p>
                    <button className={styles.addButton} onClick={handleCleanup}>
                        만료된 잠금 정리
                    </button>
                </div>

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : locks.length === 0 ? (
                    <div className={styles.empty}>현재 잠긴 시트가 없습니다.</div>
                ) : (
                    <div className={styles.table}>
                        <table>
                            <thead>
                                <tr>
                                    <th>시트</th>
                                    <th>스프레드시트</th>
                                    <th>잠금 사용자</th>
                                    <th>사유</th>
                                    <th>잠금 시간</th>
                                    <th>만료 시간</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locks.map(lock => (
                                    <tr key={lock.id}>
                                        <td className={styles.nameCell}>{lock.sheet?.name || lock.sheetId}</td>
                                        <td>{lock.sheet?.spreadsheetName || '-'}</td>
                                        <td>{lock.lockedBy?.name || lock.lockedBy?.email || lock.lockedById}</td>
                                        <td>{lock.reason || '-'}</td>
                                        <td>{new Date(lock.lockedAt).toLocaleString('ko-KR')}</td>
                                        <td>{lock.expiresAt ? new Date(lock.expiresAt).toLocaleString('ko-KR') : '무제한'}</td>
                                        <td>
                                            <button onClick={() => handleForceUnlock(lock.sheetId)} className={styles.deleteBtn}>
                                                강제 해제
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
