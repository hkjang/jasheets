import type { CellData, SheetData } from '@/types/spreadsheet';
import { cellRefToString, letterToColIndex } from '@/types/spreadsheet';
import type { PivotConfig } from './pivotLogic';

export interface PivotOutputRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ManagedPivotConfig extends PivotConfig {
  outputRange?: PivotOutputRange;
}

export interface ManagedPivotTable {
  id?: string;
  name?: string | null;
  config: ManagedPivotConfig;
  sourceRange?: string | null;
  targetCell?: string | null;
}

export function parseTargetCell(reference: string | null | undefined) {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(reference?.trim() ?? '');
  if (!match) return null;
  return { row: Number(match[2]) - 1, col: letterToColIndex(match[1].toUpperCase()) };
}

export function getPivotOutputRange(
  targetCell: string,
  output: SheetData,
): PivotOutputRange | null {
  const target = parseTargetCell(targetCell);
  if (!target) return null;
  const rows = Object.keys(output).map(Number).filter(Number.isFinite);
  if (rows.length === 0) return null;
  const cols = rows.flatMap((row) => Object.keys(output[row] ?? {}).map(Number)).filter(Number.isFinite);
  if (cols.length === 0) return null;
  return {
    startRow: target.row,
    startCol: target.col,
    endRow: target.row + Math.max(...rows),
    endCol: target.col + Math.max(...cols),
  };
}

export function replacePivotOutput(
  data: SheetData,
  previousRange: PivotOutputRange | undefined,
  targetCell: string,
  output: SheetData,
): { data: SheetData; outputRange: PivotOutputRange | null } {
  const next: SheetData = { ...data };
  if (previousRange) {
    for (let row = previousRange.startRow; row <= previousRange.endRow; row++) {
      if (!next[row]) continue;
      const nextRow = { ...next[row] };
      for (let col = previousRange.startCol; col <= previousRange.endCol; col++) delete nextRow[col];
      if (Object.keys(nextRow).length === 0) delete next[row];
      else next[row] = nextRow;
    }
  }
  const target = parseTargetCell(targetCell);
  const outputRange = getPivotOutputRange(targetCell, output);
  if (!target || !outputRange) return { data: next, outputRange };
  for (const [rowKey, cells] of Object.entries(output)) {
    const row = target.row + Number(rowKey);
    next[row] = { ...(next[row] ?? {}) };
    for (const [colKey, cell] of Object.entries(cells) as Array<[string, CellData]>) {
      next[row][target.col + Number(colKey)] = cell;
    }
  }
  return { data: next, outputRange };
}

export function containsPivotOutput(
  pivot: ManagedPivotTable,
  row: number,
  col: number,
): boolean {
  const range = pivot.config.outputRange;
  return !!range && row >= range.startRow && row <= range.endRow && col >= range.startCol && col <= range.endCol;
}

export function sourceRangeToA1(config: PivotConfig): string {
  const { sourceRange } = config;
  return `${cellRefToString(sourceRange.startRow, sourceRange.startCol)}:${cellRefToString(sourceRange.endRow, sourceRange.endCol)}`;
}

export async function persistThenApplyPivotOutput<T>(
  persist: () => Promise<T>,
  applyOutput: () => void,
): Promise<T> {
  const saved = await persist();
  applyOutput();
  return saved;
}
