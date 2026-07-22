import { CellRange, SheetData } from '@/types/spreadsheet';
import { shiftFormulaReferences } from '@jasheets/formula-engine';

export interface FillUpdate { row: number; col: number; value: string }

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(value: unknown): number | null {
  const match = String(value ?? '').match(ISO_DATE_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? timestamp
    : null;
}

function formatIsoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalize(range: CellRange): CellRange {
  return {
    start: { row: Math.min(range.start.row, range.end.row), col: Math.min(range.start.col, range.end.col) },
    end: { row: Math.max(range.start.row, range.end.row), col: Math.max(range.start.col, range.end.col) },
  };
}

export function createFillUpdates(data: SheetData, sourceRange: CellRange, targetRange: CellRange): FillUpdate[] {
  const source = normalize(sourceRange);
  const target = normalize(targetRange);
  const sourceRows = source.end.row - source.start.row + 1;
  const sourceCols = source.end.col - source.start.col + 1;
  const verticalSeries = sourceCols === 1 && sourceRows >= 2;
  const horizontalSeries = sourceRows === 1 && sourceCols >= 2;
  const singleCellFillsVertically = sourceRows === 1
    && sourceCols === 1
    && target.end.row - target.start.row > target.end.col - target.start.col;
  const first = Number(data[source.start.row]?.[source.start.col]?.value);
  const second = verticalSeries
    ? Number(data[source.start.row + 1]?.[source.start.col]?.value)
    : Number(data[source.start.row]?.[source.start.col + 1]?.value);
  const numericSeries = (verticalSeries || horizontalSeries) && Number.isFinite(first) && Number.isFinite(second);
  const step = second - first;
  const firstDate = parseIsoDate(data[source.start.row]?.[source.start.col]?.value);
  const secondDate = verticalSeries
    ? parseIsoDate(data[source.start.row + 1]?.[source.start.col]?.value)
    : horizontalSeries
      ? parseIsoDate(data[source.start.row]?.[source.start.col + 1]?.value)
      : null;
  const dateSeries = firstDate !== null && (
    (verticalSeries || horizontalSeries) ? secondDate !== null : sourceRows === 1 && sourceCols === 1
  );
  const dateBase = firstDate ?? 0;
  const dateStep = secondDate === null ? MILLISECONDS_PER_DAY : secondDate - dateBase;
  const updates: FillUpdate[] = [];

  for (let row = target.start.row; row <= target.end.row; row++) {
    for (let col = target.start.col; col <= target.end.col; col++) {
      if (row >= source.start.row && row <= source.end.row && col >= source.start.col && col <= source.end.col) continue;
      const sourceRow = source.start.row + ((row - source.start.row) % sourceRows + sourceRows) % sourceRows;
      const sourceCol = source.start.col + ((col - source.start.col) % sourceCols + sourceCols) % sourceCols;
      const sourceCell = data[sourceRow]?.[sourceCol];
      let value = String(sourceCell?.value ?? '');
      if (sourceCell?.formula) {
        value = shiftFormulaReferences(sourceCell.formula, row - sourceRow, col - sourceCol);
      } else if (dateSeries) {
        const index = verticalSeries || singleCellFillsVertically
          ? row - source.start.row
          : col - source.start.col;
        value = formatIsoDate(dateBase + dateStep * index);
      } else if (numericSeries) {
        const index = verticalSeries ? row - source.start.row : col - source.start.col;
        value = String(first + step * index);
      }
      updates.push({ row, col, value });
    }
  }
  return updates;
}
