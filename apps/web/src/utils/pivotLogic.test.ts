
import { calculatePivotData, PivotConfig } from './pivotLogic';
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
});
