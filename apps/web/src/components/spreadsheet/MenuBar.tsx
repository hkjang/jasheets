'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './MenuBar.module.css';

interface MenuBarProps {
  onExportCSV: () => void;
  onPrint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onFind: () => void;
  onShowShortcuts: () => void;
  onVersionHistory: () => void;
  onInsertRow: () => void;
  onInsertCol: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onFreezeRow: () => void;
  onFreezeCol: () => void;
  onFilter: () => void;
  onSort: () => void;
  onToggleFormulaBar: () => void;
  onToggleGridlines: () => void;
  onDownloadXLSX: () => void;
  onDownloadPDF: () => void;
  onMakeCopy: () => void;
  onEmail: () => void;
  onSave?: () => void;
  onOpenFile?: () => void;
  title?: string;
  onTitleChange?: (newTitle: string) => void;
  // New props for enhanced functionality
  onInsertChart?: () => void;
  onInsertPivot?: () => void;
  onConditionalFormat?: () => void;
  onInsertLink?: () => void;
  onUnfreeze?: () => void;
  onZoomChange?: (zoom: number) => void;
  onTrimWhitespace?: () => void;
  onFormatNumber?: (format: string) => void;
  onTableFormat?: () => void;
  onTheme?: () => void;
  onSortRangeAsc?: () => void;
  onSortRangeDesc?: () => void;
  onRemoveDuplicates?: () => void;
  onSplitTextToColumns?: () => void;
  onDataValidation?: () => void;
  onNamedRanges?: () => void;
  onProtectedRanges?: () => void;
  // AI & Tools menu props
  onSheetBuilder?: () => void;
  onProfiler?: () => void;
  onNormalizer?: () => void;
  onUDFEditor?: () => void;
  onDocumentation?: () => void;
  showFormulaBar?: boolean;
  showGridlines?: boolean;
  zoom?: number;
}

export default function MenuBar({
  onExportCSV,
  onPrint,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onShowShortcuts,
  onVersionHistory,
  onInsertRow,
  onInsertCol,
  onDeleteRow,
  onDeleteCol,
  onFreezeRow,
  onFreezeCol,
  onFilter,
  onSort,
  onToggleFormulaBar,
  onToggleGridlines,
  onDownloadXLSX,
  onDownloadPDF,
  onMakeCopy,
  onEmail,
  onSave,
  onOpenFile,
  title,
  onTitleChange,
  onInsertChart,
  onInsertPivot,
  onConditionalFormat,
  onInsertLink,
  onUnfreeze,
  onZoomChange,
  onTrimWhitespace,
  onFormatNumber,
  onTableFormat,
  onTheme,
  onSortRangeAsc,
  onSortRangeDesc,
  onRemoveDuplicates,
  onSplitTextToColumns,
  onDataValidation,
  onNamedRanges,
  onProtectedRanges,
  onSheetBuilder,
  onProfiler,
  onNormalizer,
  onUDFEditor,
  onDocumentation,
  showFormulaBar = true,
  showGridlines = true,
  zoom = 100,
}: MenuBarProps) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMouseEnter = (menu: string) => {
    if (activeMenu) {
      setActiveMenu(menu);
    }
  };

  const MenuItem = ({ label, onClick, shortcut }: { label: string; onClick?: () => void; shortcut?: string }) => (
    <div
      className={styles.menuItem}
      onClick={() => {
        onClick?.();
        setActiveMenu(null);
      }}
    >
      <span className={styles.menuLabel}>{label}</span>
      {shortcut && <span className={styles.menuShortcut}>{shortcut}</span>}
    </div>
  );

  const Separator = () => <div className={styles.separator} />;

  return (
    <div className={styles.container} ref={menuRef}>
      <div className={styles.leftSection}>
        <Link href="/dashboard" className={styles.logo} title="대시보드로 이동">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f9d58">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
        </Link>
        <div className={styles.titleContainer}>
          <input
            type="text"
            value={title || 'Untitled Spreadsheet'}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className={styles.titleInput}
            placeholder="제목 없는 스프레드시트"
          />
        </div>
      </div>

      <div className={styles.menus}>
        {/* FILE MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'file' ? styles.active : ''}`}
            onClick={() => handleMenuClick('file')}
            onMouseEnter={() => handleMouseEnter('file')}
          >
            파일
          </button>
          {activeMenu === 'file' && (
            <div className={styles.dropdown}>
              <MenuItem label="새 문서" onClick={() => window.open('/', '_blank')} />
              <MenuItem label="열기" onClick={onOpenFile} shortcut="Ctrl+O" />
              <MenuItem label="가져오기" onClick={onOpenFile} />
              <MenuItem label="저장" onClick={onSave} shortcut="Ctrl+S" />
              <MenuItem label="사본 만들기" onClick={onMakeCopy} />
              <Separator />
              <MenuItem label="공유" onClick={() => alert('공유 기능은 툴바의 공유 버튼을 이용해주세요.')} />
              <MenuItem label="이메일로 보내기" onClick={onEmail} />
              <Separator />
              <MenuItem label="다운로드 (CSV)" onClick={onExportCSV} />
              <MenuItem label="다운로드 (XLSX)" onClick={onDownloadXLSX} />
              <MenuItem label="다운로드 (PDF)" onClick={onDownloadPDF} />
              <Separator />
              <MenuItem label="버전 기록" onClick={onVersionHistory} />
              <Separator />
              <MenuItem label="인쇄" onClick={onPrint} shortcut="Ctrl+P" />
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'edit' ? styles.active : ''}`}
            onClick={() => handleMenuClick('edit')}
            onMouseEnter={() => handleMouseEnter('edit')}
          >
            수정
          </button>
          {activeMenu === 'edit' && (
            <div className={styles.dropdown}>
              <MenuItem label="실행 취소" onClick={onUndo} shortcut="Ctrl+Z" />
              <MenuItem label="재실행" onClick={onRedo} shortcut="Ctrl+Y" />
              <Separator />
              <MenuItem label="오려두기" onClick={onCut} shortcut="Ctrl+X" />
              <MenuItem label="복사" onClick={onCopy} shortcut="Ctrl+C" />
              <MenuItem label="붙여넣기" onClick={onPaste} shortcut="Ctrl+V" />
              <Separator />
              <MenuItem label="찾기 및 바꾸기" onClick={onFind} shortcut="Ctrl+F" />
              <Separator />
              <MenuItem label="행 삭제" onClick={onDeleteRow} />
              <MenuItem label="열 삭제" onClick={onDeleteCol} />
            </div>
          )}
        </div>

        {/* INSERT MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'insert' ? styles.active : ''}`}
            onClick={() => handleMenuClick('insert')}
            onMouseEnter={() => handleMouseEnter('insert')}
          >
            삽입
          </button>
          {activeMenu === 'insert' && (
            <div className={styles.dropdown}>
              <MenuItem label="행 (위쪽)" onClick={onInsertRow} />
              <MenuItem label="행 (아래쪽)" onClick={onInsertRow} />
              <MenuItem label="열 (왼쪽)" onClick={onInsertCol} />
              <MenuItem label="열 (오른쪽)" onClick={onInsertCol} />
              <Separator />
              <MenuItem label="차트" onClick={onInsertChart} />
              <MenuItem label="피벗 테이블" onClick={onInsertPivot} />
              <MenuItem label="이미지" onClick={() => alert('이미지 삽입은 아직 지원하지 않습니다.')} />
              <MenuItem label="링크" onClick={onInsertLink} shortcut="Ctrl+K" />
            </div>
          )}
        </div>

        {/* VIEW MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'view' ? styles.active : ''}`}
            onClick={() => handleMenuClick('view')}
            onMouseEnter={() => handleMouseEnter('view')}
          >
            보기
          </button>
          {activeMenu === 'view' && (
            <div className={styles.dropdown}>
              <MenuItem label="표시 > 수식바" onClick={onToggleFormulaBar} shortcut={showFormulaBar ? '✓' : ''} />
              <MenuItem label="표시 > 격자선" onClick={onToggleGridlines} shortcut={showGridlines ? '✓' : ''} />
              <Separator />
              <MenuItem label="고정 > 행 1개" onClick={onFreezeRow} />
              <MenuItem label="고정 > 열 1개" onClick={onFreezeCol} />
              <MenuItem label="고정 없음" onClick={onUnfreeze} />
              <Separator />
              <div className={styles.submenu}>
                <span className={styles.menuLabel}>확대/축소 ({zoom}%)</span>
                <div className={styles.submenuDropdown}>
                  <MenuItem label="50%" onClick={() => onZoomChange?.(50)} />
                  <MenuItem label="75%" onClick={() => onZoomChange?.(75)} />
                  <MenuItem label="100%" onClick={() => onZoomChange?.(100)} shortcut={zoom === 100 ? '✓' : ''} />
                  <MenuItem label="125%" onClick={() => onZoomChange?.(125)} />
                  <MenuItem label="150%" onClick={() => onZoomChange?.(150)} />
                  <MenuItem label="200%" onClick={() => onZoomChange?.(200)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FORMAT MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'format' ? styles.active : ''}`}
            onClick={() => handleMenuClick('format')}
            onMouseEnter={() => handleMouseEnter('format')}
          >
            서식
          </button>
          {activeMenu === 'format' && (
            <div className={styles.dropdown}>
              <MenuItem label="테마" onClick={onTheme} />
              <div className={styles.submenu}>
                <span className={styles.menuLabel}>숫자 형식</span>
                <div className={styles.submenuDropdown}>
                  <MenuItem label="자동" onClick={() => onFormatNumber?.('general')} />
                  <MenuItem label="일반 숫자" onClick={() => onFormatNumber?.('number')} />
                  <MenuItem label="통화" onClick={() => onFormatNumber?.('currency')} />
                  <MenuItem label="퍼센트" onClick={() => onFormatNumber?.('percent')} />
                  <MenuItem label="날짜" onClick={() => onFormatNumber?.('date')} />
                  <MenuItem label="시간" onClick={() => onFormatNumber?.('time')} />
                </div>
              </div>
              <MenuItem label="텍스트" onClick={() => onFormatNumber?.('text')} />
              <Separator />
              <MenuItem label="테이블 서식" onClick={onTableFormat} />
              <MenuItem label="조건부 서식" onClick={onConditionalFormat} />
            </div>
          )}
        </div>

        {/* DATA MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'data' ? styles.active : ''}`}
            onClick={() => handleMenuClick('data')}
            onMouseEnter={() => handleMouseEnter('data')}
          >
            데이터
          </button>
          {activeMenu === 'data' && (
            <div className={styles.dropdown}>
              <MenuItem label="시트 정렬 (A-Z)" onClick={onSort} />
              <MenuItem label="시트 정렬 (Z-A)" onClick={onSort} />
              <Separator />
              <MenuItem label="범위 정렬 (A-Z)" onClick={onSortRangeAsc} />
              <MenuItem label="범위 정렬 (Z-A)" onClick={onSortRangeDesc} />
              <Separator />
              <MenuItem label="필터 만들기" onClick={onFilter} />
              <MenuItem label="필터 뷰" onClick={() => alert('필터 뷰 기능은 준비 중입니다.')} />
              <Separator />
              <MenuItem label="데이터 정리 > 중복 항목 삭제" onClick={onRemoveDuplicates} />
              <MenuItem label="데이터 정리 > 공백 제거" onClick={onTrimWhitespace} />
              <Separator />
              <MenuItem label="텍스트를 열로 나누기" onClick={onSplitTextToColumns} />
              <Separator />
              <MenuItem label="데이터 확인" onClick={onDataValidation} />
              <MenuItem label="이름이 지정된 범위" onClick={onNamedRanges} />
              <MenuItem label="보호된 시트 및 범위" onClick={onProtectedRanges} />
            </div>
          )}
        </div>

        {/* TOOLS MENU - AI & Advanced Features */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'tools' ? styles.active : ''}`}
            onClick={() => handleMenuClick('tools')}
            onMouseEnter={() => handleMouseEnter('tools')}
          >
            도구
          </button>
          {activeMenu === 'tools' && (
            <div className={styles.dropdown}>
              <MenuItem label="✨ AI 시트 생성" onClick={onSheetBuilder} />
              <MenuItem label="📊 데이터 프로파일러" onClick={onProfiler} />
              <Separator />
              <MenuItem label="🔄 데이터 정규화" onClick={onNormalizer} />
              <MenuItem label="📄 자동 문서화" onClick={onDocumentation} />
              <Separator />
              <MenuItem label="⚡ 사용자 정의 함수" onClick={onUDFEditor} />
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className={styles.menuWrapper}>
          <button
            className={`${styles.menuButton} ${activeMenu === 'help' ? styles.active : ''}`}
            onClick={() => handleMenuClick('help')}
            onMouseEnter={() => handleMouseEnter('help')}
          >
            도움말
          </button>
          {activeMenu === 'help' && (
            <div className={styles.dropdown}>
              <MenuItem label="도움말 검색" onClick={() => window.open('/help', '_blank')} />
              <MenuItem label="단축키" onClick={onShowShortcuts} shortcut="Ctrl+/" />
              <Separator />
              <MenuItem label="업데이트 및 새 기능" onClick={() => window.open('/updates', '_blank')} />
              <Separator />
              <MenuItem label="개인정보처리방침" onClick={() => window.open('/privacy', '_blank')} />
              <MenuItem label="서비스 약관" onClick={() => window.open('/terms', '_blank')} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
