import Link from 'next/link';
import styles from '../styles/legal.module.css';

export const metadata = {
    title: '개인정보처리방침 - JaSheets',
    description: 'JaSheets 개인정보 수집 및 이용에 관한 방침',
};

export default function PrivacyPage() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <h1 className={styles.title}>개인정보처리방침</h1>
                    <p className={styles.lastUpdated}>최종 수정일: 2024년 12월 1일</p>
                </header>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. 개인정보의 수집 및 이용 목적</h2>
                    <div className={styles.sectionContent}>
                        <p>JaSheets(이하 "서비스")는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
                        <ul>
                            <li><strong>서비스 제공:</strong> 스프레드시트 생성, 편집, 저장, 공유 등 핵심 서비스 제공</li>
                            <li><strong>회원 관리:</strong> 회원제 서비스 이용에 따른 본인확인, 개인식별, 불량회원 부정이용 방지</li>
                            <li><strong>서비스 개선:</strong> 신규 서비스 개발 및 서비스 품질 향상을 위한 통계 분석</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. 수집하는 개인정보 항목</h2>
                    <div className={styles.sectionContent}>
                        <p>서비스는 다음과 같은 개인정보를 수집합니다.</p>
                        <ul>
                            <li><strong>필수 항목:</strong> 이메일 주소, 비밀번호, 이름</li>
                            <li><strong>자동 수집 항목:</strong> IP 주소, 쿠키, 방문 일시, 서비스 이용 기록, 기기 정보</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. 개인정보의 보유 및 이용 기간</h2>
                    <div className={styles.sectionContent}>
                        <p>회원의 개인정보는 원칙적으로 회원 탈퇴 시까지 보유합니다. 단, 다음의 경우에는 해당 기간 종료 시까지 보유합니다.</p>
                        <ul>
                            <li>관계 법령 위반에 따른 수사, 조사 등이 진행 중인 경우: 해당 수사, 조사 종료 시까지</li>
                            <li>전자상거래 등에서의 소비자보호에 관한 법률에 따른 보유: 계약 또는 청약철회 기록 5년</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. 개인정보의 제3자 제공</h2>
                    <div className={styles.sectionContent}>
                        <p>서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
                        <ul>
                            <li>이용자가 사전에 동의한 경우</li>
                            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. 개인정보의 파기</h2>
                    <div className={styles.sectionContent}>
                        <p>서비스는 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</p>
                        <ul>
                            <li><strong>전자적 파일:</strong> 복구 및 재생이 되지 않도록 기술적 방법을 이용하여 안전하게 삭제</li>
                            <li><strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>6. 이용자의 권리와 행사 방법</h2>
                    <div className={styles.sectionContent}>
                        <p>이용자는 언제든지 다음과 같은 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
                        <ul>
                            <li>개인정보 열람 요청</li>
                            <li>개인정보 정정 요청</li>
                            <li>개인정보 삭제 요청</li>
                            <li>개인정보 처리 정지 요청</li>
                        </ul>
                        <p>위 권리 행사는 서비스 설정 페이지 또는 고객센터를 통해 하실 수 있습니다.</p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>7. 개인정보 보호책임자</h2>
                    <div className={styles.sectionContent}>
                        <p>개인정보 처리에 관한 업무를 총괄하고 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                        <ul>
                            <li><strong>담당부서:</strong> 개인정보보호팀</li>
                            <li><strong>이메일:</strong> privacy@jasheets.com</li>
                        </ul>
                    </div>
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
