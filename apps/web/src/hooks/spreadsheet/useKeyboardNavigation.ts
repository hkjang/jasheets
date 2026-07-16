import { useEffect, useRef } from 'react';
import type { CellPosition, CellRange } from '@/types/spreadsheet';

export interface NavigationModifiers {
  shift: boolean;
  jump: boolean;
}

export function resolveNavigationTarget(
  key: string,
  current: CellPosition,
  totalRows: number,
  totalCols: number,
  modifiers: NavigationModifiers,
): CellPosition | null {
  const lastRow = Math.max(0, totalRows - 1);
  const lastCol = Math.max(0, totalCols - 1);
  const target = { ...current };

  switch (key) {
    case 'ArrowUp': target.row = modifiers.jump ? 0 : Math.max(0, current.row - 1); break;
    case 'ArrowDown': target.row = modifiers.jump ? lastRow : Math.min(lastRow, current.row + 1); break;
    case 'ArrowLeft': target.col = modifiers.jump ? 0 : Math.max(0, current.col - 1); break;
    case 'ArrowRight': target.col = modifiers.jump ? lastCol : Math.min(lastCol, current.col + 1); break;
    case 'Home':
      target.col = 0;
      if (modifiers.jump) target.row = 0;
      break;
    case 'End':
      target.col = lastCol;
      if (modifiers.jump) target.row = lastRow;
      break;
    case 'PageUp': target.row = Math.max(0, current.row - 20); break;
    case 'PageDown': target.row = Math.min(lastRow, current.row + 20); break;
    case 'Enter': target.row = Math.max(0, Math.min(lastRow, current.row + (modifiers.shift ? -1 : 1))); break;
    case 'Tab':
      target.col = current.col + (modifiers.shift ? -1 : 1);
      if (target.col > lastCol) {
        target.col = 0;
        target.row = Math.min(lastRow, current.row + 1);
      } else if (target.col < 0) {
        target.col = lastCol;
        target.row = Math.max(0, current.row - 1);
      }
      break;
    default: return null;
  }
  return target;
}

interface UseKeyboardNavigationProps {
  selectedCell: CellPosition | null;
  selection: CellRange | null;
  isEditingRef: React.MutableRefObject<boolean>;
  onCommit: () => void;
  onCancel: () => void;
  onStartEdit: (value: string) => void;
  onNavigate: (row: number, col: number, extend: boolean, anchor: CellPosition) => void;
  onClearSelection: () => void;
  totalRows: number;
  totalCols: number;
}

export function useKeyboardNavigation({
  selectedCell,
  selection,
  isEditingRef,
  onCommit,
  onCancel,
  onStartEdit,
  onNavigate,
  onClearSelection,
  totalRows,
  totalCols,
}: UseKeyboardNavigationProps) {
  const anchorRef = useRef<CellPosition | null>(selectedCell);

  useEffect(() => {
    if (!selectedCell) return;
    if (!selection || (selection.start.row === selection.end.row && selection.start.col === selection.end.col)) {
      anchorRef.current = selectedCell;
    }
  }, [selectedCell, selection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedCell) return;
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTextInput && !['Tab', 'Enter', 'Escape'].includes(event.key)) return;
      if (isEditingRef.current && !['Tab', 'Enter', 'Escape'].includes(event.key)) return;

      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditingRef.current && selection) {
        onClearSelection();
        return;
      }

      const navigationTarget = resolveNavigationTarget(
        event.key,
        selectedCell,
        totalRows,
        totalCols,
        { shift: event.shiftKey, jump: event.ctrlKey || event.metaKey },
      );
      if (navigationTarget) {
        event.preventDefault();
        if (isEditingRef.current) onCommit();
        const extend = event.shiftKey && event.key !== 'Tab' && event.key !== 'Enter';
        const anchor = extend ? (anchorRef.current ?? selectedCell) : navigationTarget;
        if (!extend) anchorRef.current = navigationTarget;
        onNavigate(navigationTarget.row, navigationTarget.col, extend, anchor);
        return;
      }

      if (!isEditingRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        onStartEdit(event.key);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingRef, onCancel, onClearSelection, onCommit, onNavigate, onStartEdit, selectedCell, selection, totalCols, totalRows]);
}
