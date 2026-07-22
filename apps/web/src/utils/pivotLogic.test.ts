
import {
  calculatePivotData,
  calculatePivotOutput,
  getPivotOutputDimensions,
  PivotAggregation,
  PivotConfig,
} from './pivotLogic';
import { SheetData } from '@/types/spreadsheet';

describe('calculatePivotData', () => {
  const mockData: SheetData = {
    0: {
      0: { value: 'Region' },
      1: { value: 'Product' },
      2: { value: 'Sales' },
    },
    1: {
      0: { value: 'North' },
      1: { value: 'Apple' },
      2: { value: 100 },
    },
    2: {
      0: { value: 'North' },
      1: { value: 'Banana' },
      2: { value: 150 },
    },
    3: {
      0: { value: 'South' },
      1: { value: 'Apple' },
      2: { value: 200 },
    },
    4: {
      0: { value: 'South' },
      1: { value: 'Banana' },
      2: { value: 50 },
    },
    5: {
      0: { value: 'North' },
      1: { value: 'Apple' },
      2: { value: 120 },
    },
  };

  const baseConfig: PivotConfig = {
    sourceRange: { startRow: 0, startCol: 0, endRow: 5, endCol: 2 },
    rows: [],
    cols: [],
    values: [],
  };

  test('should aggregate Sum of Sales by Region', () => {
    const config: PivotConfig = {
      ...baseConfig,
      rows: ['Region'],
      cols: [],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
    };

    const result = calculatePivotData(mockData, config);

    // Expected Output Structure:
    // Row 0: Header (Region / Ref) | Total
    // Row 1: North | 370 (100 + 150 + 120)
    // Row 2: South | 250 (200 + 50)

    expect(result[0][0].value).toContain('Region');
    expect(result[1][0].value).toBe('North');
    expect(result[2][0].value).toBe('South');

    expect(result[1][1].value).toBe(370);
    expect(result[2][1].value).toBe(250);
  });

  test('should aggregate Count of Product by Region', () => {
    const config: PivotConfig = {
      ...baseConfig,
      rows: ['Region'],
      cols: [],
      values: [{ field: 'Product', aggregation: 'COUNT' }],
    };

    const result = calculatePivotData(mockData, config);

    // North has 3 items, South has 2 items
    expect(result[1][1].value).toBe(3);
    expect(result[2][1].value).toBe(2);
  });

  test('should pivot with Rows (Region) and Columns (Product)', () => {
    const config: PivotConfig = {
      ...baseConfig,
      rows: ['Region'],
      cols: ['Product'],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
    };

    const result = calculatePivotData(mockData, config);

    // Structure roughly:
    // Ref | Apple | Banana
    // North | 220 | 150
    // South | 200 | 50

    // Find indices based on headers if needed, but strict order is likely:
    // Columns sorted: Apple, Banana
    
    // Header Row
    expect(result[0][1].value).toBe('Apple');
    expect(result[0][2].value).toBe('Banana');

    // North Row
    expect(result[1][0].value).toBe('North');
    expect(result[1][1].value).toBe(220); // 100 + 120
    expect(result[1][2].value).toBe(150);

    // South Row
    expect(result[2][0].value).toBe('South');
    expect(result[2][1].value).toBe(200);
    expect(result[2][2].value).toBe(50);
  });

  test('renders every value aggregation instead of silently dropping all but the first', () => {
    const result = calculatePivotData(mockData, {
      ...baseConfig,
      rows: ['Region'],
      values: [
        { field: 'Sales', aggregation: 'SUM' },
        { field: 'Product', aggregation: 'COUNT' },
      ],
    });

    expect(result[0][1].value).toBe('Total / Sales (SUM)');
    expect(result[0][2].value).toBe('Total / Product (COUNT)');
    expect(result[1][1].value).toBe(370);
    expect(result[1][2].value).toBe(3);
  });

  test('does not count blank values and keeps tuple keys containing separators distinct', () => {
    const data: SheetData = {
      0: { 0: { value: 'First' }, 1: { value: 'Second' }, 2: { value: 'Amount' } },
      1: { 0: { value: 'A | B' }, 1: { value: 'C' }, 2: { value: 1 } },
      2: { 0: { value: 'A' }, 1: { value: 'B | C' }, 2: { value: null } },
    };
    const result = calculatePivotData(data, {
      sourceRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
      rows: ['First', 'Second'],
      cols: [],
      values: [{ field: 'Amount', aggregation: 'COUNT' }],
    });

    expect(result[1][0].value).not.toBe(result[2][0].value);
    expect([result[1][1].value, result[2][1].value].sort()).toEqual([0, 1]);
  });

  test('rejects ambiguous duplicate source headers and missing value fields', () => {
    expect(() => calculatePivotData({
      0: { 0: { value: 'Name' }, 1: { value: 'Name' } },
      1: { 0: { value: 'A' }, 1: { value: 1 } },
    }, {
      sourceRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      rows: ['Name'],
      cols: [],
      values: [{ field: 'Name', aggregation: 'SUM' }],
    })).toThrow('headers must be unique');

    expect(() => calculatePivotData(mockData, baseConfig)).toThrow(
      'at least one value field',
    );
  });

  test('applies typed filters before grouping', () => {
    const cases: Array<[PivotConfig['filters'], number[]]> = [
      [[{ field: 'Region', operator: 'EQUALS', value: 'North' }], [370]],
      [[{ field: 'Product', operator: 'IN', values: ['Banana'] }], [150, 50]],
      [[{ field: 'Sales', operator: 'BETWEEN', values: [100, 150] }], [370]],
      [[{ field: 'Product', operator: 'NOT_CONTAINS', value: 'apple' }], [150, 50]],
      [[{ field: 'Sales', operator: 'GREATER_THAN', value: 120 }], [150, 200]],
    ];

    for (const [filters, expected] of cases) {
      const result = calculatePivotData(mockData, {
        ...baseConfig,
        rows: ['Region'],
        values: [{ field: 'Sales', aggregation: 'SUM' }],
        filters,
      });
      expect(Object.keys(result).slice(1).map((row) => result[Number(row)][1].value)).toEqual(expected);
    }
  });

  test('sorts row and column tuples by labels or aggregate values', () => {
    const rowsDescending = calculatePivotData(mockData, {
      ...baseConfig,
      rows: ['Region'],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
      rowSort: { direction: 'DESC', by: 'VALUE' },
    });
    expect([rowsDescending[1][0].value, rowsDescending[2][0].value]).toEqual(['North', 'South']);

    const columnsDescending = calculatePivotData(mockData, {
      ...baseConfig,
      rows: ['Region'],
      cols: ['Product'],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
      colSort: { direction: 'DESC', by: 'LABEL' },
    });
    expect([columnsDescending[0][1].value, columnsDescending[0][2].value]).toEqual(['Banana', 'Apple']);
  });

  test('computes row and column grand totals from source records', () => {
    const result = calculatePivotData(mockData, {
      ...baseConfig,
      rows: ['Region'],
      cols: ['Product'],
      values: [
        { field: 'Sales', aggregation: 'SUM' },
        { field: 'Sales', aggregation: 'AVERAGE' },
      ],
      rowGrandTotals: true,
      columnGrandTotals: true,
    });

    expect(result[0][5].value).toBe('Grand Total / Sales (SUM)');
    expect(result[1][5].value).toBe(370);
    expect(result[1][6].value).toBeCloseTo(370 / 3);
    expect(result[3][0].value).toBe('Grand Total');
    expect(result[3][1].value).toBe(420);
    expect(result[3][2].value).toBe(140);
    expect(result[3][5].value).toBe(620);
    expect(result[3][6].value).toBe(124);
  });

  test.each<[PivotAggregation, number]>([
    ['SUM', 12.5],
    ['COUNT', 3],
    ['AVERAGE', 12.5 / 2],
    ['MIN', 5],
    ['MAX', 7.5],
  ])('aggregates blanks, errors, booleans, and numeric strings robustly for %s', (aggregation, expected) => {
    const data: SheetData = {
      0: { 0: { value: 'Group' }, 1: { value: 'Value' } },
      1: { 0: { value: 'A' }, 1: { value: 5 } },
      2: { 0: { value: 'A' }, 1: { value: '7.5' } },
      3: { 0: { value: 'A' }, 1: { value: '' } },
      4: { 0: { value: 'A' }, 1: { value: true } },
      5: { 0: { value: 'A' }, 1: { value: '#DIV/0!' } },
      6: { 0: { value: 'A' }, 1: { value: 999, error: '#REF!' } },
    };
    const result = calculatePivotData(data, {
      sourceRange: { startRow: 0, startCol: 0, endRow: 6, endCol: 1 },
      rows: ['Group'],
      cols: [],
      values: [{ field: 'Value', aggregation }],
    });
    expect(result[1][1].value).toBeCloseTo(expected);
  });

  test('keeps same-looking typed tuples in distinct buckets', () => {
    const data: SheetData = {
      0: { 0: { value: 'Key' }, 1: { value: 'Amount' } },
      1: { 0: { value: 1 }, 1: { value: 10 } },
      2: { 0: { value: '1' }, 1: { value: 20 } },
      3: { 0: { value: null }, 1: { value: 30 } },
      4: { 0: { value: '' }, 1: { value: 40 } },
    };
    const result = calculatePivotData(data, {
      sourceRange: { startRow: 0, startCol: 0, endRow: 4, endCol: 1 },
      rows: ['Key'],
      cols: [],
      values: [{ field: 'Amount', aggregation: 'SUM' }],
    });

    expect(Object.keys(result)).toHaveLength(4);
    expect(Object.keys(result).slice(1).map((row) => result[Number(row)][1].value).sort()).toEqual([10, 20, 70]);
  });

  test('returns exact dimensions and an inclusive managed output range', () => {
    const output = calculatePivotOutput(mockData, {
      ...baseConfig,
      rows: ['Region'],
      cols: ['Product'],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
      rowGrandTotals: true,
      columnGrandTotals: true,
    }, { row: 10, col: 4 });

    expect(output.dimensions).toEqual({
      rowCount: 4,
      columnCount: 4,
      range: { startRow: 10, startCol: 4, endRow: 13, endCol: 7 },
    });
    expect(getPivotOutputDimensions({}, 3, 2)).toEqual({
      rowCount: 0,
      columnCount: 0,
      range: { startRow: 3, startCol: 2, endRow: 2, endCol: 1 },
    });
  });
});
