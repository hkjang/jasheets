'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type SpreadsheetVersion } from '@/lib/api';
import styles from './VersionHistorySidebar.module.css';

interface VersionHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId?: string;
  onRestore: () => void;
}

export default function VersionHistorySidebar({
  isOpen,
  onClose,
  spreadsheetId,
  onRestore,
}: VersionHistorySidebarProps) {
  const [versions, setVersions] = useState<SpreadsheetVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!spreadsheetId) return;
    setLoading(true);
    setError(null);
    try {
      setVersions(await api.versions.list(spreadsheetId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '버전 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    if (!isOpen || !spreadsheetId) return;
    const timeout = window.setTimeout(() => void loadVersions(), 0);
    return () => window.clearTimeout(timeout);
  }, [isOpen, loadVersions, spreadsheetId]);

  const createVersion = async () => {
    if (!spreadsheetId) return;
    const name = window.prompt('버전 이름을 입력하세요. (선택)')?.trim();
    try {
      await api.versions.create(spreadsheetId, name || undefined);
      await loadVersions();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '버전을 생성하지 못했습니다.');
    }
  };

  const restoreVersion = async (version: SpreadsheetVersion) => {
    const label = version.name || new Date(version.createdAt).toLocaleString('ko-KR');
    if (!window.confirm(`"${label}" 버전으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
    setRestoringId(version.id);
    setError(null);
    try {
      await api.versions.restore(version.id);
      onRestore();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '버전을 복원하지 못했습니다.');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>버전 기록</h3>
        <button onClick={onClose} className={styles.closeBtn} aria-label="버전 기록 닫기">×</button>
      </div>

      <div className={styles.list}>
        <button className={styles.restoreBtn} onClick={() => void createVersion()} disabled={!spreadsheetId || loading}>
          현재 상태를 버전으로 저장
        </button>
        {error && <div role="alert" className={styles.empty}>{error}</div>}
        {loading ? (
          <div className={styles.empty}>버전 기록을 불러오는 중...</div>
        ) : versions.length === 0 ? (
          <div className={styles.empty}>저장된 버전이 없습니다.</div>
        ) : (
          versions.map((version) => (
            <div key={version.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.timestamp}>
                  {new Date(version.createdAt).toLocaleString('ko-KR')}
                </span>
                <span className={styles.author}>
                  {version.createdBy.name || version.createdBy.email}
                </span>
              </div>
              <div className={styles.description}>{version.name || '자동 저장 버전'}</div>
              <button
                className={styles.restoreBtn}
                onClick={() => void restoreVersion(version)}
                disabled={restoringId !== null}
              >
                {restoringId === version.id ? '복원 중...' : '이 버전으로 복원'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
