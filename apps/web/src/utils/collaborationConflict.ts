import { SheetData } from '@/types/spreadsheet';
import type { PersistedCellFormat } from '@/utils/cellPersistence';
import { deserializeCellFormat } from '@/utils/cellPersistence';
import { normalizeHyperlinkUrl } from '@/utils/hyperlink';

export interface CollaborationCellOperation {
  sheetId: string;
  row: number;
  col: number;
  value: unknown;
  formula?: string;
  format?: PersistedCellFormat | null;
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

  let formatPatch = {};
  if (operation.format === null) {
    formatPatch = {
      style: undefined,
      format: undefined,
      validation: undefined,
      link: undefined,
    };
  } else if (operation.format !== undefined) {
    const deserialized = deserializeCellFormat(operation.format);
    if ('link' in operation.format) {
      const normalizedUrl = typeof operation.format.link?.url === 'string'
        ? normalizeHyperlinkUrl(operation.format.link.url)
        : null;
      deserialized.link = normalizedUrl ? { url: normalizedUrl } : undefined;
    }
    formatPatch = deserialized;
  }

  return {
    ...data,
    [operation.row]: {
      ...data[operation.row],
      [operation.col]: {
        ...data[operation.row]?.[operation.col],
        value: operation.value as string | number | boolean | null,
        formula: operation.formula,
        ...formatPatch,
      },
    },
  };
}
