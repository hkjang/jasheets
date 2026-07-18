import { SheetData } from '@/types/spreadsheet';

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
