'use client';

import { useState, useEffect } from 'react';
import styles from './SheetBuilderDialog.module.css';

interface SheetTemplate {
    key: string;
    name: string;
    description: string;
}

interface ColumnDef {
    name: string;
    type: string;
    width?: number;
}

interface SheetDSL {
    name: string;
    description?: string;
    columns: ColumnDef[];
}

interface SheetBuildResult {
    dsl: SheetDSL;
    cells: any[][];
    explanation: string;
    confidence: number;
}

interface SheetBuilderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (result: SheetBuildResult) => void;
    apiUrl?: string;
}

export default function SheetBuilderDialog({
    isOpen,
    onClose,
    onApply,
    apiUrl = 'http://localhost:4000/api',
}: SheetBuilderDialogProps) {
    const [prompt, setPrompt] = useState('');
    const [templates, setTemplates] = useState<SheetTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [result, setResult] = useState<SheetBuildResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load templates on mount
    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/ai/sheet/templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        }
    };

    const handleTemplateSelect = async (key: string) => {
        setSelectedTemplate(key);
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/ai/sheet/templates/${key}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setResult(data);
            } else {
                throw new Error('템플릿 로드에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setError(null);
        setSelectedTemplate(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/ai/sheet/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ prompt }),
            });

            if (response.ok) {
                const data = await response.json();
                setResult(data);
            } else {
                throw new Error('시트 생성에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (result) {
            onApply(result);
            handleClose();
        }
    };

    const handleClose = () => {
        setPrompt('');
        setSelectedTemplate(null);
        setResult(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>
                        <span>✨</span>
                        AI 시트 생성
                    </h2>
                    <button className={styles.closeBtn} onClick={handleClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.inputSection}>
                        <label>시트 설명</label>
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="예: 고객 관리 대시보드 만들어줘"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        />
                    </div>

                    <div className={styles.templateSection}>
                        <h3>또는 템플릿 선택</h3>
                        <div className={styles.templates}>
                            {templates.map((template) => (
                                <button
                                    key={template.key}
                                    className={`${styles.templateCard} ${selectedTemplate === template.key ? styles.selected : ''}`}
                                    onClick={() => handleTemplateSelect(template.key)}
                                >
                                    <h4>{template.name}</h4>
                                    <p>{template.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {isLoading && (
                        <div className={styles.loading}>
                            <div className={styles.spinner} />
                            <span>시트 구조를 생성하고 있습니다...</span>
                        </div>
                    )}

                    {result && !isLoading && (
                        <div className={styles.previewSection}>
                            <h3>
                                미리보기: {result.dsl.name}
                                <span className={styles.confidence}>
                                    <span className={styles.confidenceBar}>
                                        <span
                                            className={styles.confidenceFill}
                                            style={{
                                                width: `${result.confidence * 100}%`,
                                                background: result.confidence > 0.8 ? '#34a853' : result.confidence > 0.5 ? '#fbbc04' : '#ea4335'
                                            }}
                                        />
                                    </span>
                                    신뢰도 {Math.round(result.confidence * 100)}%
                                </span>
                            </h3>
                            <p style={{ fontSize: '13px', color: '#5f6368', margin: '8px 0 16px' }}>
                                {result.explanation}
                            </p>
                            <table className={styles.previewTable}>
                                <thead>
                                    <tr>
                                        {result.dsl.columns.map((col, i) => (
                                            <th key={i}>{col.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[0, 1, 2].map((rowIdx) => (
                                        <tr key={rowIdx}>
                                            {result.dsl.columns.map((col, colIdx) => (
                                                <td key={colIdx}>
                                                    {col.type === 'formula' ? (
                                                        <em style={{ color: '#1a73e8' }}>수식</em>
                                                    ) : (
                                                        <span style={{ color: '#9aa0a6' }}>({col.type})</span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={handleClose}>
                        취소
                    </button>
                    <button
                        className={styles.createBtn}
                        onClick={handleApply}
                        disabled={!result || isLoading}
                    >
                        시트 적용
                    </button>
                </div>
            </div>
        </div>
    );
}
