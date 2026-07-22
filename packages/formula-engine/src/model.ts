export interface CellPosition {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export type CellValue = string | number | boolean | null;

export interface FormulaCell {
  value: CellValue;
  displayValue?: string;
  formula?: string;
}

export interface FormulaRowData {
  [colIndex: number]: FormulaCell;
}

export interface SheetData {
  [rowIndex: number]: FormulaRowData;
}

export type NamedRanges = Record<string, CellRange>;
