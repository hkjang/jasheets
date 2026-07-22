import { SheetData } from '@/types/spreadsheet';

export type PivotAggregation = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';

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
}

type PivotValue = string | number | boolean | null | undefined;

interface TupleKey {
  encoded: string;
  label: string;
}

const BLANK_LABEL = '(blank)';

function tupleKey(values: PivotValue[]): TupleKey {
  const normalized = values.map((value) =>
    value === null || value === undefined || value === '' ? null : value,
  );
  return {
    // JSON encoding avoids collisions caused by joining values containing the
    // visual separator (for example ["A | B", "C"] and ["A", "B | C"]).
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

function validateConfig(headers: string[], config: PivotConfig): void {
  const { sourceRange, rows, cols, values } = config;
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
  for (const field of [...rows, ...cols, ...values.map(({ field }) => field)]) {
    if (!headerSet.has(field)) throw new Error(`Unknown pivot field: ${field}`);
  }
}

export function calculatePivotData(data: SheetData, config: PivotConfig): SheetData {
  const { sourceRange, rows, cols, values } = config;
  const headers: string[] = [];
  for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
    headers.push(String(data[sourceRange.startRow]?.[col]?.value ?? `Col ${col}`));
  }
  validateConfig(headers, config);

  const records: Record<string, PivotValue>[] = [];
  for (let row = sourceRange.startRow + 1; row <= sourceRange.endRow; row++) {
    const record: Record<string, PivotValue> = {};
    let hasData = false;
    for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
      const value = data[row]?.[col]?.value;
      record[headers[col - sourceRange.startCol]] = value;
      if (value !== null && value !== undefined && value !== '') hasData = true;
    }
    if (hasData) records.push(record);
  }

  const rowTuples = new Map<string, TupleKey>();
  const colTuples = new Map<string, TupleKey>();
  const buckets = new Map<string, Map<string, PivotValue[]>>();

  for (const record of records) {
    const rowTuple = tupleKey(rows.map((field) => record[field]));
    const colTuple = cols.length
      ? tupleKey(cols.map((field) => record[field]))
      : { encoded: '[]', label: 'Total' };
    rowTuples.set(rowTuple.encoded, rowTuple);
    colTuples.set(colTuple.encoded, colTuple);

    const bucketKey = JSON.stringify([rowTuple.encoded, colTuple.encoded]);
    const bucket = buckets.get(bucketKey) ?? new Map<string, PivotValue[]>();
    for (const value of values) {
      const aggregationKey = JSON.stringify([value.field, value.aggregation]);
      const entries = bucket.get(aggregationKey) ?? [];
      entries.push(record[value.field]);
      bucket.set(aggregationKey, entries);
    }
    buckets.set(bucketKey, bucket);
  }

  const sortedRows = [...rowTuples.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  const sortedCols = [...colTuples.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  const result: SheetData = { 0: {} };
  result[0][0] = {
    value: rows.join(' / ') || 'Ref',
    style: { fontWeight: 'bold' },
  };

  const outputColumns: Array<{ tuple: TupleKey; valueIndex: number }> = [];
  for (const tuple of sortedCols) {
    values.forEach((value, valueIndex) => {
      outputColumns.push({ tuple, valueIndex });
      const label =
        values.length === 1
          ? tuple.label
          : `${tuple.label} / ${value.field} (${value.aggregation})`;
      result[0][outputColumns.length] = {
        value: label,
        style: { fontWeight: 'bold', textAlign: 'center' },
      };
    });
  }

  sortedRows.forEach((rowTuple, rowIndex) => {
    const outputRow = rowIndex + 1;
    result[outputRow] = {
      0: { value: rowTuple.label, style: { fontWeight: 'bold' } },
    };
    outputColumns.forEach(({ tuple: colTuple, valueIndex }, colIndex) => {
      const value = values[valueIndex];
      const bucket = buckets.get(
        JSON.stringify([rowTuple.encoded, colTuple.encoded]),
      );
      const rawValues =
        bucket?.get(JSON.stringify([value.field, value.aggregation])) ?? [];
      result[outputRow][colIndex + 1] = {
        value: bucket ? aggregate(rawValues, value.aggregation) : null,
      };
    });
  });

  return result;
}

function aggregate(values: PivotValue[], type: PivotAggregation): number {
  const nonBlank = values.filter(
    (value) => value !== null && value !== undefined && value !== '',
  );
  const numbers = nonBlank
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter(Number.isFinite);

  switch (type) {
    case 'SUM':
      return numbers.reduce((sum, value) => sum + value, 0);
    case 'COUNT':
      return nonBlank.length;
    case 'AVERAGE':
      return numbers.length
        ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
        : 0;
    case 'MIN':
      return numbers.length ? Math.min(...numbers) : 0;
    case 'MAX':
      return numbers.length ? Math.max(...numbers) : 0;
  }
}
