import { SheetsService } from '../sheets/sheets.service';
import { McpQueryService } from './mcp-query.service';

describe('McpQueryService range analysis', () => {
  it('profiles sparse columns and reports quality insights', async () => {
    const sheets = {
      readSheetRange: jest.fn().mockResolvedValue({
        spreadsheetId: 'workbook-1',
        sheetId: 'sheet-1',
        sheetName: 'Sales',
        version: 9,
        range: { startRow: 0, startCol: 0, endRow: 3, endCol: 2 },
        cells: [
          { row: 0, col: 0, value: 'Region', formula: null, format: null },
          { row: 0, col: 1, value: 'Revenue', formula: null, format: null },
          { row: 0, col: 2, value: 'Margin', formula: null, format: null },
          { row: 1, col: 0, value: 'East', formula: null, format: null },
          { row: 2, col: 0, value: 'West', formula: null, format: null },
          { row: 1, col: 1, value: 10, formula: null, format: null },
          { row: 2, col: 1, value: 20, formula: null, format: null },
          { row: 3, col: 1, value: 30, formula: '=SUM(10,20)', format: null },
          { row: 1, col: 2, value: 0.1, formula: null, format: null },
          { row: 2, col: 2, value: '#DIV/0!', formula: '=1/0', format: null },
        ],
      }),
    };
    const service = new McpQueryService(sheets as unknown as SheetsService);

    const result = await service.analyzeRange(
      'user-1',
      'workbook-1',
      'sheet-1',
      0,
      0,
      3,
      2,
      true,
    );

    expect(result.summary).toEqual({
      dataRows: 3,
      columns: 3,
      analyzedCells: 9,
      blankCells: 2,
      formulaCells: 2,
      errorCells: 1,
    });
    expect(result.columns[1]).toMatchObject({
      label: 'B',
      header: 'Revenue',
      blankCount: 0,
      distinctCount: 3,
      formulaCount: 1,
      numeric: { count: 3, sum: 60, average: 20, min: 10, max: 30 },
    });
    expect(result.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'HIGH_MISSING_RATE', column: 0 }),
        expect.objectContaining({ code: 'MIXED_TYPES', column: 2 }),
        expect.objectContaining({ code: 'FORMULA_ERRORS', column: 2 }),
      ]),
    );
  });
});
