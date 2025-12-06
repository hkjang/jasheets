// Cell Types
export type CellValue = string | number | boolean | null;

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  numberFormat?: string;
  wrapText?: boolean;
  borderTop?: BorderStyle;
  borderRight?: BorderStyle;
  borderBottom?: BorderStyle;
  borderLeft?: BorderStyle;
}

export interface BorderStyle {
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
}

export interface Cell {
  id: string;
  row: number;
  col: number;
  value: CellValue;
  displayValue?: string;
  formula?: string;
  format?: CellFormat;
  error?: string;
}

export interface CellReference {
  row: number;
  col: number;
  sheetId?: string;
  absolute?: {
    row: boolean;
    col: boolean;
  };
}

export interface CellRange {
  start: CellReference;
  end: CellReference;
}

// Sheet Types
export interface Sheet {
  id: string;
  name: string;
  index: number;
  rowCount: number;
  colCount: number;
  frozenRows: number;
  frozenCols: number;
  defaultRowHeight: number;
  defaultColWidth: number;
  rowHeights: Record<number, number>;
  colWidths: Record<number, number>;
  hiddenRows: Set<number>;
  hiddenCols: Set<number>;
}

export interface Spreadsheet {
  id: string;
  name: string;
  ownerId: string;
  sheets: Sheet[];
  activeSheetId: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
}

// Permission Types
export enum PermissionRole {
  VIEWER = 'VIEWER',
  COMMENTER = 'COMMENTER',
  EDITOR = 'EDITOR',
  OWNER = 'OWNER',
}

export interface Permission {
  id: string;
  spreadsheetId: string;
  userId?: string;
  email?: string;
  role: PermissionRole;
  shareToken?: string;
  expiresAt?: Date;
}

// Collaboration Types
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  selection?: CellRange;
  cursor?: CellReference;
  lastActive: Date;
}

export interface CellChange {
  sheetId: string;
  row: number;
  col: number;
  oldValue: CellValue;
  newValue: CellValue;
  oldFormula?: string;
  newFormula?: string;
  userId: string;
  timestamp: Date;
}

// Version Types
export interface Version {
  id: string;
  spreadsheetId: string;
  name?: string;
  createdBy: string;
  createdAt: Date;
  changeCount: number;
}

// Comment Types
export interface Comment {
  id: string;
  spreadsheetId: string;
  sheetId: string;
  cellRef: CellReference;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
}

// AI Types
export interface AIFormulaRequest {
  prompt: string;
  context: {
    selectedRange?: CellRange;
    nearbyData?: CellValue[][];
    sheetName: string;
  };
}

export interface AIFormulaResponse {
  formula: string;
  explanation: string;
  confidence: number;
  alternatives?: string[];
}

export interface AIAutoFillRequest {
  range: CellRange;
  existingData: CellValue[][];
  direction: 'down' | 'right' | 'up' | 'left';
  count: number;
}

export interface AIAutoFillResponse {
  values: CellValue[][];
  pattern?: string;
}

// Utility Types
export function cellRefToKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function keyToCellRef(key: string): { row: number; col: number } {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}

export function colIndexToLetter(index: number): string {
  let result = '';
  let num = index + 1;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

export function letterToColIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function formatCellRef(row: number, col: number, absolute?: { row: boolean; col: boolean }): string {
  const colStr = absolute?.col ? `$${colIndexToLetter(col)}` : colIndexToLetter(col);
  const rowStr = absolute?.row ? `$${row + 1}` : `${row + 1}`;
  return `${colStr}${rowStr}`;
}
