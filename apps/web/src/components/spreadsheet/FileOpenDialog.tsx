'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './FileOpenDialog.module.css';
import { importSpreadsheetFile, validateImportFile, ImportResult } from '@/utils/fileImport';

interface FileOpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport: (result: ImportResult) => void;
}

export default function FileOpenDialog({
  isOpen,
  onClose,
  onFileImport,
}: FileOpenDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onFileImport(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [onFileImport, onClose]);

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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>파일 열기</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                <button className={styles.browseBtn} onClick={handleBrowse}>
                  파일 선택
                </button>
                <p className={styles.supportedFormats}>
                  지원 형식: .xlsx, .xls, .csv (최대 10MB)
                </p>
              </>
            )}
          </div>

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
