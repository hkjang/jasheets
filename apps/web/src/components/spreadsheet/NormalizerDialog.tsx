'use client';

import { useState, useEffect } from 'react';
import styles from './NormalizerDialog.module.css';

interface NormalizationChange {
    row: number;
    col: number;
    original: any;
    normalized: any;
    type: string;
}

interface NormalizationResult {
    totalCells: number;
    normalizedCells: number;
    changes: NormalizationChange[];
    detectedTypes: Record<string, number>;
    normalizedData: any[][];
}

interface NormalizerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (normalizedData: any[][]) => void;
    data: any[][];
    apiUrl?: string;
}

export default function NormalizerDialog({
    isOpen,
    onClose,
    onApply,
    data,
    apiUrl = 'http://localhost:4000/api',
}: NormalizerDialogProps) {
    const [options, setOptions] = useState({
        normalizeDate: true,
        normalizeCurrency: true,
        normalizeNumbers: true,
        normalizeText: true,
        targetDateFormat: 'YYYY-MM-DD',
        targetCurrency: 'KRW',
    });
    const [result, setResult] = useState<NormalizationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(true);

    useEffect(() => {
        if (isOpen && data.length > 0) {
            previewNormalization();
        }
    }, [isOpen, options]);

    const previewNormalization = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Create a deep copy to avoid mutating original data
            const dataCopy = JSON.parse(JSON.stringify(data));

            const response = await fetch(`${apiUrl}/normalizer/normalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    data: dataCopy,
                    options,
                }),
            });

            if (response.ok) {
                const res = await response.json();
                setResult(res);
            }
        } catch (err) {
            console.error('Normalization preview failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (result?.normalizedData) {
            onApply(result.normalizedData);
            handleClose();
        }
    };

    const handleClose = () => {
        setResult(null);
        onClose();
    };

    const colToLetter = (col: number): string => {
        let result = '';
        let num = col + 1;
        while (num > 0) {
            const remainder = (num - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            num = Math.floor((num - 1) / 26);
        }
        return result;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>
                        <span>🔄</span>
                        데이터 정규화
                    </h2>
                    <button className={styles.closeBtn} onClick={handleClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.options}>
                        <div className={styles.option}>
                            <input
                                type="checkbox"
                                id="normalizeDate"
                                checked={options.normalizeDate}
                                onChange={(e) => setOptions({ ...options, normalizeDate: e.target.checked })}
                            />
                            <label htmlFor="normalizeDate">날짜 형식 통일</label>
                            <select
                                value={options.targetDateFormat}
                                onChange={(e) => setOptions({ ...options, targetDateFormat: e.target.value })}
                                disabled={!options.normalizeDate}
                            >
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                                <option value="YYYY년 MM월 DD일">YYYY년 MM월 DD일</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            </select>
                        </div>

                        <div className={styles.option}>
                            <input
                                type="checkbox"
                                id="normalizeCurrency"
                                checked={options.normalizeCurrency}
                                onChange={(e) => setOptions({ ...options, normalizeCurrency: e.target.checked })}
                            />
                            <label htmlFor="normalizeCurrency">금액 형식 통일</label>
                            <select
                                value={options.targetCurrency}
                                onChange={(e) => setOptions({ ...options, targetCurrency: e.target.value })}
                                disabled={!options.normalizeCurrency}
                            >
                                <option value="KRW">원화 (₩)</option>
                                <option value="USD">달러 ($)</option>
                                <option value="EUR">유로 (€)</option>
                                <option value="NUMBER">숫자만</option>
                            </select>
                        </div>

                        <div className={styles.option}>
                            <input
                                type="checkbox"
                                id="normalizeNumbers"
                                checked={options.normalizeNumbers}
                                onChange={(e) => setOptions({ ...options, normalizeNumbers: e.target.checked })}
                            />
                            <label htmlFor="normalizeNumbers">숫자 형식 정리 (쉼표 제거)</label>
                        </div>

                        <div className={styles.option}>
                            <input
                                type="checkbox"
                                id="normalizeText"
                                checked={options.normalizeText}
                                onChange={(e) => setOptions({ ...options, normalizeText: e.target.checked })}
                            />
                            <label htmlFor="normalizeText">텍스트 정리 (공백 제거)</label>
                        </div>
                    </div>

                    {isLoading && (
                        <div className={styles.loading}>
                            <div className={styles.spinner} />
                            <span>미리보기 생성 중...</span>
                        </div>
                    )}

                    {result && !isLoading && (
                        <div className={styles.preview}>
                            <h3>변경 예정 ({result.normalizedCells}개 셀)</h3>

                            <div className={styles.stats}>
                                {Object.entries(result.detectedTypes).map(([type, count]) => (
                                    <span key={type}>
                                        <strong>{type}:</strong> {count}개
                                    </span>
                                ))}
                            </div>

                            <div className={styles.changeList}>
                                {result.changes.slice(0, 20).map((change, i) => (
                                    <div key={i} className={styles.changeItem}>
                                        <span className={styles.changeCell}>
                                            {colToLetter(change.col)}{change.row + 1}
                                        </span>
                                        <span className={styles.changeOriginal}>
                                            {String(change.original)}
                                        </span>
                                        <span className={styles.changeArrow}>→</span>
                                        <span className={styles.changeNew}>
                                            {String(change.normalized)}
                                        </span>
                                    </div>
                                ))}
                                {result.changes.length > 20 && (
                                    <div className={styles.changeItem} style={{ justifyContent: 'center', color: '#5f6368' }}>
                                        ... 외 {result.changes.length - 20}개 변경사항
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.info}>
                        {result && (
                            <span>총 {result.totalCells}개 셀 중 {result.normalizedCells}개 변경됨</span>
                        )}
                    </div>
                    <div className={styles.buttons}>
                        <button className={styles.cancelBtn} onClick={handleClose}>
                            취소
                        </button>
                        <button
                            className={styles.applyBtn}
                            onClick={handleApply}
                            disabled={!result || result.normalizedCells === 0}
                        >
                            적용
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
