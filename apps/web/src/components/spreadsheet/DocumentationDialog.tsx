'use client';

import { useState, useEffect } from 'react';
import styles from './DocumentationDialog.module.css';

interface SheetDocumentation {
    sheetName: string;
    description: string;
    columns: any[];
    formulas: any[];
    relationships: any[];
    metadata: {
        createdAt: string;
        totalRows: number;
        totalCols: number;
    };
}

interface DocumentationResult {
    documentation: SheetDocumentation;
    markdown: string;
}

interface DocumentationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[][];
    headers?: string[];
    sheetName?: string;
    apiUrl?: string;
}

export default function DocumentationDialog({
    isOpen,
    onClose,
    data,
    headers,
    sheetName = 'Sheet',
    apiUrl = 'http://localhost:4000/api',
}: DocumentationDialogProps) {
    const [result, setResult] = useState<DocumentationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'preview' | 'markdown'>('preview');

    useEffect(() => {
        if (isOpen && data.length > 0) {
            generateDocumentation();
        }
    }, [isOpen]);

    const generateDocumentation = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/documentation/sheet/markdown`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    data,
                    options: {
                        sheetName,
                        headers,
                        includeFormulas: true,
                        includeRelationships: true,
                    },
                }),
            });

            if (response.ok) {
                const res = await response.json();
                setResult(res);
            } else {
                throw new Error('문서 생성에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMarkdown = () => {
        if (result?.markdown) {
            navigator.clipboard.writeText(result.markdown);
            alert('Markdown이 클립보드에 복사되었습니다.');
        }
    };

    const handleDownloadMarkdown = () => {
        if (result?.markdown) {
            const blob = new Blob([result.markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sheetName}_문서.md`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const renderMarkdownPreview = (markdown: string) => {
        // Simple markdown to HTML converter for basic elements
        let html = markdown
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.+)$/gm, (match) => {
                if (match.startsWith('<')) return match;
                return `<p>${match}</p>`;
            });

        // Handle tables
        const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
        html = html.replace(tableRegex, (_, header, rows) => {
            const headers = header.split('|').filter((h: string) => h.trim());
            const headerHtml = headers.map((h: string) => `<th>${h.trim()}</th>`).join('');

            const rowsHtml = rows.trim().split('\n').map((row: string) => {
                const cells = row.split('|').filter((c: string) => c.trim());
                return `<tr>${cells.map((c: string) => `<td>${c.trim()}</td>`).join('')}</tr>`;
            }).join('');

            return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
        });

        return html;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>
                        <span>📄</span>
                        자동 문서화
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading && (
                        <div className={styles.loading}>
                            <div className={styles.spinner} />
                            <span>문서를 생성하고 있습니다...</span>
                        </div>
                    )}

                    {error && <div className={styles.error}>{error}</div>}

                    {result && !isLoading && (
                        <>
                            <div className={styles.tabs}>
                                <button
                                    className={`${styles.tab} ${viewMode === 'preview' ? styles.active : ''}`}
                                    onClick={() => setViewMode('preview')}
                                >
                                    미리보기
                                </button>
                                <button
                                    className={`${styles.tab} ${viewMode === 'markdown' ? styles.active : ''}`}
                                    onClick={() => setViewMode('markdown')}
                                >
                                    Markdown
                                </button>
                            </div>

                            {viewMode === 'preview' ? (
                                <div
                                    className={styles.docPreview}
                                    dangerouslySetInnerHTML={{
                                        __html: renderMarkdownPreview(result.markdown)
                                    }}
                                />
                            ) : (
                                <pre style={{
                                    background: '#1e1e1e',
                                    color: '#d4d4d4',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    overflow: 'auto',
                                    maxHeight: '400px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}>
                                    {result.markdown}
                                </pre>
                            )}
                        </>
                    )}
                </div>

                {result && (
                    <div className={styles.footer}>
                        <button className={styles.cancelBtn} onClick={onClose}>
                            닫기
                        </button>
                        <button className={styles.downloadBtn} onClick={handleDownloadMarkdown}>
                            다운로드
                        </button>
                        <button className={styles.copyBtn} onClick={handleCopyMarkdown}>
                            복사
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
