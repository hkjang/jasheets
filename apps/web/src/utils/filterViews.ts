import { CellValue, ColumnDef, RowDef, SheetData } from '@/types/spreadsheet';

export interface FilterCondition {
  column: number;
  operator: string;
  value: unknown;
}

export function matchesFilter(value: CellValue, filter: FilterCondition): boolean {
  const expected = filter.value;
  switch (filter.operator) {
    case 'equals': return value === expected;
    case 'notEquals': return value !== expected;
    case 'contains': return String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'notContains': return !String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'startsWith': return String(value ?? '').toLowerCase().startsWith(String(expected ?? '').toLowerCase());
    case 'endsWith': return String(value ?? '').toLowerCase().endsWith(String(expected ?? '').toLowerCase());
    case 'greaterThan': return Number(value) > Number(expected);
    case 'greaterThanOrEqual': return Number(value) >= Number(expected);
    case 'lessThan': return Number(value) < Number(expected);
    case 'lessThanOrEqual': return Number(value) <= Number(expected);
    case 'isEmpty': return value === null || value === '';
    case 'isNotEmpty': return value !== null && value !== '';
    case 'between':
      return Array.isArray(expected)
        && expected.length === 2
        && Number(value) >= Number(expected[0])
        && Number(value) <= Number(expected[1]);
    default: return true;
  }
}

export function getHiddenRowsForFilterView(data: SheetData, filters: FilterCondition[]): number[] {
  return Object.keys(data).map(Number).filter((row) =>
    !filters.every((filter) => matchesFilter(data[row]?.[filter.column]?.value ?? null, filter)),
  );
}

/** Adds private filter visibility without changing persisted axis metadata. */
export function projectFilterViewAxes(
  rows: readonly RowDef[],
  columns: readonly ColumnDef[],
  profileHiddenRows: ReadonlySet<number>,
  profileHiddenColumns: ReadonlySet<number>,
): { rows: RowDef[]; columns: ColumnDef[] } {
  return {
    rows: rows.map((row, index) => profileHiddenRows.has(index)
      ? { ...row, hidden: true }
      : row),
    columns: columns.map((column, index) => profileHiddenColumns.has(index)
      ? { ...column, hidden: true }
      : column),
  };
}
