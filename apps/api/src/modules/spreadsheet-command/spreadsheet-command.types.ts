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

export interface ChangeStructureCommand {
  type: 'CHANGE_STRUCTURE';
  sheetId: string;
  axis: 'row' | 'column';
  operation: 'insert' | 'delete';
  index: number;
}

export type SpreadsheetCommand = SetCellsCommand | ChangeStructureCommand;
