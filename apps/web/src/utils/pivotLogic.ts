
import { SheetData, CellData } from '@/types/spreadsheet';

export interface PivotConfig {
  sourceRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  rows: string[]; // Header names for row grouping
  cols: string[]; // Header names for col grouping
  values: {
    field: string;
    aggregation: 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
  }[];
}

interface PivotNode {
  key: string;
  children: Map<string, PivotNode>;
  values: any[]; // Raw values for aggregation
}

export function calculatePivotData(data: SheetData, config: PivotConfig): SheetData {
  const { sourceRange, rows, cols, values } = config;
  const result: SheetData = {};

  // 1. Extract Data
  const headers: string[] = [];
  const startRow = sourceRange.startRow;
  const startCol = sourceRange.startCol;

  // Read headers
  for (let c = startCol; c <= sourceRange.endCol; c++) {
    const val = data[startRow]?.[c]?.value;
    headers.push(String(val ?? `Col ${c}`));
  }

  const rawData: Record<string, any>[] = [];
  for (let r = startRow + 1; r <= sourceRange.endRow; r++) {
    const rowObj: Record<string, any> = {};
    let hasData = false;
    for (let c = startCol; c <= sourceRange.endCol; c++) {
      const header = headers[c - startCol];
      const val = data[r]?.[c]?.value;
      rowObj[header] = val;
      if (val !== null && val !== undefined && val !== '') hasData = true;
    }
    if (hasData) rawData.push(rowObj);
  }

  // 2. Group Data
  // This is a simplified implementation. A full pivot table supports nested rows/cols.
  // For MVP, we'll support 1 row dimension and 1 column dimension effectively,
  // or just flat grouping.

  // Let's implement a map-based aggregation.
  // Key format: "RowVal1|RowVal2...||ColVal1|ColVal2..."
  
  const aggregationMap = new Map<string, Record<string, any[]>>();
  const rowKeysSet = new Set<string>();
  const colKeysSet = new Set<string>();

  rawData.forEach(row => {
    const rowKeyParts = rows.map(field => String(row[field] ?? '(blank)'));
    const colKeyParts = cols.map(field => String(row[field] ?? ''));
    
    // For MVP, if no col field, we use a single key for col
    const rowKey = rowKeyParts.join(' | ');
    const colKey = cols.length > 0 ? colKeyParts.join(' | ') : 'Total';

    rowKeysSet.add(rowKey);
    colKeysSet.add(colKey);

    const key = `${rowKey}||${colKey}`;
    
    let aggBucket = aggregationMap.get(key);
    if (!aggBucket) {
      aggBucket = {};
      values.forEach(v => aggBucket![v.field] = []);
      aggregationMap.set(key, aggBucket);
    }

    values.forEach(v => {
      aggBucket![v.field].push(row[v.field]);
    });
  });

  const sortedRowKeys = Array.from(rowKeysSet).sort();
  const sortedColKeys = Array.from(colKeysSet).sort();

  // 3. Construct Output Table

  // Metadata for rendering
  let currentRow = 0;
  let currentCol = 0;

  // Write Column Headers
  // Top-left corner (Row Headers)
  result[currentRow] = {};
  result[currentRow][currentCol] = { value: rows.join(' / ') || 'Ref', style: { fontWeight: 'bold' } };

  // Column Headers
  sortedColKeys.forEach((colKey, index) => {
    const targetCol = currentCol + 1 + index; // +1 for row labels column
    if (!result[currentRow]) result[currentRow] = {};
    result[currentRow][targetCol] = { value: colKey, style: { fontWeight: 'bold', textAlign: 'center' } };
  });

  currentRow++;

  // Write Data Rows
  sortedRowKeys.forEach(rowKey => {
    result[currentRow] = {};
    // Row Label
    result[currentRow][currentCol] = { value: rowKey, style: { fontWeight: 'bold' } };

    sortedColKeys.forEach((colKey, colIndex) => {
      const targetCol = currentCol + 1 + colIndex;
      const key = `${rowKey}||${colKey}`;
      const bucket = aggregationMap.get(key);

      if (bucket) {
        // Aggregate
        // Assuming single value field for simplicity in MVP cell rendering
        // If multiple value fields, we'd need nested columns or concatenated string
        const vConfig = values[0];
        if (vConfig) {
          const rawVals = bucket[vConfig.field];
          const aggregatedVal = aggregate(rawVals, vConfig.aggregation);
          result[currentRow][targetCol] = { value: aggregatedVal };
        }
      } else {
        result[currentRow][targetCol] = { value: null };
      }
    });
    currentRow++;
  });

  return result;
}

function aggregate(values: any[], type: string): number | string {
  const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
  
  switch (type) {
    case 'SUM':
      return nums.reduce((a, b) => a + b, 0);
    case 'COUNT':
      return values.length;
    case 'AVERAGE':
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'MIN':
      return nums.length ? Math.min(...nums) : 0;
    case 'MAX':
      return nums.length ? Math.max(...nums) : 0;
    default:
      return 0;
  }
}
