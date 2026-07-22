'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './FileOpenDialog.module.css';
import { importSpreadsheetFile, validateImportFile, ImportResult } from '@/utils/fileImport';

interface FileOpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport: (result: ImportResult, mode: 'append' | 'replace') => Promise<void> | void;
}

export default function FileOpenDialog({
  isOpen,
  onClose,
  onFileImport,
}: FileOpenDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    
    // Validate file
    const validation = validateImportFile(file);
    if (!validation.valid) {
      setError(validation.error || '파일 검증 실패');
      return;
    }

    setIsLoading(true);
    try {
      const result = await importSpreadsheetFile(file);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    setPreview(null);
    setMode('append');
    setReplaceConfirmed(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [onClose]);

  const handleImport = useCallback(async () => {
    if (!preview || (mode === 'replace' && !replaceConfirmed)) return;
    setError(null);
    setIsLoading(true);
    try {
      await onFileImport(preview, mode);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [handleClose, mode, onFileImport, preview, replaceConfirmed]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>파일 가져오기</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {!preview ? <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') handleBrowse();
            }}
          >
            {isLoading ? (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>파일을 불러오는 중...</p>
              </div>
            ) : (
              <>
                <svg className={styles.uploadIcon} viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                </svg>
                <p className={styles.dropText}>
                  파일을 여기에 드래그하거나
                </p>
                <button type="button" className={styles.browseBtn} onClick={handleBrowse}>
                  파일 선택
                </button>
                <p className={styles.supportedFormats}>
                  지원 형식: .xlsx, .xls, .csv (최대 10MB)
                </p>
              </>
            )}
          </div> : (
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <div>
                  <strong>{preview.workbook?.sheets.length ?? 1}개 시트</strong>
                  <span>를 가져옵니다</span>
                </div>
                <button type="button" className={styles.changeFileBtn} onClick={() => setPreview(null)}>
                  다른 파일
                </button>
              </div>
              <ul className={styles.sheetList} aria-label="가져올 시트">
                {(preview.workbook?.sheets ?? [{ name: preview.sheetName, data: preview.data, mergedRanges: [], rows: {}, columns: {} }]).map((sheet) => {
                  const cellCount = Object.values(sheet.data).reduce((sum, row) => sum + Object.keys(row).length, 0);
                  return (
                    <li key={sheet.name}>
                      <span>{sheet.name}</span>
                      <small>{cellCount.toLocaleString()}개 셀 · 병합 {sheet.mergedRanges.length}개</small>
                    </li>
                  );
                })}
              </ul>
              <fieldset className={styles.modeOptions}>
                <legend>가져오기 방식</legend>
                <label>
                  <input type="radio" name="import-mode" value="append" checked={mode === 'append'} onChange={() => { setMode('append'); setReplaceConfirmed(false); }} />
                  <span><strong>새 탭으로 추가</strong><small>현재 탭은 그대로 유지합니다.</small></span>
                </label>
                <label>
                  <input type="radio" name="import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  <span><strong>기존 탭 교체</strong><small>앞쪽 탭부터 가져온 내용으로 덮어씁니다.</small></span>
                </label>
              </fieldset>
              {mode === 'replace' && (
                <label className={styles.confirmReplace}>
                  <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />
                  기존 탭의 셀, 병합 및 행·열 설정이 교체되는 것을 확인했습니다.
                </label>
              )}
              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={handleClose}>취소</button>
                <button type="button" className={styles.importBtn} onClick={handleImport} disabled={isLoading || (mode === 'replace' && !replaceConfirmed)}>
                  {isLoading ? '가져오는 중…' : '가져오기'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
