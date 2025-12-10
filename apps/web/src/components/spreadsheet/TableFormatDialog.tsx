'use client';

import { useState, useMemo } from 'react';
import styles from './TableFormatDialog.module.css';
import { CellRange } from '@/types/spreadsheet';

// 프리셋 테이블 스타일 정의
export interface TablePreset {
    id: string;
    name: string;
    headerBg: string;
    headerColor: string;
    headerBold: boolean;
    oddRowBg: string;
    evenRowBg: string;
    textColor: string;
    borderColor: string;
}

export const TABLE_PRESETS: TablePreset[] = [
    {
        id: 'blue',
        name: '블루',
        headerBg: '#4285f4',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#e8f0fe',
        textColor: '#202124',
        borderColor: '#c6dafc',
    },
    {
        id: 'green',
        name: '그린',
        headerBg: '#34a853',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#e6f4ea',
        textColor: '#202124',
        borderColor: '#b7e1cd',
    },
    {
        id: 'orange',
        name: '오렌지',
        headerBg: '#fa7b17',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#fef3e6',
        textColor: '#202124',
        borderColor: '#fad2a8',
    },
    {
        id: 'purple',
        name: '퍼플',
        headerBg: '#9334e6',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#f3e8fd',
        textColor: '#202124',
        borderColor: '#d7b0f9',
    },
    {
        id: 'gray',
        name: '그레이',
        headerBg: '#5f6368',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#f1f3f4',
        textColor: '#202124',
        borderColor: '#dadce0',
    },
    {
        id: 'teal',
        name: '틸',
        headerBg: '#009688',
        headerColor: '#ffffff',
        headerBold: true,
        oddRowBg: '#ffffff',
        evenRowBg: '#e0f2f1',
        textColor: '#202124',
        borderColor: '#80cbc4',
    },
];

interface TableFormatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (config: TableFormatConfig) => void;
    selection: CellRange | null;
}

export interface TableFormatConfig {
    preset: TablePreset;
    hasHeader: boolean;
    alternatingColors: boolean;
    customOddColor?: string;
    customEvenColor?: string;
}

export default function TableFormatDialog({
    isOpen,
    onClose,
    onApply,
    selection,
}: TableFormatDialogProps) {
    const [selectedPreset, setSelectedPreset] = useState<TablePreset>(TABLE_PRESETS[0]);
    const [hasHeader, setHasHeader] = useState(true);
    const [alternatingColors, setAlternatingColors] = useState(true);
    const [customOddColor, setCustomOddColor] = useState('#ffffff');
    const [customEvenColor, setCustomEvenColor] = useState('#f3f3f3');

    const handleApply = () => {
        onApply({
            preset: selectedPreset,
            hasHeader,
            alternatingColors,
            customOddColor: customOddColor !== '#ffffff' ? customOddColor : undefined,
            customEvenColor: customEvenColor !== '#f3f3f3' ? customEvenColor : undefined,
        });
        onClose();
    };

    // 프리뷰 테이블 데이터
    const previewData = useMemo(() => {
        return [
            ['이름', '부서', '직급'],
            ['홍길동', '개발팀', '선임'],
            ['김영희', '디자인팀', '책임'],
            ['이철수', '기획팀', '선임'],
        ];
    }, []);

    const getRowStyle = (rowIndex: number): React.CSSProperties => {
        if (hasHeader && rowIndex === 0) {
            return {
                backgroundColor: selectedPreset.headerBg,
                color: selectedPreset.headerColor,
                fontWeight: selectedPreset.headerBold ? 'bold' : 'normal',
            };
        }

        const dataRowIndex = hasHeader ? rowIndex - 1 : rowIndex;
        const isEven = dataRowIndex % 2 === 1;

        if (alternatingColors) {
            return {
                backgroundColor: isEven ? selectedPreset.evenRowBg : selectedPreset.oddRowBg,
                color: selectedPreset.textColor,
            };
        }

        return {
            backgroundColor: selectedPreset.oddRowBg,
            color: selectedPreset.textColor,
        };
    };

    if (!isOpen) return null;

    const rangeText = selection
        ? `${String.fromCharCode(65 + selection.start.col)}${selection.start.row + 1}:${String.fromCharCode(65 + selection.end.col)}${selection.end.row + 1}`
        : '선택 없음';

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <h3 className={styles.title}>테이블 서식</h3>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>적용 범위: {rangeText}</div>
                </div>

                {/* 프리셋 선택 */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>스타일 선택</div>
                    <div className={styles.presetGrid}>
                        {TABLE_PRESETS.map(preset => (
                            <div
                                key={preset.id}
                                className={`${styles.presetCard} ${selectedPreset.id === preset.id ? styles.selected : ''}`}
                                onClick={() => setSelectedPreset(preset)}
                            >
                                <table className={styles.previewTable}>
                                    <tbody>
                                        <tr style={{ backgroundColor: preset.headerBg, color: preset.headerColor }}>
                                            <td colSpan={3}>헤더</td>
                                        </tr>
                                        <tr style={{ backgroundColor: preset.oddRowBg }}>
                                            <td colSpan={3}>행 1</td>
                                        </tr>
                                        <tr style={{ backgroundColor: preset.evenRowBg }}>
                                            <td colSpan={3}>행 2</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className={styles.presetName}>{preset.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 옵션 */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>옵션</div>
                    <div className={styles.optionsRow}>
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={hasHeader}
                                onChange={e => setHasHeader(e.target.checked)}
                            />
                            첫 행을 헤더로 사용
                        </label>
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={alternatingColors}
                                onChange={e => setAlternatingColors(e.target.checked)}
                            />
                            교차 행 색상
                        </label>
                    </div>
                </div>

                {/* 라이브 프리뷰 */}
                <div className={styles.previewSection}>
                    <div className={styles.previewLabel}>미리보기</div>
                    <table className={styles.livePreview}>
                        <tbody>
                            {previewData.map((row, rowIndex) => (
                                <tr key={rowIndex} style={getRowStyle(rowIndex)}>
                                    {row.map((cell, colIndex) => (
                                        hasHeader && rowIndex === 0
                                            ? <th key={colIndex} style={{ borderColor: selectedPreset.borderColor }}>{cell}</th>
                                            : <td key={colIndex} style={{ borderColor: selectedPreset.borderColor }}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 액션 버튼 */}
                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        취소
                    </button>
                    <button
                        className={styles.applyBtn}
                        onClick={handleApply}
                        disabled={!selection}
                    >
                        적용
                    </button>
                </div>
            </div>
        </div>
    );
}
