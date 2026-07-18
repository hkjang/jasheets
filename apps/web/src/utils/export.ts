import * as XLSX from 'xlsx';
import { SheetData } from '@/types/spreadsheet';
import { normalizeHyperlinkUrl } from './hyperlink';

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
export function createXLSXWorksheet(data: SheetData): XLSX.WorkSheet {
  const rows = Object.keys(data).map(Number);
  if (rows.length === 0) return XLSX.utils.aoa_to_sheet([]);

  const maxRow = Math.max(...rows);
  let maxCol = 0;
  rows.forEach((row) => {
    const columns = Object.keys(data[row] ?? {}).map(Number);
    if (columns.length > 0) maxCol = Math.max(maxCol, ...columns);
  });

  const values = Array.from({ length: maxRow + 1 }, (_, row) =>
    Array.from(
      { length: maxCol + 1 },
      (_, column) => data[row]?.[column]?.value ?? '',
    ),
  );
  const worksheet = XLSX.utils.aoa_to_sheet(values);

  rows.forEach((row) => {
    Object.keys(data[row] ?? {}).map(Number).forEach((column) => {
      const sourceCell = data[row][column];
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const worksheetCell = worksheet[address];
      if (!worksheetCell) return;

      if (sourceCell.formula) {
        worksheetCell.f = sourceCell.formula.replace(/^=/, '');
      }

      const safeLink = sourceCell.link?.url
        ? normalizeHyperlinkUrl(sourceCell.link.url)
        : null;
      if (safeLink) {
        worksheetCell.l = { Target: safeLink };
      }
    });
  });

  return worksheet;
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
