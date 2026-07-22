import { normalizeHyperlinkUrl } from '@/utils/hyperlink';
import { CellData, CellPosition, CellRange, CellStyle, DataValidationRule, SheetData } from '@/types/spreadsheet';
import { shiftFormulaReferences } from '@jasheets/formula-engine';

export const JASHEETS_CLIPBOARD_MIME = 'application/x-jasheets-cells+json';
export const JASHEETS_CLIPBOARD_VERSION = 1;
const MAX_RICH_CLIPBOARD_BYTES = 1_000_000;
const MAX_RICH_CLIPBOARD_CELLS = 10_000;
const MAX_RICH_CLIPBOARD_DIMENSION = 1_000;

export interface RichClipboardPayload {
  version: 1;
  rows: number;
  cols: number;
  source: CellPosition;
  cells: Array<Array<RichClipboardCell | null>>;
}

export type RichClipboardCell = Pick<CellData, 'value' | 'formula' | 'style' | 'format' | 'validation' | 'link'>;

export interface RichPasteUpdate extends CellPosition {
  cell: RichClipboardCell;
}

const STYLE_KEYS = new Set<keyof CellStyle>([
  'backgroundColor', 'color', 'fontWeight', 'fontStyle', 'textDecoration',
  'fontSize', 'fontFamily', 'textAlign', 'verticalAlign',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function utf8Length(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length &&
             value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index++;
    } else bytes += 3;
    if (bytes > MAX_RICH_CLIPBOARD_BYTES) return bytes;
  }
  return bytes;
}

function sanitizeStyle(value: unknown): CellStyle | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !STYLE_KEYS.has(key as keyof CellStyle))) return undefined;
  const result: CellStyle = {};
  const stringKeys = ['backgroundColor', 'color', 'fontFamily'] as const;
  for (const key of stringKeys) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || value[key].length > 200) return undefined;
      result[key] = value[key];
    }
  }
  const enums = {
    fontWeight: ['normal', 'bold'], fontStyle: ['normal', 'italic'],
    textDecoration: ['none', 'underline', 'line-through'], textAlign: ['left', 'center', 'right'],
    verticalAlign: ['top', 'middle', 'bottom'],
  } as const;
  for (const key of Object.keys(enums) as Array<keyof typeof enums>) {
    const candidate = value[key];
    if (candidate !== undefined && !(enums[key] as readonly unknown[]).includes(candidate)) return undefined;
    if (candidate !== undefined) Object.assign(result, { [key]: candidate });
  }
  if (value.fontSize !== undefined) {
    if (typeof value.fontSize !== 'number' || !Number.isFinite(value.fontSize) || value.fontSize < 1 || value.fontSize > 512) return undefined;
    result.fontSize = value.fontSize;
  }
  return result;
}

function sanitizeValidation(value: unknown): DataValidationRule | undefined {
  if (!isRecord(value) || !['list', 'number', 'textLength'].includes(String(value.type))) return undefined;
  const allowBlank = value.allowBlank;
  if (allowBlank !== undefined && typeof allowBlank !== 'boolean') return undefined;
  if (value.type === 'list') {
    if (!Array.isArray(value.values) || value.values.length > 500 || value.values.some((item) => typeof item !== 'string' || item.length > 1_000)) return undefined;
    return { type: 'list', values: value.values, ...(allowBlank === undefined ? {} : { allowBlank }) };
  }
  const min = value.min;
  const max = value.max;
  if ((min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) ||
      (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max)))) return undefined;
  return {
    type: value.type,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(allowBlank === undefined ? {} : { allowBlank }),
  } as DataValidationRule;
}

function sanitizeRichCell(value: unknown): RichClipboardCell | null {
  if (!isRecord(value)) return null;
  const allowed = new Set(['value', 'formula', 'style', 'format', 'validation', 'link']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  const cellValue = value.value;
  if (cellValue !== null && typeof cellValue !== 'string' && typeof cellValue !== 'boolean' &&
      (typeof cellValue !== 'number' || !Number.isFinite(cellValue))) return null;
  if (typeof cellValue === 'string' && cellValue.length > 100_000) return null;
  if (value.formula !== undefined && (typeof value.formula !== 'string' || !value.formula.startsWith('=') || value.formula.length > 100_000)) return null;
  if (value.format !== undefined && (typeof value.format !== 'string' || value.format.length > 200)) return null;
  const style = value.style === undefined ? undefined : sanitizeStyle(value.style);
  if (value.style !== undefined && !style) return null;
  const validation = value.validation === undefined ? undefined : sanitizeValidation(value.validation);
  if (value.validation !== undefined && !validation) return null;
  let link: { url: string } | undefined;
  if (value.link !== undefined) {
    if (!isRecord(value.link) || typeof value.link.url !== 'string' || Object.keys(value.link).some((key) => key !== 'url')) return null;
    const url = normalizeHyperlinkUrl(value.link.url);
    if (!url) return null;
    link = { url };
  }
  return {
    value: cellValue,
    ...(value.formula === undefined ? {} : { formula: value.formula }),
    ...(style ? { style } : {}),
    ...(value.format === undefined ? {} : { format: value.format }),
    ...(validation ? { validation } : {}),
    ...(link ? { link } : {}),
  };
}

export function serializeRangeToRichClipboard(data: SheetData, range: CellRange): string | null {
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const startCol = Math.min(range.start.col, range.end.col);
  const endCol = Math.max(range.start.col, range.end.col);
  const rows = endRow - startRow + 1;
  const cols = endCol - startCol + 1;
  if (rows > MAX_RICH_CLIPBOARD_DIMENSION || cols > MAX_RICH_CLIPBOARD_DIMENSION || rows * cols > MAX_RICH_CLIPBOARD_CELLS) return null;
  let invalid = false;
  const cells = Array.from({ length: rows }, (_, rowOffset) =>
    Array.from({ length: cols }, (_, colOffset) => {
      const source = data[startRow + rowOffset]?.[startCol + colOffset];
      if (!source) return null;
      const cell = sanitizeRichCell({
        value: source.value,
        ...(source.formula ? { formula: source.formula } : {}),
        ...(source.style ? { style: source.style } : {}),
        ...(source.format ? { format: source.format } : {}),
        ...(source.validation ? { validation: source.validation } : {}),
        ...(source.link ? { link: source.link } : {}),
      });
      if (!cell) invalid = true;
      return cell;
    }),
  );
  if (invalid) return null;
  const json = JSON.stringify({
    version: JASHEETS_CLIPBOARD_VERSION,
    rows,
    cols,
    source: { row: startRow, col: startCol },
    cells,
  });
  return utf8Length(json) <= MAX_RICH_CLIPBOARD_BYTES ? json : null;
}

export function parseRichClipboard(text: string): RichClipboardPayload | null {
  if (!text || utf8Length(text) > MAX_RICH_CLIPBOARD_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || parsed.version !== JASHEETS_CLIPBOARD_VERSION ||
        !Number.isInteger(parsed.rows) || !Number.isInteger(parsed.cols)) return null;
    const rows = parsed.rows as number;
    const cols = parsed.cols as number;
    if (rows < 1 || cols < 1 || rows > MAX_RICH_CLIPBOARD_DIMENSION || cols > MAX_RICH_CLIPBOARD_DIMENSION || rows * cols > MAX_RICH_CLIPBOARD_CELLS) return null;
    if (!isRecord(parsed.source) || !Number.isInteger(parsed.source.row) ||
        !Number.isInteger(parsed.source.col) || Number(parsed.source.row) < 0 ||
        Number(parsed.source.col) < 0) return null;
    if (!Array.isArray(parsed.cells) || parsed.cells.length !== rows) return null;
    const cells: Array<Array<RichClipboardCell | null>> = [];
    for (const row of parsed.cells) {
      if (!Array.isArray(row) || row.length !== cols) return null;
      const sanitizedRow: Array<RichClipboardCell | null> = [];
      for (const rawCell of row) {
        if (rawCell === null) sanitizedRow.push(null);
        else {
          const cell = sanitizeRichCell(rawCell);
          if (!cell) return null;
          sanitizedRow.push(cell);
        }
      }
      cells.push(sanitizedRow);
    }
    return {
      version: 1,
      rows,
      cols,
      source: { row: Number(parsed.source.row), col: Number(parsed.source.col) },
      cells,
    };
  } catch {
    return null;
  }
}

export function createRichPasteUpdates(text: string, origin: CellPosition): RichPasteUpdate[] | null {
  const payload = parseRichClipboard(text);
  if (!payload) return null;
  return payload.cells.flatMap((row, rowOffset) => row.map((cell, colOffset) => {
    const targetRow = origin.row + rowOffset;
    const targetCol = origin.col + colOffset;
    const sourceRow = payload.source.row + rowOffset;
    const sourceCol = payload.source.col + colOffset;
    const copied = cell ?? { value: null };
    return {
      row: targetRow,
      col: targetCol,
      cell: copied.formula
        ? {
            ...copied,
            formula: shiftFormulaReferences(
              copied.formula,
              targetRow - sourceRow,
              targetCol - sourceCol,
            ),
          }
        : copied,
    };
  }));
}

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
  // Excel and exported TSV files can prefix the first cell with a UTF-8 BOM.
  // Treat it as transport metadata so formulas and values in that cell remain
  // identical to content pasted directly from another spreadsheet.
  const startIndex = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (let i = startIndex; i < text.length; i++) {
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
