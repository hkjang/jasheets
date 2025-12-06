'use client';

import { useState } from 'react';
import styles from './VersionHistorySidebar.module.css';

interface Commit {
  id: string;
  timestamp: Date;
  author: string;
  description: string;
}

interface VersionHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: any[]; // We'll type this properly based on useSpreadsheetData
  onRestore: (index: number) => void;
}

export default function VersionHistorySidebar({
  isOpen,
  onClose,
  history,
  onRestore,
}: VersionHistorySidebarProps) {
  if (!isOpen) return null;

  // In a real app, we'd process `history` patches to show meaningful diffs.
  // For now, we just list the commits.
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>버전 기록</h3>
        <button onClick={onClose} className={styles.closeBtn}>×</button>
      </div>
      
      <div className={styles.list}>
        {history.length === 0 ? (
           <div className={styles.empty}>변경 내역이 없습니다.</div>
        ) : (
            [...history].reverse().map((commit, revIndex) => {
                const index = history.length - 1 - revIndex;
                return (
                    <div key={index} className={styles.item}>
                        <div className={styles.itemHeader}>
                            <span className={styles.timestamp}>
                                {new Date().toLocaleTimeString()} 
                                {/* Real timestamp needed in commit object */}
                            </span>
                            <span className={styles.author}>User</span>
                        </div>
                        <div className={styles.description}>
                            변경사항 #{index + 1}
                        </div>
                        <button 
                            className={styles.restoreBtn}
                            onClick={() => onRestore(index)}
                        >
                            이 버전으로 복원
                        </button>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
}
