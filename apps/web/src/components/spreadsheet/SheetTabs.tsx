'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import styles from './SheetTabs.module.css';

export interface SheetTab {
  id: string;
  name: string;
}

interface SheetTabsProps {
  sheets: SheetTab[];
  activeSheetId: string | null;
  disabled?: boolean;
  onSelect: (sheetId: string) => Promise<void> | void;
  onAdd: () => Promise<void> | void;
  onRename: (sheetId: string, name: string) => Promise<void> | void;
  onDelete: (sheetId: string) => Promise<void> | void;
}

export default function SheetTabs({
  sheets,
  activeSheetId,
  disabled = false,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const beginRename = (sheet: SheetTab) => {
    if (disabled) return;
    setEditingId(sheet.id);
    setDraftName(sheet.name);
  };

  const finishRename = async () => {
    if (!editingId) return;
    const sheet = sheets.find(({ id }) => id === editingId);
    const name = draftName.trim();
    setEditingId(null);
    if (!sheet || !name || name === sheet.name) return;
    await onRename(sheet.id, name);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + sheets.length) % sheets.length;
    void onSelect(sheets[nextIndex].id);
  };

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => void onAdd()}
        disabled={disabled}
        aria-label="새 시트 추가"
        title="새 시트 추가"
      >
        +
      </button>
      <div className={styles.tabs} role="tablist" aria-label="시트 탭">
        {sheets.map((sheet, index) => (
          <div
            key={sheet.id}
            className={`${styles.tabGroup} ${sheet.id === activeSheetId ? styles.active : ''}`}
          >
            {editingId === sheet.id ? (
              <input
                ref={inputRef}
                className={styles.renameInput}
                value={draftName}
                maxLength={100}
                aria-label="시트 이름"
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => void finishRename()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void finishRename();
                  if (event.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={sheet.id === activeSheetId}
                className={styles.tabButton}
                disabled={disabled}
                onClick={() => void onSelect(sheet.id)}
                onDoubleClick={() => beginRename(sheet)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                title="두 번 클릭하여 이름 변경"
              >
                {sheet.name}
              </button>
            )}
            {sheet.id === activeSheetId && sheets.length > 1 && !editingId && (
              <button
                type="button"
                className={styles.deleteButton}
                disabled={disabled}
                aria-label={`${sheet.name} 삭제`}
                title="시트 삭제"
                onClick={() => void onDelete(sheet.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
