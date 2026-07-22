import type { CellPosition, CellRange, SheetData } from '@/types/spreadsheet';
import { cellRefToString } from '@/types/spreadsheet';
import { normalizeHyperlinkUrl } from '@/utils/hyperlink';
import { findMergedRange, normalizeMergedRange, type MergedRange } from '@/utils/mergedRanges';

export interface SpreadsheetCellAccessibilityContext {
  mergedRanges?: readonly MergedRange[];
}

export function getAccessibleCellHyperlink(
  data: SheetData,
  position: CellPosition | null,
  context: SpreadsheetCellAccessibilityContext = {},
): string | null {
  if (!position) return null;
  const mergedRange = findMergedRange(context.mergedRanges ?? [], position.row, position.col);
  const normalizedMerge = mergedRange ? normalizeMergedRange(mergedRange) : null;
  const row = normalizedMerge?.startRow ?? position.row;
  const col = normalizedMerge?.startCol ?? position.col;
  const url = data[row]?.[col]?.link?.url;
  return url ? normalizeHyperlinkUrl(url) : null;
}

export function describeSpreadsheetCell(
  data: SheetData,
  position: CellPosition | null,
  selection: CellRange | null,
  context: SpreadsheetCellAccessibilityContext = {},
): string {
  if (!position) return 'No cell selected';
  const mergedRange = findMergedRange(context.mergedRanges ?? [], position.row, position.col);
  const normalizedMerge = mergedRange ? normalizeMergedRange(mergedRange) : null;
  const cellPosition = normalizedMerge
    ? { row: normalizedMerge.startRow, col: normalizedMerge.startCol }
    : position;
  const reference = cellRefToString(cellPosition.row, cellPosition.col);
  const cell = data[cellPosition.row]?.[cellPosition.col];
  let content = 'blank';
  if (cell?.error) content = `error ${cell.error}`;
  else if (cell?.formula) content = `formula ${cell.formula}, value ${cell.displayValue ?? cell.value ?? 'blank'}`;
  else if (cell?.displayValue !== undefined || cell?.value !== undefined) {
    content = String(cell.displayValue ?? cell.value ?? 'blank');
  }

  const descriptions = [`${reference}, ${content}`];
  if (normalizedMerge) {
    const start = cellRefToString(normalizedMerge.startRow, normalizedMerge.startCol);
    const end = cellRefToString(normalizedMerge.endRow, normalizedMerge.endCol);
    descriptions.push(`merged cell ${start} through ${end}`);
  }
  const safeUrl = getAccessibleCellHyperlink(data, cellPosition, context);
  if (safeUrl) descriptions.push(`link ${safeUrl}, press Alt+Enter to open`);

  if (selection && (selection.start.row !== selection.end.row || selection.start.col !== selection.end.col)) {
    const start = cellRefToString(selection.start.row, selection.start.col);
    const end = cellRefToString(selection.end.row, selection.end.col);
    descriptions.push(`selected range ${start} through ${end}`);
  }
  return descriptions.join(', ');
}
