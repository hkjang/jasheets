import { CellRange, CellValue, NamedRanges, SheetData } from '@/types/spreadsheet';
import { FormulaWorkbook } from './FormulaEngine';
import { recalculate } from './RecalculationEngine';

function compareValues(a: CellValue | undefined, b: CellValue | undefined, ascending: boolean): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a < b) return ascending ? -1 : 1;
  if (a > b) return ascending ? 1 : -1;
  return 0;
}

export function sortRowsData(
  data: SheetData,
  colIndex: number,
  ascending = true,
  namedRanges: NamedRanges = {},
  workbook?: FormulaWorkbook,
): void {
  const rowIndices = Object.keys(data).map(Number).filter(Number.isFinite);
  if (rowIndices.length === 0) return;

  const minRow = Math.min(...rowIndices);
  const maxRow = Math.max(...rowIndices);
  const rows = Array.from({ length: maxRow - minRow + 1 }, (_, offset) => data[minRow + offset]);
  rows.sort((a, b) => compareValues(a?.[colIndex]?.value, b?.[colIndex]?.value, ascending));
  rows.forEach((row, offset) => {
    data[minRow + offset] = row;
  });
  recalculate(data, namedRanges, undefined, workbook);
}

export function sortRangeData(
  data: SheetData,
  range: CellRange,
  colIndex: number,
  ascending = true,
  namedRanges: NamedRanges = {},
  workbook?: FormulaWorkbook,
): void {
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const minCol = Math.min(range.start.col, range.end.col);
  const maxCol = Math.max(range.start.col, range.end.col);
  const rows = Array.from({ length: endRow - startRow + 1 }, (_, offset) => {
    const row = startRow + offset;
    const cells = Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => data[row]?.[minCol + colOffset]);
    return { key: data[row]?.[colIndex]?.value, cells };
  });

  rows.sort((a, b) => compareValues(a.key, b.key, ascending));
  rows.forEach(({ cells }, rowOffset) => {
    const targetRow = startRow + rowOffset;
    if (!data[targetRow]) data[targetRow] = {};
    cells.forEach((cell, colOffset) => {
      data[targetRow][minCol + colOffset] = cell;
    });
  });
  recalculate(data, namedRanges, undefined, workbook);
}
