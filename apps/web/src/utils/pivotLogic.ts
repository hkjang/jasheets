import { SheetData } from '@/types/spreadsheet';

export type PivotAggregation = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
export type PivotSortDirection = 'ASC' | 'DESC';
export type PivotFilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN'
  | 'IN'
  | 'IS_BLANK'
  | 'IS_NOT_BLANK';

type PivotValue = string | number | boolean | null | undefined;

export interface PivotFilter {
  field: string;
  operator: PivotFilterOperator;
  value?: PivotValue;
  values?: PivotValue[];
}

export interface PivotSort {
  direction: PivotSortDirection;
  /** LABEL sorts tuple labels. VALUE sorts their grand aggregate. */
  by?: 'LABEL' | 'VALUE';
  valueField?: string;
  aggregation?: PivotAggregation;
}

export interface PivotConfig {
  sourceRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  rows: string[];
  cols: string[];
  values: Array<{ field: string; aggregation: PivotAggregation }>;
  filters?: PivotFilter[];
  rowSort?: PivotSort;
  colSort?: PivotSort;
  /** Adds a Grand Total column (the total for each row tuple). */
  rowGrandTotals?: boolean;
  /** Adds a Grand Total row (the total for each column tuple). */
  columnGrandTotals?: boolean;
}

export interface PivotOutputDimensions {
  rowCount: number;
  columnCount: number;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
}

export interface PivotOutput {
  data: SheetData;
  dimensions: PivotOutputDimensions;
}

interface TupleKey {
  encoded: string;
  label: string;
}

type RecordValues = Record<string, PivotValue>;
type Bucket = Map<string, PivotValue[]>;

const BLANK_LABEL = '(blank)';
const ERROR_VALUE = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|ERROR!|CYCLE!)$/i;

function isBlank(value: PivotValue): boolean {
  return value === null || value === undefined || value === '';
}

function isError(value: PivotValue): boolean {
  return typeof value === 'string' && ERROR_VALUE.test(value.trim());
}

function tupleKey(values: PivotValue[]): TupleKey {
  const normalized = values.map((value) => (isBlank(value) ? null : value));
  return {
    // Type-preserving JSON arrays avoid delimiter and tuple-boundary collisions.
    encoded: JSON.stringify(normalized),
    label: normalized
      .map((value) => {
        if (value === null) return BLANK_LABEL;
        const label = String(value);
        return label.includes(' | ') ? JSON.stringify(label) : label;
      })
      .join(' | '),
  };
}

function aggregationKey(field: string, aggregation: PivotAggregation): string {
  return JSON.stringify([field, aggregation]);
}

function validateConfig(headers: string[], config: PivotConfig): void {
  const { sourceRange, rows, cols, values, filters = [] } = config;
  const coordinates = [
    sourceRange.startRow,
    sourceRange.startCol,
    sourceRange.endRow,
    sourceRange.endCol,
  ];
  if (
    coordinates.some((coordinate) => !Number.isInteger(coordinate) || coordinate < 0) ||
    sourceRange.startRow > sourceRange.endRow ||
    sourceRange.startCol > sourceRange.endCol
  ) {
    throw new Error('Invalid pivot source range');
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error('Pivot source headers must be unique');
  }
  if (values.length === 0) throw new Error('Pivot requires at least one value field');

  const headerSet = new Set(headers);
  for (const field of [
    ...rows,
    ...cols,
    ...values.map(({ field }) => field),
    ...filters.map(({ field }) => field),
  ]) {
    if (!headerSet.has(field)) throw new Error(`Unknown pivot field: ${field}`);
  }
  for (const sort of [config.rowSort, config.colSort]) {
    if (sort?.by === 'VALUE' && sort.valueField && !headerSet.has(sort.valueField)) {
      throw new Error(`Unknown pivot field: ${sort.valueField}`);
    }
  }
}

function compareValues(left: PivotValue, right: PivotValue): number {
  if (isBlank(left) && isBlank(right)) return 0;
  if (isBlank(left)) return -1;
  if (isBlank(right)) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function matchesFilter(value: PivotValue, filter: PivotFilter): boolean {
  const compare = (candidate: PivotValue) => compareValues(value, candidate);
  switch (filter.operator) {
    case 'EQUALS':
      return compare(filter.value) === 0;
    case 'NOT_EQUALS':
      return compare(filter.value) !== 0;
    case 'CONTAINS':
      return String(value ?? '').toLocaleLowerCase().includes(String(filter.value ?? '').toLocaleLowerCase());
    case 'NOT_CONTAINS':
      return !String(value ?? '').toLocaleLowerCase().includes(String(filter.value ?? '').toLocaleLowerCase());
    case 'GREATER_THAN':
      return compare(filter.value) > 0;
    case 'GREATER_THAN_OR_EQUAL':
      return compare(filter.value) >= 0;
    case 'LESS_THAN':
      return compare(filter.value) < 0;
    case 'LESS_THAN_OR_EQUAL':
      return compare(filter.value) <= 0;
    case 'BETWEEN': {
      const bounds = filter.values ?? [];
      return bounds.length >= 2 && compare(bounds[0]) >= 0 && compare(bounds[1]) <= 0;
    }
    case 'IN':
      return (filter.values ?? []).some((candidate) => compare(candidate) === 0);
    case 'IS_BLANK':
      return isBlank(value);
    case 'IS_NOT_BLANK':
      return !isBlank(value);
  }
}

function addRecord(bucket: Bucket, record: RecordValues, values: PivotConfig['values']): void {
  for (const value of values) {
    const key = aggregationKey(value.field, value.aggregation);
    const entries = bucket.get(key) ?? [];
    entries.push(record[value.field]);
    bucket.set(key, entries);
  }
}

function aggregate(values: PivotValue[], type: PivotAggregation): number {
  const usable = values.filter((value) => !isBlank(value) && !isError(value));
  const numbers = usable
    .map((value) => {
      if (typeof value === 'number') return value;
      // Keep compatibility with imported CSV/XLSX numeric strings, but do not
      // silently coerce booleans or whitespace into 1/0.
      if (typeof value === 'string' && value.trim() !== '') return Number(value);
      return Number.NaN;
    })
    .filter(Number.isFinite);

  switch (type) {
    case 'SUM':
      return numbers.reduce((sum, value) => sum + value, 0);
    case 'COUNT':
      return usable.length;
    case 'AVERAGE':
      return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
    case 'MIN':
      return numbers.length ? Math.min(...numbers) : 0;
    case 'MAX':
      return numbers.length ? Math.max(...numbers) : 0;
  }
}

function sortTuples(
  tuples: TupleKey[],
  sort: PivotSort | undefined,
  totals: Map<string, Bucket>,
  fallbackValue: PivotConfig['values'][number],
): TupleKey[] {
  const direction = sort?.direction === 'DESC' ? -1 : 1;
  const byValue = sort?.by === 'VALUE';
  const valueField = sort?.valueField ?? fallbackValue.field;
  const aggregation = sort?.aggregation ?? fallbackValue.aggregation;
  return tuples.sort((left, right) => {
    const comparison = byValue
      ? aggregate(totals.get(left.encoded)?.get(aggregationKey(valueField, aggregation)) ?? [], aggregation) -
        aggregate(totals.get(right.encoded)?.get(aggregationKey(valueField, aggregation)) ?? [], aggregation)
      : left.label.localeCompare(right.label, undefined, { numeric: true });
    // Stable, deterministic tie-breaker also distinguishes same visual label
    // with different underlying types.
    return direction * (comparison || left.encoded.localeCompare(right.encoded));
  });
}

/** Returns dimensions and an inclusive target range for clearing/replacing managed output. */
export function getPivotOutputDimensions(
  data: SheetData,
  startRow = 0,
  startCol = 0,
): PivotOutputDimensions {
  const rows = Object.keys(data).map(Number).filter(Number.isFinite);
  const rowCount = rows.length ? Math.max(...rows) + 1 : 0;
  const columnCount = rows.reduce((max, row) => {
    const cols = Object.keys(data[row] ?? {}).map(Number).filter(Number.isFinite);
    return Math.max(max, cols.length ? Math.max(...cols) + 1 : 0);
  }, 0);
  return {
    rowCount,
    columnCount,
    range: {
      startRow,
      startCol,
      endRow: rowCount ? startRow + rowCount - 1 : startRow - 1,
      endCol: columnCount ? startCol + columnCount - 1 : startCol - 1,
    },
  };
}

export function calculatePivotOutput(
  data: SheetData,
  config: PivotConfig,
  origin: { row: number; col: number } = { row: 0, col: 0 },
): PivotOutput {
  const { sourceRange, rows, cols, values, filters = [] } = config;
  const headers: string[] = [];
  for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
    headers.push(String(data[sourceRange.startRow]?.[col]?.value ?? `Col ${col}`));
  }
  validateConfig(headers, config);

  const records: RecordValues[] = [];
  for (let row = sourceRange.startRow + 1; row <= sourceRange.endRow; row++) {
    const record: RecordValues = {};
    let hasData = false;
    for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
      const cell = data[row]?.[col];
      const value = cell?.error
        ? (cell.error.startsWith('#') ? cell.error : `#${cell.error}`)
        : cell?.value;
      record[headers[col - sourceRange.startCol]] = value;
      if (!isBlank(value)) hasData = true;
    }
    if (hasData && filters.every((filter) => matchesFilter(record[filter.field], filter))) {
      records.push(record);
    }
  }

  const rowTuples = new Map<string, TupleKey>();
  const colTuples = new Map<string, TupleKey>();
  const buckets = new Map<string, Bucket>();
  const rowTotals = new Map<string, Bucket>();
  const colTotals = new Map<string, Bucket>();
  const allTotals: Bucket = new Map();

  for (const record of records) {
    const rowTuple = tupleKey(rows.map((field) => record[field]));
    const colTuple = cols.length ? tupleKey(cols.map((field) => record[field])) : { encoded: '[]', label: 'Total' };
    rowTuples.set(rowTuple.encoded, rowTuple);
    colTuples.set(colTuple.encoded, colTuple);

    const bucketKey = JSON.stringify([rowTuple.encoded, colTuple.encoded]);
    const bucket = buckets.get(bucketKey) ?? new Map();
    addRecord(bucket, record, values);
    buckets.set(bucketKey, bucket);

    const rowTotal = rowTotals.get(rowTuple.encoded) ?? new Map();
    addRecord(rowTotal, record, values);
    rowTotals.set(rowTuple.encoded, rowTotal);
    const colTotal = colTotals.get(colTuple.encoded) ?? new Map();
    addRecord(colTotal, record, values);
    colTotals.set(colTuple.encoded, colTotal);
    addRecord(allTotals, record, values);
  }

  const sortedRows = sortTuples([...rowTuples.values()], config.rowSort, rowTotals, values[0]);
  const sortedCols = sortTuples([...colTuples.values()], config.colSort, colTotals, values[0]);
  const result: SheetData = { 0: {} };
  result[0][0] = { value: rows.join(' / ') || 'Ref', style: { fontWeight: 'bold' } };

  const outputColumns: Array<{ tuple: TupleKey | null; valueIndex: number }> = [];
  for (const tuple of sortedCols) {
    values.forEach((value, valueIndex) => {
      outputColumns.push({ tuple, valueIndex });
      const label = values.length === 1 ? tuple.label : `${tuple.label} / ${value.field} (${value.aggregation})`;
      result[0][outputColumns.length] = { value: label, style: { fontWeight: 'bold', textAlign: 'center' } };
    });
  }
  if (config.rowGrandTotals && cols.length > 0) {
    values.forEach((value, valueIndex) => {
      outputColumns.push({ tuple: null, valueIndex });
      result[0][outputColumns.length] = {
        value: values.length === 1 ? 'Grand Total' : `Grand Total / ${value.field} (${value.aggregation})`,
        style: { fontWeight: 'bold', textAlign: 'center' },
      };
    });
  }

  sortedRows.forEach((rowTuple, rowIndex) => {
    const outputRow = rowIndex + 1;
    result[outputRow] = { 0: { value: rowTuple.label, style: { fontWeight: 'bold' } } };
    outputColumns.forEach(({ tuple: colTuple, valueIndex }, colIndex) => {
      const value = values[valueIndex];
      const bucket = colTuple
        ? buckets.get(JSON.stringify([rowTuple.encoded, colTuple.encoded]))
        : rowTotals.get(rowTuple.encoded);
      const rawValues = bucket?.get(aggregationKey(value.field, value.aggregation)) ?? [];
      result[outputRow][colIndex + 1] = { value: bucket ? aggregate(rawValues, value.aggregation) : null };
    });
  });

  if (config.columnGrandTotals && rows.length > 0) {
    const outputRow = sortedRows.length + 1;
    result[outputRow] = { 0: { value: 'Grand Total', style: { fontWeight: 'bold' } } };
    outputColumns.forEach(({ tuple: colTuple, valueIndex }, colIndex) => {
      const value = values[valueIndex];
      const bucket = colTuple ? colTotals.get(colTuple.encoded) : allTotals;
      result[outputRow][colIndex + 1] = {
        value: aggregate(bucket?.get(aggregationKey(value.field, value.aggregation)) ?? [], value.aggregation),
        style: { fontWeight: 'bold' },
      };
    });
  }

  return { data: result, dimensions: getPivotOutputDimensions(result, origin.row, origin.col) };
}

/** Backwards-compatible data-only API. */
export function calculatePivotData(data: SheetData, config: PivotConfig): SheetData {
  return calculatePivotOutput(data, config).data;
}
