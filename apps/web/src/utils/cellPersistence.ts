import type { Patch } from 'immer';
import type {
  CellData,
  CellStyle,
  CellValue,
  DataValidationRule,
  SheetData,
} from '@/types/spreadsheet';

export interface PersistedCellFormat {
  style?: CellStyle;
  numberFormat?: string;
  validation?: DataValidationRule;
}

export interface PersistedCellUpdate {
  row: number;
  col: number;
  value: CellValue;
  formula: string | null;
  format: PersistedCellFormat | null;
}

function coordinate(value: string | number | undefined): number | null {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(result) && result >= 0 ? result : null;
}

export function serializeCellFormat(cell: CellData | undefined): PersistedCellFormat | null {
  if (!cell?.style && !cell?.format && !cell?.validation) return null;
  return {
    ...(cell.style ? { style: cell.style } : {}),
    ...(cell.format ? { numberFormat: cell.format } : {}),
    ...(cell.validation ? { validation: cell.validation } : {}),
  };
}

export function deserializeCellFormat(format: unknown): Pick<CellData, 'style' | 'format' | 'validation'> {
  if (!format || typeof format !== 'object' || Array.isArray(format)) return {};
  const persisted = format as PersistedCellFormat;
  if ('style' in persisted || 'numberFormat' in persisted || 'validation' in persisted) {
    return {
      style: persisted.style,
      format: persisted.numberFormat,
      validation: persisted.validation,
    };
  }
  return { style: format as CellStyle };
}

export function collectPersistedCellUpdates(
  previous: SheetData,
  next: SheetData,
  patches: Patch[],
): PersistedCellUpdate[] {
  const changed = new Set<string>();
  const addRow = (row: number) => {
    const columns = new Set([
      ...Object.keys(previous[row] ?? {}),
      ...Object.keys(next[row] ?? {}),
    ]);
    columns.forEach((column) => {
      const col = coordinate(column);
      if (col !== null) changed.add(`${row}:${col}`);
    });
  };

  for (const patch of patches) {
    const row = coordinate(patch.path[0]);
    if (row === null) continue;
    const col = coordinate(patch.path[1]);
    if (col === null) addRow(row);
    else changed.add(`${row}:${col}`);
  }

  return [...changed].map((key) => {
    const [row, col] = key.split(':').map(Number);
    const cell = next[row]?.[col];
    return {
      row,
      col,
      value: cell?.value ?? null,
      formula: cell?.formula ?? null,
      format: serializeCellFormat(cell),
    };
  });
}
