"use client";

import { DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import styles from "./SheetTabs.module.css";

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
  onReorder: (sheetId: string, index: number) => Promise<void> | void;
  onDuplicate: (sheetId: string) => Promise<void> | void;
}

export default function SheetTabs({
  sheets,
  activeSheetId,
  disabled = false,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  onDuplicate,
}: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (event.altKey && event.shiftKey) {
      const nextIndex = Math.max(
        0,
        Math.min(sheets.length - 1, index + direction),
      );
      if (nextIndex !== index) void onReorder(sheets[index].id, nextIndex);
      return;
    }
    const nextIndex = (index + direction + sheets.length) % sheets.length;
    void onSelect(sheets[nextIndex].id);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    const sheetId = draggingId ?? event.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverId(null);
    if (!sheetId || sheets[targetIndex]?.id === sheetId) return;
    void onReorder(sheetId, targetIndex);
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
            className={`${styles.tabGroup} ${sheet.id === activeSheetId ? styles.active : ""} ${sheet.id === draggingId ? styles.dragging : ""} ${sheet.id === dragOverId ? styles.dragOver : ""}`}
            draggable={!disabled && editingId !== sheet.id}
            onDragStart={(event) => {
              setDraggingId(sheet.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", sheet.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
            }}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverId(sheet.id);
            }}
            onDragLeave={() =>
              setDragOverId((current) =>
                current === sheet.id ? null : current,
              )
            }
            onDrop={(event) => handleDrop(event, index)}
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
                  if (event.key === "Enter") void finishRename();
                  if (event.key === "Escape") setEditingId(null);
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
                title="두 번 클릭하여 이름 변경 · 드래그하여 순서 변경"
              >
                {sheet.name}
              </button>
            )}
            {sheet.id === activeSheetId && !editingId && (
              <button
                type="button"
                className={styles.duplicateButton}
                disabled={disabled}
                aria-label={`${sheet.name} 복제`}
                title="시트 복제"
                onClick={() => void onDuplicate(sheet.id)}
              >
                ⧉
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
