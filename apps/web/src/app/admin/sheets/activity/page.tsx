'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from './page.module.css';

interface ActivitySession {
    id: string;
    spreadsheetId: string;
    spreadsheetName?: string;
    sheetId?: string;
    userId: string;
    user?: { email: string; name?: string };
    sessionType: string;
    startedAt: string;
    lastActiveAt: string;
    editCount: number;
    viewCount: number;
}

interface ActivitySummary {
    spreadsheetId: string;
    spreadsheetName?: string;
    activeSessions: number;
    recentEditors: { userId: string; userName?: string; lastActive: string }[];
    totalEdits24h: number;
    totalViews24h: number;
}

export default function ActivityPage() {
    const [sessions, setSessions] = useState<ActivitySession[]>([]);
    const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
    const [view, setView] = useState<'sessions' | 'summaries'>('sessions');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [sessionsRes, summariesRes] = await Promise.all([
                fetch('/api/admin/activity/sessions/active', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                }),
                fetch('/api/admin/activity/all', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                }),
            ]);

            if (sessionsRes.ok) {
                const data = await sessionsRes.json();
                setSessions(data);
            }
            if (summariesRes.ok) {
                const data = await summariesRes.json();
                setSummaries(data);
            }
        } catch (error) {
            console.error('Failed to fetch activity:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return `${Math.floor(diff / 86400)}일 전`;
    };

    return (
        <>
            <AdminHeader title="시트 활동 현황" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{sessions.length}</span>
                            <span className={styles.statLabel}>활성 세션</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{summaries.length}</span>
                            <span className={styles.statLabel}>활성 스프레드시트</span>
                        </div>
                    </div>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${view === 'sessions' ? styles.active : ''}`}
                            onClick={() => setView('sessions')}
                        >
                            세션 목록
                        </button>
                        <button
                            className={`${styles.tab} ${view === 'summaries' ? styles.active : ''}`}
                            onClick={() => setView('summaries')}
                        >
                            스프레드시트별 요약
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : view === 'sessions' ? (
                    sessions.length === 0 ? (
                        <div className={styles.empty}>현재 활성 세션이 없습니다.</div>
                    ) : (
                        <div className={styles.sessionList}>
                            {sessions.map(session => (
                                <div key={session.id} className={styles.sessionCard}>
                                    <div className={styles.sessionHeader}>
                                        <span className={styles.userName}>
                                            {session.user?.name || session.user?.email || session.userId}
                                        </span>
                                        <span className={`${styles.sessionType} ${styles[session.sessionType.toLowerCase()]}`}>
                                            {session.sessionType}
                                        </span>
                                    </div>
                                    <div className={styles.sessionMeta}>
                                        <span>📄 {session.spreadsheetName || session.spreadsheetId}</span>
                                        <span>✏️ {session.editCount}건 편집</span>
                                        <span>👁️ {session.viewCount}건 조회</span>
                                    </div>
                                    <div className={styles.sessionTime}>
                                        마지막 활동: {formatTimeAgo(session.lastActiveAt)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    summaries.length === 0 ? (
                        <div className={styles.empty}>활성 스프레드시트가 없습니다.</div>
                    ) : (
                        <div className={styles.summaryList}>
                            {summaries.map(summary => (
                                <div key={summary.spreadsheetId} className={styles.summaryCard}>
                                    <h3>{summary.spreadsheetName || summary.spreadsheetId}</h3>
                                    <div className={styles.summaryStats}>
                                        <div className={styles.summaryStat}>
                                            <span>{summary.activeSessions}</span>
                                            <label>활성 세션</label>
                                        </div>
                                        <div className={styles.summaryStat}>
                                            <span>{summary.totalEdits24h}</span>
                                            <label>24시간 편집</label>
                                        </div>
                                        <div className={styles.summaryStat}>
                                            <span>{summary.totalViews24h}</span>
                                            <label>24시간 조회</label>
                                        </div>
                                    </div>
                                    {summary.recentEditors.length > 0 && (
                                        <div className={styles.editors}>
                                            최근 편집자: {summary.recentEditors.slice(0, 3).map(e => e.userName || '익명').join(', ')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </>
    );
}
