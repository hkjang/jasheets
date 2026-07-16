import type { CellPosition, CellRange, SheetData } from '@/types/spreadsheet';
import { cellRefToString } from '@/types/spreadsheet';

export function describeSpreadsheetCell(
  data: SheetData,
  position: CellPosition | null,
  selection: CellRange | null,
): string {
  if (!position) return 'No cell selected';
  const reference = cellRefToString(position.row, position.col);
  const cell = data[position.row]?.[position.col];
  let content = 'blank';
  if (cell?.error) content = `error ${cell.error}`;
  else if (cell?.formula) content = `formula ${cell.formula}, value ${cell.displayValue ?? cell.value ?? 'blank'}`;
  else if (cell?.displayValue !== undefined || cell?.value !== undefined) {
    content = String(cell.displayValue ?? cell.value ?? 'blank');
  }

  if (!selection || (selection.start.row === selection.end.row && selection.start.col === selection.end.col)) {
    return `${reference}, ${content}`;
  }
  const start = cellRefToString(selection.start.row, selection.start.col);
  const end = cellRefToString(selection.end.row, selection.end.col);
  return `${reference}, ${content}, selected range ${start} through ${end}`;
}
