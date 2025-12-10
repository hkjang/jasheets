'use client';

import { useState } from 'react';
import styles from './ThemeDialog.module.css';

export interface ThemeColors {
    headerBg: string;
    headerText: string;
    evenRowBg: string;
    oddRowBg: string;
    borderColor: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
}

// Preset themes - inspired by Google Sheets and Excel themes
export const PRESET_THEMES: Theme[] = [
    {
        id: 'blue',
        name: '블루',
        colors: {
            headerBg: '#4285f4',
            headerText: '#ffffff',
            evenRowBg: '#e8f0fe',
            oddRowBg: '#ffffff',
            borderColor: '#c6dafc',
        },
    },
    {
        id: 'green',
        name: '그린',
        colors: {
            headerBg: '#34a853',
            headerText: '#ffffff',
            evenRowBg: '#e6f4ea',
            oddRowBg: '#ffffff',
            borderColor: '#ceead6',
        },
    },
    {
        id: 'orange',
        name: '오렌지',
        colors: {
            headerBg: '#fa7b17',
            headerText: '#ffffff',
            evenRowBg: '#fef3e6',
            oddRowBg: '#ffffff',
            borderColor: '#fce8cf',
        },
    },
    {
        id: 'purple',
        name: '퍼플',
        colors: {
            headerBg: '#a142f4',
            headerText: '#ffffff',
            evenRowBg: '#f3e8fd',
            oddRowBg: '#ffffff',
            borderColor: '#e4ccfa',
        },
    },
    {
        id: 'red',
        name: '레드',
        colors: {
            headerBg: '#ea4335',
            headerText: '#ffffff',
            evenRowBg: '#fce8e6',
            oddRowBg: '#ffffff',
            borderColor: '#f8d4d0',
        },
    },
    {
        id: 'teal',
        name: '청록',
        colors: {
            headerBg: '#00897b',
            headerText: '#ffffff',
            evenRowBg: '#e0f2f1',
            oddRowBg: '#ffffff',
            borderColor: '#b2dfdb',
        },
    },
    {
        id: 'dark',
        name: '다크',
        colors: {
            headerBg: '#3c4043',
            headerText: '#ffffff',
            evenRowBg: '#f1f3f4',
            oddRowBg: '#ffffff',
            borderColor: '#dadce0',
        },
    },
    {
        id: 'yellow',
        name: '옐로우',
        colors: {
            headerBg: '#fbbc04',
            headerText: '#202124',
            evenRowBg: '#fef7e0',
            oddRowBg: '#ffffff',
            borderColor: '#fef0c7',
        },
    },
    {
        id: 'pink',
        name: '핑크',
        colors: {
            headerBg: '#e91e63',
            headerText: '#ffffff',
            evenRowBg: '#fce4ec',
            oddRowBg: '#ffffff',
            borderColor: '#f8bbd9',
        },
    },
];

interface ThemeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (theme: Theme) => void;
}

export default function ThemeDialog({ isOpen, onClose, onApply }: ThemeDialogProps) {
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

    if (!isOpen) return null;

    const handleApply = () => {
        if (selectedTheme) {
            onApply(selectedTheme);
            onClose();
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.dialog}>
                <div className={styles.header}>
                    <h2>테마 선택</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </button>
                </div>

                <div className={styles.content}>
                    <p className={styles.description}>
                        선택한 셀 범위에 적용할 테마를 선택하세요. 첫 번째 행은 헤더 스타일이 적용되고, 나머지 행은 교차 색상이 적용됩니다.
                    </p>

                    <div className={styles.themeGrid}>
                        {PRESET_THEMES.map((theme) => (
                            <div
                                key={theme.id}
                                className={`${styles.themeCard} ${selectedTheme?.id === theme.id ? styles.selected : ''}`}
                                onClick={() => setSelectedTheme(theme)}
                            >
                                <div className={styles.themeName}>{theme.name}</div>
                                <div className={styles.themePreview}>
                                    {/* Header row */}
                                    <div className={styles.previewRow}>
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.headerBg }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.headerBg }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.headerBg }} />
                                    </div>
                                    {/* Alternating rows */}
                                    <div className={styles.previewRow}>
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                    </div>
                                    <div className={styles.previewRow}>
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.evenRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.evenRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.evenRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                    </div>
                                    <div className={styles.previewRow}>
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                        <div className={styles.previewCell} style={{ backgroundColor: theme.colors.oddRowBg, border: `1px solid ${theme.colors.borderColor}` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        취소
                    </button>
                    <button
                        className={styles.applyButton}
                        onClick={handleApply}
                        disabled={!selectedTheme}
                    >
                        적용
                    </button>
                </div>
            </div>
        </div>
    );
}
