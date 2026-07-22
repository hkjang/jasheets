import * as XLSX from 'xlsx';
import { CellData, RowData, SheetData } from '@/types/spreadsheet';
import { normalizeHyperlinkUrl } from './hyperlink';
import type { ImportedSheet } from './fileImport';
import { rewriteSheetNameReferences } from './formulaReferences';

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const UTF8_BOM = '\uFEFF';

function escapeCSVValue(value: unknown): string {
  if (value === undefined || value === null) return '';

  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function createCSVContent(data: SheetData): string | null {
  const rows = Object.keys(data).map(Number);
  if (rows.length === 0) return null;

  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  let maxCol = 0;

  rows.forEach((row) => {
    const columns = Object.keys(data[row] ?? {}).map(Number);
    if (columns.length > 0) {
      maxCol = Math.max(maxCol, Math.max(...columns));
    }
  });

  const csvRows: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    const values: string[] = [];
    for (let column = 0; column <= maxCol; column++) {
      values.push(escapeCSVValue(data[row]?.[column]?.value));
    }
    csvRows.push(values.join(','));
  }

  return `${UTF8_BOM}${csvRows.join('\r\n')}\r\n`;
}

/**
 * Convert application cell data to a SheetJS worksheet without losing safe
 * hyperlink metadata. This is kept separate from the browser download so it
 * can be covered without filesystem or DOM side effects.
 */
export interface XLSXSheetExportOptions {
  mergedRanges?: ImportedSheet['mergedRanges'];
  rows?: ImportedSheet['rows'];
  columns?: ImportedSheet['columns'];
}

export interface XLSXWorkbookSheet extends XLSXSheetExportOptions {
  name: string;
  data: SheetData;
}

export function createXLSXWorksheet(
  data: SheetData,
  options: XLSXSheetExportOptions = {},
): XLSX.WorkSheet {
  const worksheet: XLSX.WorkSheet = {};
  let range: XLSX.Range | undefined;
  const includePosition = (row: number, column: number) => {
    if (!range) {
      range = { s: { r: row, c: column }, e: { r: row, c: column } };
      return;
    }
    range.s.r = Math.min(range.s.r, row);
    range.s.c = Math.min(range.s.c, column);
    range.e.r = Math.max(range.e.r, row);
    range.e.c = Math.max(range.e.c, column);
  };

  Object.keys(data).map(Number).forEach((row) => {
    Object.keys(data[row] ?? {}).map(Number).forEach((column) => {
      const sourceCell = data[row][column];
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const worksheetCell = toXLSXCell(sourceCell.value);
      worksheet[address] = worksheetCell;
      includePosition(row, column);

      if (sourceCell.formula) {
        worksheetCell.f = sourceCell.formula.replace(/^=/, '');
      }

      if (sourceCell.format) {
        worksheetCell.z = toXLSXNumberFormat(sourceCell.format);
      }

      if (sourceCell.style) {
        worksheetCell.s = toXLSXCellStyle(sourceCell.style);
      }

      const safeLink = sourceCell.link?.url
        ? normalizeHyperlinkUrl(sourceCell.link.url)
        : null;
      if (safeLink) {
        worksheetCell.l = { Target: safeLink };
      }
    });
  });

  worksheet['!merges'] = (options.mergedRanges ?? []).map((range) => ({
    s: { r: range.startRow, c: range.startCol },
    e: { r: range.endRow, c: range.endCol },
  }));
  (options.mergedRanges ?? []).forEach((mergedRange) => {
    includePosition(mergedRange.startRow, mergedRange.startCol);
    includePosition(mergedRange.endRow, mergedRange.endCol);
  });
  if (range) worksheet['!ref'] = XLSX.utils.encode_range(range);
  worksheet['!rows'] = sparseAxisMetadata(options.rows, (row) => ({
    hpx: row.height,
    ...(row.hidden ? { hidden: true } : {}),
  }));
  worksheet['!cols'] = sparseAxisMetadata(options.columns, (column) => ({
    wpx: column.width,
    ...(column.hidden ? { hidden: true } : {}),
  }));

  return worksheet;
}

function toXLSXCell(value: SheetData[number][number]['value']): XLSX.CellObject {
  if (value === null) return { t: 'z', v: undefined } as XLSX.CellObject;
  if (typeof value === 'number') return { t: 'n', v: value };
  if (typeof value === 'boolean') return { t: 'b', v: value };
  return { t: 's', v: value };
}

function sparseAxisMetadata<T, U>(
  source: Record<number, T> | undefined,
  convert: (value: T) => U,
): U[] | undefined {
  if (!source) return undefined;
  const indexes = Object.keys(source).map(Number).filter((index) => Number.isInteger(index) && index >= 0);
  if (indexes.length === 0) return undefined;
  const result: U[] = [];
  indexes.forEach((index) => { result[index] = convert(source[index]); });
  return result;
}

function toXLSXNumberFormat(format: string): string {
  if (format === 'date') return 'yyyy-mm-dd';
  if (format === 'time') return 'hh:mm:ss';
  if (format === 'currency') return '$#,##0.00';
  if (format === 'percent') return '0.00%';
  return format;
}

interface ExportedXLSXStyle {
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
}

function toXLSXCellStyle(style: NonNullable<SheetData[number][number]['style']>): ExportedXLSXStyle {
  const result: ExportedXLSXStyle = {};
  if (style.fontWeight || style.fontStyle || style.textDecoration || style.color || style.fontSize || style.fontFamily) {
    result.font = {
      ...(style.fontWeight === 'bold' ? { bold: true } : {}),
      ...(style.fontStyle === 'italic' ? { italic: true } : {}),
      ...(style.textDecoration === 'underline' ? { underline: true } : {}),
      ...(style.textDecoration === 'line-through' ? { strike: true } : {}),
      ...(style.color ? { color: { rgb: style.color.replace(/^#/, '').toUpperCase() } } : {}),
      ...(style.fontSize ? { sz: style.fontSize } : {}),
      ...(style.fontFamily ? { name: style.fontFamily } : {}),
    };
  }
  if (style.backgroundColor) {
    result.fill = { patternType: 'solid', fgColor: { rgb: style.backgroundColor.replace(/^#/, '').toUpperCase() } };
  }
  if (style.textAlign || style.verticalAlign) {
    result.alignment = {
      ...(style.textAlign ? { horizontal: style.textAlign } : {}),
      ...(style.verticalAlign ? { vertical: style.verticalAlign === 'middle' ? 'center' : style.verticalAlign } : {}),
    };
  }
  return result;
}

export function createXLSXWorkbook(sheets: readonly XLSXWorkbookSheet[]): XLSX.WorkBook {
  if (sheets.length === 0) throw new Error('At least one sheet is required');
  const workbook = XLSX.utils.book_new();
  const names = createExcelSafeSheetNames(sheets.map(({ name }) => name));
  const mapping = new Map(sheets.map((sheet, index) => [sheet.name, names[index]]));
  sheets.forEach((sheet, index) => {
    XLSX.utils.book_append_sheet(
      workbook,
      createXLSXWorksheet(rewriteExportedSheetReferences(sheet.data, mapping), sheet),
      names[index],
    );
  });
  return workbook;
}

export function createExcelSafeSheetNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((source, index) => {
    const base = source.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet ${index + 1}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      const ending = ` (${suffix++})`;
      candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
    }
    used.add(candidate.toLocaleLowerCase());
    return candidate;
  });
}

function rewriteExportedSheetReferences(
  data: SheetData,
  names: ReadonlyMap<string, string>,
): SheetData {
  const replacements = [...names.entries()]
    .filter(([source, replacement]) => source !== replacement)
    .map(([source, replacement], index) => ({
      source,
      replacement,
      placeholder: `__JASHEETS_EXPORT_${index}_${source.length}__`,
    }));
  if (replacements.length === 0) return data;
  return Object.fromEntries((Object.entries(data) as [string, RowData][]).map(([row, rowData]) => [
    row,
    Object.fromEntries((Object.entries(rowData) as [string, CellData][]).map(([col, cell]) => {
      if (!cell.formula) return [col, cell];
      let formula = cell.formula;
      replacements.forEach(({ source, placeholder }) => {
        formula = rewriteSheetNameReferences(formula, source, placeholder);
      });
      replacements.forEach(({ placeholder, replacement }) => {
        formula = rewriteSheetNameReferences(formula, placeholder, replacement);
      });
      return [col, formula === cell.formula ? cell : { ...cell, formula }];
    })),
  ])) as SheetData;
}

export function exportToCSV(
  data: SheetData,
  filename: string = 'spreadsheet.csv',
): void {
  const csvContent = createCSVContent(data);
  if (csvContent === null) return;

  const blob = new Blob([csvContent], { type: CSV_MIME_TYPE });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    // Keep the object URL alive until the browser has consumed the click event.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
