import type { PivotTableDto } from '../sheets/dto/pivot-table.dto';

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

export interface ExecuteChangeSetCommand {
  type: 'EXECUTE_CHANGE_SET';
  sheetId: string;
  updates: SetCellsCommand['updates'];
  expectedVersion: number;
  previewHash: string;
  idempotencyKey: string;
}

export interface RollbackRevisionCommand {
  type: 'ROLLBACK_REVISION';
  revisionId: string;
  sheetId?: string;
  expectedVersion: number;
  idempotencyKey: string;
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

export interface CreatePivotCommand {
  type: 'CREATE_PIVOT';
  sheetId: string;
  pivot: Omit<PivotTableDto, 'id'>;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface CreateChartCommand {
  type: 'CREATE_CHART';
  sheetId: string;
  chart: {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
    sourceRange: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    };
    x: number;
    y: number;
    width: number;
    height: number;
    options: {
      title?: string;
      showLegend?: boolean;
      horizontal?: boolean;
    };
  };
  expectedVersion: number;
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
  | ExecuteChangeSetCommand
  | RollbackRevisionCommand
  | WriteRangeCommand
  | AppendRowsCommand
  | ApplyFormulaCommand
  | CreatePivotCommand
  | CreateChartCommand
  | ChangeStructureCommand;
