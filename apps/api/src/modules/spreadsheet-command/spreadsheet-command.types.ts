export type SpreadsheetCommandActorType =
  'USER' | 'MCP' | 'AUTOMATION' | 'FLOW';

export interface SpreadsheetCommandContext {
  userId: string;
  actorType: SpreadsheetCommandActorType;
  correlationId?: string;
}

export interface SetCellsCommand {
  type: 'SET_CELLS';
  sheetId: string;
  updates: Array<{
    row: number;
    col: number;
    value?: unknown;
    formula?: string | null;
    format?: Record<string, unknown>;
  }>;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface WriteRangeCommand {
  type: 'WRITE_RANGE';
  sheetId: string;
  startRow: number;
  startCol: number;
  values: unknown[][];
  formulas?: Array<Array<string | null>>;
  expectedVersion?: number;
  idempotencyKey: string;
}

export interface AppendRowsCommand {
  type: 'APPEND_ROWS';
  sheetId: string;
  startCol?: number;
  values: unknown[][];
  formulas?: Array<Array<string | null>>;
  expectedVersion?: number;
  idempotencyKey: string;
}

export interface ApplyFormulaCommand {
  type: 'APPLY_FORMULA';
  sheetId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  formula: string;
  expectedVersion?: number;
  idempotencyKey: string;
}

export interface ChangeStructureCommand {
  type: 'CHANGE_STRUCTURE';
  sheetId: string;
  axis: 'row' | 'column';
  operation: 'insert' | 'delete';
  index: number;
}

export type SpreadsheetCommand =
  | SetCellsCommand
  | WriteRangeCommand
  | AppendRowsCommand
  | ApplyFormulaCommand
  | ChangeStructureCommand;
