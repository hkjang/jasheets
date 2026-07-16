import { CellRange, SheetData } from '@/types/spreadsheet';
import { shiftFormulaReferences } from './FormulaEngine';

export interface FillUpdate { row: number; col: number; value: string }

function normalize(range: CellRange): CellRange {
  return {
    start: { row: Math.min(range.start.row, range.end.row), col: Math.min(range.start.col, range.end.col) },
    end: { row: Math.max(range.start.row, range.end.row), col: Math.max(range.start.col, range.end.col) },
  };
}

export function createFillUpdates(data: SheetData, sourceRange: CellRange, targetRange: CellRange): FillUpdate[] {
  const source = normalize(sourceRange);
  const target = normalize(targetRange);
  const sourceRows = source.end.row - source.start.row + 1;
  const sourceCols = source.end.col - source.start.col + 1;
  const verticalSeries = sourceCols === 1 && sourceRows >= 2;
  const horizontalSeries = sourceRows === 1 && sourceCols >= 2;
  const first = Number(data[source.start.row]?.[source.start.col]?.value);
  const second = verticalSeries
    ? Number(data[source.start.row + 1]?.[source.start.col]?.value)
    : Number(data[source.start.row]?.[source.start.col + 1]?.value);
  const numericSeries = (verticalSeries || horizontalSeries) && Number.isFinite(first) && Number.isFinite(second);
  const step = second - first;
  const updates: FillUpdate[] = [];

  for (let row = target.start.row; row <= target.end.row; row++) {
    for (let col = target.start.col; col <= target.end.col; col++) {
      if (row >= source.start.row && row <= source.end.row && col >= source.start.col && col <= source.end.col) continue;
      const sourceRow = source.start.row + ((row - source.start.row) % sourceRows + sourceRows) % sourceRows;
      const sourceCol = source.start.col + ((col - source.start.col) % sourceCols + sourceCols) % sourceCols;
      const sourceCell = data[sourceRow]?.[sourceCol];
      let value = String(sourceCell?.value ?? '');
      if (sourceCell?.formula) {
        value = shiftFormulaReferences(sourceCell.formula, row - sourceRow, col - sourceCol);
      } else if (numericSeries) {
        const index = verticalSeries ? row - source.start.row : col - source.start.col;
        value = String(first + step * index);
      }
      updates.push({ row, col, value });
    }
  }
  return updates;
}
