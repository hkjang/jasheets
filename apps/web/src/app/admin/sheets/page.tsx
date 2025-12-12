'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { api } from '../../../lib/api';
import styles from './page.module.css';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: string;
    color: string;
    link?: string;
}

function StatCard({ title, value, icon, color, link }: StatCardProps) {
    const content = (
        <div className={styles.statCard} style={{ borderLeftColor: color }}>
            <div className={styles.statIcon} style={{ backgroundColor: color }}>{icon}</div>
            <div className={styles.statContent}>
                <p className={styles.statTitle}>{title}</p>
                <p className={styles.statValue}>{value}</p>
            </div>
        </div>
    );

    return link ? <Link href={link}>{content}</Link> : content;
}

interface MenuItem {
    title: string;
    description: string;
    icon: string;
    link: string;
    color: string;
}

const menuItems: MenuItem[] = [
    {
        title: '권한 정책 관리',
        description: '시트별 권한 템플릿 및 ACL 설정',
        icon: '🔐',
        link: '/admin/sheets/permissions',
        color: '#ef4444',
    },
    {
        title: '시트 잠금 관리',
        description: '시트 강제 잠금 및 편집 제한',
        icon: '🔒',
        link: '/admin/sheets/locks',
        color: '#f97316',
    },
    {
        title: 'UDF 승인',
        description: '사용자 정의 함수 승인 및 위험 검사',
        icon: '⚡',
        link: '/admin/sheets/udf',
        color: '#eab308',
    },
    {
        title: '매크로 승인',
        description: '매크로 명령어 안전 검사 및 승인',
        icon: '📜',
        link: '/admin/sheets/macros',
        color: '#84cc16',
    },
    {
        title: 'AI 설정',
        description: 'AI 모델 및 프롬프트 템플릿 관리',
        icon: '🤖',
        link: '/admin/sheets/ai',
        color: '#22c55e',
    },
    {
        title: '할당량 관리',
        description: '사용자/시트별 행·열 제한 설정',
        icon: '📊',
        link: '/admin/sheets/quotas',
        color: '#14b8a6',
    },
    {
        title: '활동 현황',
        description: '편집 사용자, 세션, 동시 편집자 조회',
        icon: '👥',
        link: '/admin/sheets/activity',
        color: '#06b6d4',
    },
    {
        title: 'API 사용량',
        description: 'API 연동량, 호출 성공/실패 지표',
        icon: '📈',
        link: '/admin/sheets/api-usage',
        color: '#3b82f6',
    },
];

export default function SheetsAdminPage() {
    const [stats, setStats] = useState({
        totalSheets: 0,
        activeSessions: 0,
        pendingApprovals: 0,
        lockedSheets: 0,
    });

    useEffect(() => {
        // Fetch stats from API
        const fetchStats = async () => {
            try {
                // These would be real API calls in production
                const spreadsheetsRes = await api.spreadsheets.listAdmin();
                setStats({
                    totalSheets: spreadsheetsRes?.length || 0,
                    activeSessions: 0,
                    pendingApprovals: 0,
                    lockedSheets: 0,
                });
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        };

        fetchStats();
    }, []);

    return (
        <>
            <AdminHeader title="시트 고급 관리" />
            <div className={styles.container}>
                {/* Stats Overview */}
                <section className={styles.statsSection}>
                    <StatCard
                        title="전체 시트"
                        value={stats.totalSheets}
                        icon="📄"
                        color="#3b82f6"
                    />
                    <StatCard
                        title="활성 세션"
                        value={stats.activeSessions}
                        icon="🟢"
                        color="#22c55e"
                        link="/admin/sheets/activity"
                    />
                    <StatCard
                        title="대기 중 승인"
                        value={stats.pendingApprovals}
                        icon="⏳"
                        color="#f97316"
                        link="/admin/sheets/udf"
                    />
                    <StatCard
                        title="잠긴 시트"
                        value={stats.lockedSheets}
                        icon="🔒"
                        color="#ef4444"
                        link="/admin/sheets/locks"
                    />
                </section>

                {/* Menu Grid */}
                <section className={styles.menuSection}>
                    <h2 className={styles.sectionTitle}>관리 메뉴</h2>
                    <div className={styles.menuGrid}>
                        {menuItems.map((item) => (
                            <Link key={item.link} href={item.link} className={styles.menuCard}>
                                <div className={styles.menuIcon} style={{ backgroundColor: item.color }}>
                                    {item.icon}
                                </div>
                                <div className={styles.menuContent}>
                                    <h3 className={styles.menuTitle}>{item.title}</h3>
                                    <p className={styles.menuDescription}>{item.description}</p>
                                </div>
                                <span className={styles.menuArrow}>→</span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}
