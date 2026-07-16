import { SheetData } from '@/types/spreadsheet';

export interface CollaborationCellOperation {
  sheetId: string;
  row: number;
  col: number;
  value: unknown;
  formula?: string;
  sequence?: number;
}

export function applyCollaborationOperation(
  data: SheetData,
  operation: CollaborationCellOperation,
  cellSequences: Map<string, number>,
): SheetData {
  const key = `${operation.sheetId}:${operation.row}:${operation.col}`;
  const currentSequence = cellSequences.get(key) ?? -1;
  const incomingSequence = operation.sequence ?? currentSequence + 1;
  if (incomingSequence <= currentSequence) return data;
  cellSequences.set(key, incomingSequence);

  return {
    ...data,
    [operation.row]: {
      ...data[operation.row],
      [operation.col]: {
        ...data[operation.row]?.[operation.col],
        value: operation.value as string | number | boolean | null,
        formula: operation.formula,
      },
    },
  };
}
