/**
 * File Import Utilities for JaSheets
 * Supports: xlsx, xls, csv file parsing and conversion to SheetData format
 */

import * as XLSX from 'xlsx';
import { SheetData, CellData } from '@/types/spreadsheet';
import { dateToSerial } from './dateSerial';
import { normalizeHyperlinkUrl } from './hyperlink';
import type { MergedRange } from './mergedRanges';
import { serializeCellFormat } from './cellPersistence';
import type { WorkbookImportPayload } from '@/lib/api';

export interface ImportedSheet {
  name: string;
  data: SheetData;
  mergedRanges: MergedRange[];
  rows: Record<number, { height: number; hidden?: boolean }>;
  columns: Record<number, { width: number; hidden?: boolean }>;
}

export interface ImportedWorkbook {
  sheets: ImportedSheet[];
}

export interface ImportResult {
  data: SheetData;
  sheetName: string;
  sheetNames: string[];
  /** Complete workbook payload. Legacy consumers can continue using `data`. */
  workbook?: ImportedWorkbook;
}

export function createWorkbookImportSheets(
  result: ImportResult,
): WorkbookImportPayload['sheets'] {
  const importedSheets = result.workbook?.sheets ?? [{
    name: result.sheetName,
    data: result.data,
    mergedRanges: [],
    rows: {},
    columns: {},
  }];

  return importedSheets.map((sheet) => {
    const cells = (Object.entries(sheet.data) as Array<[string, SheetData[number]]>).flatMap(([row, rowData]) =>
      (Object.entries(rowData) as Array<[string, CellData]>).map(([col, cell]) => {
        const format = serializeCellFormat(cell);
        return {
          row: Number(row),
          col: Number(col),
          value: cell.value,
          formula: cell.formula ?? null,
          ...(format ? { format: { ...format } } : {}),
        };
      }),
    );
    const rowIndexes = [
      ...cells.map(({ row }) => row),
      ...Object.keys(sheet.rows).map(Number),
      ...sheet.mergedRanges.flatMap(({ startRow, endRow }) => [startRow, endRow]),
    ];
    const colIndexes = [
      ...cells.map(({ col }) => col),
      ...Object.keys(sheet.columns).map(Number),
      ...sheet.mergedRanges.flatMap(({ startCol, endCol }) => [startCol, endCol]),
    ];
    return {
      name: sheet.name.trim() || 'Sheet',
      rowCount: Math.max(1000, (rowIndexes.length ? Math.max(...rowIndexes) : -1) + 1),
      colCount: Math.max(26, (colIndexes.length ? Math.max(...colIndexes) : -1) + 1),
      frozenRows: 0,
      frozenCols: 0,
      defaultRowHeight: 25,
      defaultColWidth: 100,
      cells,
      rowMeta: Object.entries(sheet.rows).map(([row, meta]) => ({
        row: Number(row), height: meta.height, hidden: meta.hidden ?? false,
      })),
      colMeta: Object.entries(sheet.columns).map(([col, meta]) => ({
        col: Number(col), width: meta.width, hidden: meta.hidden ?? false,
      })),
      mergedRanges: sheet.mergedRanges.map(({ startRow, startCol, endRow, endCol }) => ({
        startRow, startCol, endRow, endCol,
      })),
    };
  });
}

// Keep client-side bounds aligned with the atomic server import contract so a
// workbook is rejected before expensive conversion instead of after upload.
const MAX_IMPORT_CELLS = 100_000;
const MAX_IMPORT_SHEETS = 50;
const MAX_IMPORT_MERGES = 10_000;
const MAX_EXCEL_ROW = 1_048_575;
const MAX_EXCEL_COLUMN = 16_383;
const CELL_ADDRESS_PATTERN = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/;

/**
 * Parse an XLSX/XLS file and convert to SheetData format
 * @param file - The file to parse
 * @param sheetIndex - Which sheet to parse (default: 0, first sheet)
 */
export async function parseXLSXFile(file: File, sheetIndex: number = 0): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellStyles: true,
          cellDates: true,
        });
        
        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          reject(new Error('No sheets found in file'));
          return;
        }
        if (sheetNames.length > MAX_IMPORT_SHEETS) {
          reject(new Error(`Workbook exceeds the ${MAX_IMPORT_SHEETS} sheet import limit`));
          return;
        }
        
        const targetSheetIndex = Math.max(0, Math.min(sheetIndex, sheetNames.length - 1));
        const sheetName = sheetNames[targetSheetIndex];
        const importedWorkbook = workBookToImportedWorkbook(workbook);
        const data = importedWorkbook.sheets[targetSheetIndex].data;
        
        resolve({
          data,
          sheetName,
          sheetNames,
          workbook: importedWorkbook,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse a CSV file and convert to SheetData format
 * Handles UTF-8 with BOM for Korean text
 */
export async function parseCSVFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        const data = csvTextToSheetData(text);
        
        resolve({
          data,
          sheetName: file.name.replace(/\.csv$/i, ''),
          sheetNames: [file.name.replace(/\.csv$/i, '')],
          workbook: {
            sheets: [{
              name: file.name.replace(/\.csv$/i, ''),
              data,
              mergedRanges: [],
              rows: {},
              columns: {},
            }],
          },
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Read as UTF-8 text
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Import a spreadsheet file based on its extension
 */
export async function importSpreadsheetFile(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSVFile(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file);
  } else {
    throw new Error(`Unsupported file format: ${fileName}`);
  }
}

/**
 * Convert XLSX worksheet to SheetData format
 */
export function workSheetToSheetData(worksheet: XLSX.WorkSheet): SheetData {
  const data: SheetData = {};
  const addresses = Object.keys(worksheet).filter((key) => key[0] !== '!');
  if (addresses.length > MAX_IMPORT_CELLS) {
    throw new Error(`Workbook sheet exceeds the ${MAX_IMPORT_CELLS.toLocaleString()} cell import limit`);
  }

  for (const cellAddress of addresses) {
    const match = CELL_ADDRESS_PATTERN.exec(cellAddress);
    if (!match) continue;
    const position = XLSX.utils.decode_cell(cellAddress);
    if (position.r > MAX_EXCEL_ROW || position.c > MAX_EXCEL_COLUMN) continue;
    const row = position.r;
    const col = position.c;
    const cell = worksheet[cellAddress];
    if (cell) {
        if (!data[row]) {
          data[row] = {};
        }
        
        const importedDate = cell.v instanceof Date;
        const cellData: CellData = {
          // SheetJS returns Date objects when cellDates is enabled, but Date is
          // not a valid persisted CellValue. Keep spreadsheet arithmetic intact
          // by storing the same day-based serial used by the formula engine.
          value: importedDate ? dateToSerial(cell.v) : (cell.v ?? null),
        };

        if (importedDate) {
          cellData.format = isTimeOnlyFormat(cell.z) ? 'time' : 'date';
        } else if (typeof cell.z === 'string' && cell.z !== 'General') {
          cellData.format = cell.z;
        }
        
        // Preserve formula if present
        if (cell.f) {
          cellData.formula = `=${cell.f}`;
        }
        
        // Basic style extraction
        if (cell.s) {
          const style = extractCellStyle(cell.s);
          if (Object.keys(style).length > 0) cellData.style = style;
        }

        // SheetJS exposes external hyperlinks through the cell's `l.Target`
        // metadata. Never persist executable or otherwise unsupported schemes
        // from an untrusted workbook.
        const safeLink = cell.l?.Target
          ? normalizeHyperlinkUrl(cell.l.Target)
          : null;
        if (safeLink) {
          cellData.link = { url: safeLink };
        }
        
        data[row][col] = cellData;
    }
  }
  
  return data;
}

export function workSheetToImportedSheet(
  name: string,
  worksheet: XLSX.WorkSheet,
): ImportedSheet {
  const sourceMerges = worksheet['!merges'] ?? [];
  if (sourceMerges.length > MAX_IMPORT_MERGES) {
    throw new Error(`Workbook sheet exceeds the ${MAX_IMPORT_MERGES.toLocaleString()} merge import limit`);
  }
  const mergedRanges = sourceMerges.flatMap((range) => {
    if (
      range.s.r < 0 || range.s.c < 0 || range.e.r < range.s.r || range.e.c < range.s.c ||
      range.e.r > MAX_EXCEL_ROW || range.e.c > MAX_EXCEL_COLUMN
    ) return [];
    return [{
      startRow: range.s.r,
      endRow: range.e.r,
      startCol: range.s.c,
      endCol: range.e.c,
    }];
  });

  const rows: ImportedSheet['rows'] = {};
  (worksheet['!rows'] ?? []).forEach((row, index) => {
    if (!row || index > MAX_EXCEL_ROW) return;
    const height = row.hpx ?? (row.hpt == null ? undefined : row.hpt * (96 / 72));
    if (height != null || row.hidden) rows[index] = {
      height: height == null ? 25 : Math.min(400, Math.max(20, Math.round(height))),
      ...(row.hidden ? { hidden: true } : {}),
    };
  });

  const columns: ImportedSheet['columns'] = {};
  (worksheet['!cols'] ?? []).forEach((column, index) => {
    if (!column || index > MAX_EXCEL_COLUMN) return;
    const width = column.wpx ?? (column.width == null ? undefined : column.width * 7);
    if (width != null || column.hidden) columns[index] = {
      width: width == null ? 100 : Math.min(500, Math.max(30, Math.round(width))),
      ...(column.hidden ? { hidden: true } : {}),
    };
  });

  return { name, data: workSheetToSheetData(worksheet), mergedRanges, rows, columns };
}

export function workBookToImportedWorkbook(workbook: XLSX.WorkBook): ImportedWorkbook {
  if (workbook.SheetNames.length === 0) throw new Error('No sheets found in file');
  if (workbook.SheetNames.length > MAX_IMPORT_SHEETS) {
    throw new Error(`Workbook exceeds the ${MAX_IMPORT_SHEETS} sheet import limit`);
  }
  return {
    sheets: workbook.SheetNames.map((name) => {
      const worksheet = workbook.Sheets[name];
      if (!worksheet) throw new Error(`Workbook is missing worksheet data for "${name}"`);
      return workSheetToImportedSheet(name, worksheet);
    }),
  };
}

function isTimeOnlyFormat(numberFormat: XLSX.NumberFormat | undefined): boolean {
  if (typeof numberFormat !== 'string' || numberFormat.length === 0) return false;

  // Ignore quoted literals and escaped characters before checking Excel's
  // date/time format tokens. Formats containing a year or day are dates even
  // when they also show a time (for example, "yyyy-mm-dd hh:mm").
  const format = numberFormat
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .toLowerCase();
  const hasTime = /[hs]/.test(format);
  const hasDate = /[yd]/.test(format);

  return hasTime && !hasDate;
}

/**
 * Parse CSV text to SheetData format
 */
export function csvTextToSheetData(text: string): SheetData {
  const data: SheetData = {};
  const rows = parseCSVRows(text);

  rows.forEach((values, rowIndex) => {
    if (values.length === 1 && values[0].trim() === '') return;
    
    values.forEach((value, colIndex) => {
      if (!data[rowIndex]) {
        data[rowIndex] = {};
      }
      
      // Try to parse as number
      const trimmed = value.trim();
      let parsedValue: string | number | boolean | null = trimmed;
      
      if (trimmed === '') {
        parsedValue = null;
      } else if (trimmed.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (trimmed.toLowerCase() === 'false') {
        parsedValue = false;
      } else {
        const num = Number(trimmed.replace(/,/g, ''));
        if (!isNaN(num) && trimmed !== '') {
          parsedValue = num;
        }
      }
      
      data[rowIndex][colIndex] = { value: parsedValue };
    });
  });
  
  return data;
}

/**
 * Parse complete CSV records. A quoted field may contain commas, escaped
 * quotes, and line breaks, so splitting the input into lines first is lossy.
 */
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const finishRow = () => {
    row.push(current);
    rows.push(row);
    row = [];
    current = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n' || char === '\r') {
        finishRow();
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        current += char;
      }
    }
  }

  if (inQuotes) {
    throw new Error('Invalid CSV: unclosed quoted field');
  }

  // A final record separator does not create an extra spreadsheet row.
  if (current !== '' || row.length > 0 || rows.length === 0) {
    finishRow();
  }

  return rows;
}

/**
 * Extract basic cell styles from XLSX cell style object
 */
interface ImportedCellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    sz?: number;
    name?: string;
    color?: { rgb?: string };
  };
  fill?: { fgColor?: { rgb?: string } };
  alignment?: { horizontal?: string; vertical?: string };
}

function normalizeRgbColor(rgb: string): string {
  const normalized = rgb.replace(/^#/, '');
  // OOXML colors commonly include an alpha byte (FFRRGGBB).
  return `#${normalized.length === 8 ? normalized.slice(2) : normalized}`;
}

function extractCellStyle(xlsxStyle: ImportedCellStyle): NonNullable<CellData['style']> {
  const style: NonNullable<CellData['style']> = {};
  
  if (xlsxStyle.font) {
    if (xlsxStyle.font.bold) style.fontWeight = 'bold';
    if (xlsxStyle.font.italic) style.fontStyle = 'italic';
    if (xlsxStyle.font.underline) style.textDecoration = 'underline';
    if (xlsxStyle.font.strike) style.textDecoration = 'line-through';
    if (xlsxStyle.font.sz) style.fontSize = xlsxStyle.font.sz;
    if (xlsxStyle.font.name) style.fontFamily = xlsxStyle.font.name;
    if (xlsxStyle.font.color?.rgb) {
      style.color = normalizeRgbColor(xlsxStyle.font.color.rgb);
    }
  }
  
  if (xlsxStyle.fill?.fgColor?.rgb) {
    style.backgroundColor = normalizeRgbColor(xlsxStyle.fill.fgColor.rgb);
  }
  
  if (xlsxStyle.alignment) {
    if (xlsxStyle.alignment.horizontal) {
      const horizontal = xlsxStyle.alignment.horizontal;
      if (horizontal === 'left' || horizontal === 'center' || horizontal === 'right') {
        style.textAlign = horizontal;
      }
    }
    if (xlsxStyle.alignment.vertical) {
      const vertical = xlsxStyle.alignment.vertical === 'center'
        ? 'middle'
        : xlsxStyle.alignment.vertical;
      if (vertical === 'top' || vertical === 'middle' || vertical === 'bottom') {
        style.verticalAlign = vertical;
      }
    }
  }
  
  return style;
}

/**
 * Validate file before import
 */
export function validateImportFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '파일 크기가 10MB를 초과합니다.' };
  }
  
  // Check extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return { valid: false, error: '지원되지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)' };
  }
  
  return { valid: true };
}
