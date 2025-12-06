
import { useState, useCallback, useRef } from 'react';
import { CellPosition, SheetData } from '@/types/spreadsheet';

interface UseSpreadsheetEditProps {
  data: SheetData;
  selectedCell: CellPosition | null;
  setCellValue: (row: number, col: number, value: string) => void;
}

export function useSpreadsheetEdit({ data, selectedCell, setCellValue }: UseSpreadsheetEditProps) {
  const [isEditing, _setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [editValue, setEditValue] = useState('');

  const setEditing = useCallback((editing: boolean) => {
    _setIsEditing(editing);
    isEditingRef.current = editing;
  }, []);

  const startEditing = useCallback((pos: CellPosition, initialValue?: string) => {
    setEditing(true);
    const cell = data[pos.row]?.[pos.col];
    setEditValue(initialValue ?? (cell?.formula || String(cell?.value ?? '')));
  }, [data, setEditing]);

  const commitEditing = useCallback(() => {
    if (selectedCell) {
      setCellValue(selectedCell.row, selectedCell.col, editValue);
    }
    setEditing(false);
  }, [selectedCell, editValue, setCellValue, setEditing]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    // Reset value to current cell value? 
    // In original code, it reset editValue to current cell value.
    const cell = data[selectedCell?.row ?? 0]?.[selectedCell?.col ?? 0];
    setEditValue(cell?.formula || String(cell?.value ?? ''));
  }, [data, selectedCell, setEditing]);

  const updateEditValue = useCallback((val: string) => {
    setEditValue(val);
  }, []);

  return {
    isEditing,
    isEditingRef,
    editValue,
    setEditValue: updateEditValue,
    setEditing,
    startEditing,
    commitEditing,
    cancelEditing,
  };
}
