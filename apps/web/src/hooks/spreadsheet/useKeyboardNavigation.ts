
import { useEffect } from 'react';
import { CellPosition } from '@/types/spreadsheet';

interface UseKeyboardNavigationProps {
  selectedCell: CellPosition | null;
  selection: any; // Explicit type handled in consumption or import
  isEditingRef: React.MutableRefObject<boolean>;
  onCommit: () => void;
  onCancel: () => void;
  onStartEdit: (val: string) => void;
  onNavigate: (row: number, col: number) => void;
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      if (isEditingRef.current && !['Tab', 'Enter', 'Escape'].includes(e.key)) return;

      let newRow = selectedCell.row;
      let newCol = selectedCell.col;

      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, selectedCell.row - 1);
          break;
        case 'ArrowDown':
        case 'Enter':
          if (isEditingRef.current) {
            onCommit();
          }
          newRow = Math.min(totalRows - 1, selectedCell.row + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, selectedCell.col - 1);
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          if (isEditingRef.current) {
            onCommit();
          }
          newCol = Math.min(totalCols - 1, selectedCell.col + 1);
          break;
        case 'Escape':
          onCancel();
          return;
        case 'Delete':
        case 'Backspace':
          if (!isEditingRef.current && selection) {
            onClearSelection();
          }
          return;
        default:
          if (!isEditingRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            onStartEdit(e.key);
            e.preventDefault();
          }
          return;
      }

      if (newRow !== selectedCell.row || newCol !== selectedCell.col) {
        e.preventDefault();
        onNavigate(newRow, newCol);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
  ]);
}
