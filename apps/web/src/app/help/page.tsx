'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import styles from '../styles/legal.module.css';

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

const faqData: FAQItem[] = [
    // 기본 사용법
    {
        category: '기본 사용법',
        question: '새 스프레드시트를 어떻게 만드나요?',
        answer: '대시보드에서 "새 스프레드시트 만들기" 버튼을 클릭하거나, 기존 시트에서 파일 메뉴 > 새 문서를 선택하세요.',
    },
    {
        category: '기본 사용법',
        question: '시트를 저장하는 방법은?',
        answer: 'Ctrl+S 단축키를 사용하거나, 파일 메뉴 > 저장을 클릭하세요. 변경사항은 자동으로 저장됩니다.',
    },
    {
        category: '기본 사용법',
        question: '여러 시트 탭을 관리하려면 어떻게 하나요?',
        answer: '화면 하단의 시트 탭 영역에서 + 버튼으로 새 시트를 추가하고, 탭을 우클릭하여 이름 변경, 복제, 삭제 등의 작업을 할 수 있습니다.',
    },
    // 수식 및 함수
    {
        category: '수식 및 함수',
        question: '어떤 수식 함수를 지원하나요?',
        answer: 'SUM, AVERAGE, COUNT, IF, VLOOKUP, HLOOKUP 등 100개 이상의 함수를 지원합니다. 수식 입력란에 = 를 입력하면 사용 가능한 함수 목록이 표시됩니다.',
    },
    {
        category: '수식 및 함수',
        question: '수식 자동완성 기능을 사용하려면?',
        answer: '셀에 = 를 입력한 후 함수 이름을 타이핑하면 자동완성 드롭다운이 나타납니다. Tab 또는 Enter로 선택할 수 있습니다.',
    },
    {
        category: '수식 및 함수',
        question: '셀 참조 방식에는 어떤 것이 있나요?',
        answer: '상대 참조(A1), 절대 참조($A$1), 혼합 참조($A1, A$1)를 지원합니다. F4 키로 참조 방식을 빠르게 전환할 수 있습니다.',
    },
    // 공유 및 협업
    {
        category: '공유 및 협업',
        question: '다른 사용자와 시트를 공유하려면?',
        answer: '툴바의 공유 버튼을 클릭하여 이메일 주소를 입력하거나 공유 링크를 생성할 수 있습니다. 보기 전용 또는 편집 권한을 설정할 수 있습니다.',
    },
    {
        category: '공유 및 협업',
        question: '시트를 웹에 임베드할 수 있나요?',
        answer: '공유 설정에서 "임베드" 탭을 선택하면 iframe 코드를 생성할 수 있습니다. 이 코드를 웹페이지에 삽입하면 시트가 표시됩니다.',
    },
    // 데이터 관리
    {
        category: '데이터 관리',
        question: '엑셀 파일을 가져올 수 있나요?',
        answer: '파일 메뉴 > 가져오기에서 .xlsx, .xls, .csv 파일을 업로드할 수 있습니다.',
    },
    {
        category: '데이터 관리',
        question: '데이터를 필터링하려면?',
        answer: '데이터 메뉴 > 필터를 선택하거나 툴바의 필터 아이콘을 클릭하세요. 각 열 헤더에 필터 드롭다운이 나타납니다.',
    },
    {
        category: '데이터 관리',
        question: '차트를 만들려면 어떻게 하나요?',
        answer: '데이터를 선택한 후 삽입 메뉴 > 차트를 선택하세요. 막대, 선, 파이 등 다양한 차트 유형을 지원합니다.',
    },
    // 단축키
    {
        category: '단축키',
        question: '주요 단축키는 무엇인가요?',
        answer: 'Ctrl+C/V/X(복사/붙여넣기/잘라내기), Ctrl+Z/Y(실행취소/재실행), Ctrl+B/I/U(굵게/기울임/밑줄), Ctrl+F(찾기) 등이 있습니다. 도움말 > 단축키에서 전체 목록을 확인하세요.',
    },
];

const categories = ['전체', ...Array.from(new Set(faqData.map(item => item.category)))];

export default function HelpPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('전체');
    const [openItems, setOpenItems] = useState<Set<number>>(new Set());

    const filteredFAQ = useMemo(() => {
        return faqData.filter(item => {
            const matchesCategory = activeCategory === '전체' || item.category === activeCategory;
            const matchesSearch = searchQuery === '' ||
                item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.answer.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [searchQuery, activeCategory]);

    const toggleItem = (index: number) => {
        const newOpenItems = new Set(openItems);
        if (newOpenItems.has(index)) {
            newOpenItems.delete(index);
        } else {
            newOpenItems.add(index);
        }
        setOpenItems(newOpenItems);
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <h1 className={styles.title}>도움말 센터</h1>
                    <p className={styles.subtitle}>JaSheets 사용에 관한 자주 묻는 질문과 답변을 확인하세요</p>
                </header>

                <div className={styles.searchBox}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="궁금한 내용을 검색하세요..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.categories}>
                    {categories.map(category => (
                        <button
                            key={category}
                            className={`${styles.categoryPill} ${activeCategory === category ? styles.active : ''}`}
                            onClick={() => setActiveCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className={styles.section}>
                    {filteredFAQ.length > 0 ? (
                        filteredFAQ.map((item, index) => (
                            <div key={index} className={styles.faqItem}>
                                <button
                                    className={styles.faqQuestion}
                                    onClick={() => toggleItem(index)}
                                >
                                    <span>{item.question}</span>
                                    <span className={`${styles.faqIcon} ${openItems.has(index) ? styles.open : ''}`}>
                                        ▼
                                    </span>
                                </button>
                                {openItems.has(index) && (
                                    <div className={styles.faqAnswer}>
                                        {item.answer}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className={styles.noResults}>
                            <h3>검색 결과가 없습니다</h3>
                            <p>다른 검색어를 시도하거나 카테고리를 변경해보세요.</p>
                        </div>
                    )}
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
