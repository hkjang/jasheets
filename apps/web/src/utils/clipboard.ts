import { CellPosition, CellRange, SheetData } from '@/types/spreadsheet';

function quoteTsvField(value: string): string {
  return /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function serializeRangeToTsv(data: SheetData, range: CellRange): string {
  const rows: string[] = [];
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const startCol = Math.min(range.start.col, range.end.col);
  const endCol = Math.max(range.start.col, range.end.col);
  for (let row = startRow; row <= endRow; row++) {
    const fields: string[] = [];
    for (let col = startCol; col <= endCol; col++) {
      const cell = data[row]?.[col];
      fields.push(quoteTsvField(String(cell?.formula ?? cell?.value ?? '')));
    }
    rows.push(fields.join('\t'));
  }
  return rows.join('\n');
}

export function parseTsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === '\t') {
      rows[rows.length - 1].push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      rows[rows.length - 1].push(field);
      field = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
      rows.push([]);
    } else {
      field += char;
    }
  }
  rows[rows.length - 1].push(field);
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

export function createPasteUpdates(text: string, origin: CellPosition) {
  return parseTsv(text).flatMap((row, rowOffset) =>
    row.map((value, colOffset) => ({
      row: origin.row + rowOffset,
      col: origin.col + colOffset,
      value,
    })),
  );
}
