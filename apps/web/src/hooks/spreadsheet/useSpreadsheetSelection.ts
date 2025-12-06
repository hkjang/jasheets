
import { useState, useCallback } from 'react';
import { CellPosition, CellRange } from '@/types/spreadsheet';

export function useSpreadsheetSelection() {
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [selection, setSelection] = useState<CellRange | null>(null);

  const handleCellSelect = useCallback((pos: CellPosition) => {
    setSelectedCell(pos);
    // When a single cell is selected, it's also the current selection range
    // But we might want to keep them separate if we want to support multi-select that doesn't include the active cell?
    // Usually standard spreadsheets: clicking a cell sets it as active AND the start of selection range.
    // In the original code: 
    // handleCellSelect just set selectedCell. 
    // handleSelectionChange set selection.
    // SpreadsheetCanvas calls onCellSelect then onSelectionChange on mouse down.
  }, []);

  const handleSelectionChange = useCallback((range: CellRange) => {
    setSelection(range);
  }, []);

  return {
    selectedCell,
    setSelectedCell,
    selection,
    setSelection,
    handleCellSelect,
    handleSelectionChange,
  };
}
