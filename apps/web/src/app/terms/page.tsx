import Link from 'next/link';
import styles from '../styles/legal.module.css';

export const metadata = {
    title: '서비스 약관 - JaSheets',
    description: 'JaSheets 서비스 이용약관',
};

export default function TermsPage() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <h1 className={styles.title}>서비스 약관</h1>
                    <p className={styles.lastUpdated}>최종 수정일: 2024년 12월 1일</p>
                </header>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제1조 (목적)</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            이 약관은 JaSheets(이하 "서비스")가 제공하는 웹 스프레드시트 서비스의 이용 조건 및 절차,
                            회사와 이용자의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제2조 (정의)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li><strong>"서비스"</strong>란 회사가 운영하는 웹 스프레드시트 플랫폼 및 관련 제반 서비스를 의미합니다.</li>
                            <li><strong>"회원"</strong>이란 서비스에 가입하여 본 약관에 따라 회사와 이용계약을 체결한 자를 말합니다.</li>
                            <li><strong>"콘텐츠"</strong>란 회원이 서비스를 통해 생성, 저장, 공유하는 스프레드시트 및 관련 데이터를 말합니다.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제3조 (약관의 효력 및 변경)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력을 발생합니다.</li>
                            <li>회사는 필요하다고 인정되는 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.</li>
                            <li>약관 변경 시 시행일자 7일 전부터 서비스 내 공지사항을 통해 고지하며,
                                회원에게 불리한 변경의 경우 30일 전부터 고지합니다.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제4조 (서비스의 제공)</h2>
                    <div className={styles.sectionContent}>
                        <p>회사는 다음과 같은 서비스를 제공합니다.</p>
                        <ul>
                            <li>웹 기반 스프레드시트 생성, 편집, 저장 기능</li>
                            <li>스프레드시트 공유 및 협업 기능</li>
                            <li>데이터 가져오기/내보내기 기능</li>
                            <li>차트, 피벗 테이블 등 데이터 시각화 기능</li>
                            <li>워크플로우 자동화 기능</li>
                            <li>기타 회사가 정하는 서비스</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제5조 (회원가입 및 계정)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</li>
                            <li>회원은 등록한 계정 정보를 최신 상태로 유지해야 하며, 계정 보안 관리 책임은 회원에게 있습니다.</li>
                            <li>회원은 자신의 계정을 타인에게 양도하거나 대여할 수 없습니다.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제6조 (회원의 의무)</h2>
                    <div className={styles.sectionContent}>
                        <p>회원은 다음 행위를 하여서는 안 됩니다.</p>
                        <ul>
                            <li>타인의 개인정보를 부정하게 사용하는 행위</li>
                            <li>서비스 운영을 방해하거나 방해할 목적으로 시도하는 행위</li>
                            <li>서비스를 통해 음란, 혐오, 불법적인 콘텐츠를 생성 또는 배포하는 행위</li>
                            <li>다른 회원 또는 제3자의 권리를 침해하는 행위</li>
                            <li>관계 법령 및 본 약관을 위반하는 행위</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제7조 (콘텐츠의 소유권)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>회원이 서비스를 통해 생성한 콘텐츠의 저작권은 해당 회원에게 귀속됩니다.</li>
                            <li>회사는 서비스 제공에 필요한 범위 내에서만 회원의 콘텐츠를 저장 및 처리합니다.</li>
                            <li>회원이 콘텐츠를 공개적으로 공유할 경우, 해당 콘텐츠에 대한 접근 권한 관리 책임은 회원에게 있습니다.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제8조 (서비스 이용 제한)</h2>
                    <div className={styles.sectionContent}>
                        <p>회사는 다음의 경우 회원의 서비스 이용을 제한하거나 정지할 수 있습니다.</p>
                        <ul>
                            <li>본 약관을 위반한 경우</li>
                            <li>서비스 운영을 고의로 방해한 경우</li>
                            <li>관련 법령을 위반한 경우</li>
                            <li>기타 합리적인 사유가 있는 경우</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제9조 (면책 조항)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>회사는 천재지변, 전쟁 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
                            <li>회사는 회원의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
                            <li>회사는 회원이 서비스 내에서 기대하는 특정 결과나 수익에 대해 보장하지 않습니다.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>제10조 (분쟁 해결)</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>본 약관에 관한 분쟁은 대한민국 법령을 준거법으로 합니다.</li>
                            <li>서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우, 회사 본사 소재지 관할 법원을 전속관할법원으로 합니다.</li>
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
