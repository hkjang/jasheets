'use client';

import Link from 'next/link';
import styles from '../styles/legal.module.css';

interface UpdateItem {
    version: string;
    date: string;
    title: string;
    description: string;
    features: string[];
    isNew?: boolean;
}

const updates: UpdateItem[] = [
    {
        version: 'v1.5.0',
        date: '2024년 12월',
        title: '차트 및 피벗 테이블 저장',
        description: '차트와 피벗 테이블을 시트와 함께 저장하고 불러올 수 있습니다.',
        features: [
            '차트 데이터 영구 저장',
            '피벗 테이블 설정 저장',
            '시트 로드 시 자동 복원',
        ],
        isNew: true,
    },
    {
        version: 'v1.4.0',
        date: '2024년 12월',
        title: '시트 임베드 기능',
        description: '생성한 시트를 다른 웹 서비스에 iframe으로 임베드할 수 있습니다.',
        features: [
            '임베드 URL 및 HTML 코드 생성',
            '읽기 전용 임베드 페이지',
            '공유 다이얼로그 통합',
        ],
    },
    {
        version: 'v1.3.0',
        date: '2024년 11월',
        title: '워크플로우 자동화',
        description: '셀 변경 시 자동으로 외부 서비스와 연동하는 워크플로우를 설정할 수 있습니다.',
        features: [
            '이벤트 기반 트리거',
            '웹훅 연동',
            '실행 로그 확인',
        ],
    },
    {
        version: 'v1.2.0',
        date: '2024년 11월',
        title: '조건부 서식',
        description: '셀 값에 따라 자동으로 서식을 적용하는 규칙을 설정할 수 있습니다.',
        features: [
            '색상 스케일',
            '데이터 막대',
            '아이콘 집합',
            '사용자 정의 규칙',
        ],
    },
    {
        version: 'v1.1.0',
        date: '2024년 10월',
        title: '협업 기능 개선',
        description: '실시간 협업 및 공유 기능이 강화되었습니다.',
        features: [
            '실시간 커서 표시',
            '댓글 및 멘션',
            '권한 세분화',
        ],
    },
    {
        version: 'v1.0.0',
        date: '2024년 10월',
        title: '정식 출시',
        description: 'JaSheets가 정식 출시되었습니다.',
        features: [
            '스프레드시트 기본 기능',
            '100+ 수식 함수 지원',
            '다중 시트 탭',
            'XLSX/CSV/PDF 내보내기',
        ],
    },
];

export default function UpdatesPage() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <h1 className={styles.title}>업데이트 및 새 기능</h1>
                    <p className={styles.subtitle}>JaSheets의 최신 업데이트와 새로운 기능을 확인하세요</p>
                </header>

                <div className={styles.section}>
                    {updates.map((update, index) => (
                        <div key={index} className={styles.updateCard}>
                            <div className={styles.updateHeader}>
                                <span className={styles.updateVersion}>{update.version}</span>
                                <span className={styles.updateDate}>{update.date}</span>
                                {update.isNew && (
                                    <span className={`${styles.badge} ${styles.badgeNew}`}>NEW</span>
                                )}
                            </div>
                            <h3 className={styles.updateTitle}>{update.title}</h3>
                            <p className={styles.updateDescription}>{update.description}</p>
                            <ul className={styles.updateFeatures}>
                                {update.features.map((feature, fIndex) => (
                                    <li key={fIndex}>{feature}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <footer className={styles.footer}>
                    <Link href="/dashboard" className={styles.backLink}>
                        ← 대시보드로 돌아가기
                    </Link>
                </footer>
            </div>
        </div>
    );
}
