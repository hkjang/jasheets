import { SheetsService } from '../sheets/sheets.service';
import { SpreadsheetCommandService } from './spreadsheet-command.service';

describe('SpreadsheetCommandService', () => {
  const sheets = {
    updateCells: jest.fn(),
    changeStructure: jest.fn(),
    getAppendTarget: jest.fn(),
    getCellMutationReplay: jest.fn(),
    createPivotTable: jest.fn(),
  };
  const service = new SpreadsheetCommandService(
    sheets as unknown as SheetsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes MCP cell writes through the domain mutation service', async () => {
    sheets.updateCells.mockResolvedValue({ version: 8 });

    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'SET_CELLS',
          sheetId: 'sheet-1',
          updates: [{ row: 1, col: 2, value: 'done' }],
          expectedVersion: 7,
          idempotencyKey: 'mcp-request-1',
        },
      ),
    ).resolves.toEqual({ version: 8 });

    expect(sheets.updateCells).toHaveBeenCalledWith(
      'user-1',
      'sheet-1',
      [{ row: 1, col: 2, value: 'done' }],
      7,
      'mcp-request-1',
    );
  });

  it('routes row changes through the same boundary', async () => {
    sheets.changeStructure.mockResolvedValue({ version: 4 });

    await service.execute(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'CHANGE_STRUCTURE',
        sheetId: 'sheet-1',
        axis: 'row',
        operation: 'insert',
        index: 3,
      },
    );

    expect(sheets.changeStructure).toHaveBeenCalledWith('user-1', 'sheet-1', {
      axis: 'row',
      type: 'insert',
      index: 3,
    });
  });

  it('expands a rectangular range into one atomic cell command', async () => {
    sheets.updateCells.mockResolvedValue({ version: 12, cells: [] });

    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'WRITE_RANGE',
          sheetId: 'sheet-1',
          startRow: 3,
          startCol: 4,
          values: [
            ['Name', 'Score'],
            ['Ada', 10],
          ],
          formulas: [
            [null, null],
            [null, '=SUM(5,5)'],
          ],
          expectedVersion: 11,
          idempotencyKey: 'range-request-1',
        },
      ),
    ).resolves.toMatchObject({
      version: 12,
      range: { startRow: 3, startCol: 4, endRow: 4, endCol: 5 },
    });

    expect(sheets.updateCells).toHaveBeenCalledWith(
      'user-1',
      'sheet-1',
      [
        { row: 3, col: 4, value: 'Name', formula: null },
        { row: 3, col: 5, value: 'Score', formula: null },
        { row: 4, col: 4, value: 'Ada', formula: null },
        { row: 4, col: 5, value: 10, formula: '=SUM(5,5)' },
      ],
      11,
      'range-request-1',
    );
  });

  it('rejects ragged ranges before calling the sheet service', async () => {
    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'WRITE_RANGE',
          sheetId: 'sheet-1',
          startRow: 0,
          startCol: 0,
          values: [[1, 2], [3]],
          idempotencyKey: 'ragged-request',
        },
      ),
    ).rejects.toThrow('must be rectangular');
    expect(sheets.updateCells).not.toHaveBeenCalled();
  });

  it('appends after the last used row using its observed version', async () => {
    sheets.getCellMutationReplay.mockResolvedValue(null);
    sheets.getAppendTarget.mockResolvedValue({ startRow: 8, version: 20 });
    sheets.updateCells.mockResolvedValue({ version: 21, cells: [] });

    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'APPEND_ROWS',
          sheetId: 'sheet-1',
          startCol: 1,
          values: [
            ['Ada', 10],
            ['Grace', 20],
          ],
          idempotencyKey: 'append-request-1',
        },
      ),
    ).resolves.toMatchObject({
      version: 21,
      range: { startRow: 8, startCol: 1, endRow: 9, endCol: 2 },
    });

    expect(sheets.getAppendTarget).toHaveBeenCalledWith(
      'user-1',
      'sheet-1',
      2,
      1,
      2,
    );
    expect(sheets.updateCells).toHaveBeenCalledWith(
      'user-1',
      'sheet-1',
      [
        { row: 8, col: 1, value: 'Ada' },
        { row: 8, col: 2, value: 10 },
        { row: 9, col: 1, value: 'Grace' },
        { row: 9, col: 2, value: 20 },
      ],
      20,
      'append-request-1',
      {
        range: { startRow: 8, startCol: 1, endRow: 9, endCol: 2 },
      },
    );
  });

  it('replays an append without recalculating or writing another range', async () => {
    sheets.getCellMutationReplay.mockResolvedValue({
      cells: [],
      version: 21,
      replayed: true,
      metadata: {
        range: { startRow: 8, startCol: 1, endRow: 9, endCol: 2 },
      },
    });

    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'APPEND_ROWS',
          sheetId: 'sheet-1',
          values: [['retry']],
          idempotencyKey: 'append-request-1',
        },
      ),
    ).resolves.toMatchObject({
      version: 21,
      replayed: true,
      range: { startRow: 8, startCol: 1, endRow: 9, endCol: 2 },
    });
    expect(sheets.getAppendTarget).not.toHaveBeenCalled();
    expect(sheets.updateCells).not.toHaveBeenCalled();
  });

  it('fills formulas with relative and absolute references', async () => {
    sheets.updateCells.mockResolvedValue({ version: 31, cells: [] });

    await expect(
      service.execute(
        { userId: 'user-1', actorType: 'MCP' },
        {
          type: 'APPLY_FORMULA',
          sheetId: 'sheet-1',
          startRow: 4,
          startCol: 2,
          endRow: 5,
          endCol: 3,
          formula: '=A1+$B$2+C$3+$D4',
          expectedVersion: 30,
          idempotencyKey: 'formula-request-1',
        },
      ),
    ).resolves.toMatchObject({
      version: 31,
      appliedCells: 4,
      range: { startRow: 4, startCol: 2, endRow: 5, endCol: 3 },
    });

    expect(sheets.updateCells).toHaveBeenCalledWith(
      'user-1',
      'sheet-1',
      [
        { row: 4, col: 2, value: null, formula: '=A1+$B$2+C$3+$D4' },
        { row: 4, col: 3, value: null, formula: '=B1+$B$2+D$3+$D4' },
        { row: 5, col: 2, value: null, formula: '=A2+$B$2+C$3+$D5' },
        { row: 5, col: 3, value: null, formula: '=B2+$B$2+D$3+$D5' },
      ],
      30,
      'formula-request-1',
    );
  });

  it('creates pivots with a stable id derived from the idempotency key', async () => {
    sheets.createPivotTable.mockResolvedValue({
      pivotTable: { id: 'stable' },
      version: 41,
      replayed: false,
    });
    const command = {
      type: 'CREATE_PIVOT' as const,
      sheetId: 'sheet-1',
      pivot: {
        name: 'Sales by region',
        targetCell: 'H1',
        config: {
          sourceRange: { startRow: 0, startCol: 0, endRow: 20, endCol: 4 },
          rows: ['Region'],
          cols: [],
          values: [{ field: 'Revenue', aggregation: 'SUM' as const }],
        },
      },
      expectedVersion: 40,
      idempotencyKey: 'pivot-request-1',
    };

    await service.execute({ userId: 'user-1', actorType: 'MCP' }, command);
    await service.execute({ userId: 'user-1', actorType: 'MCP' }, command);

    const firstPivot = sheets.createPivotTable.mock.calls[0][2];
    const secondPivot = sheets.createPivotTable.mock.calls[1][2];
    expect(firstPivot.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(secondPivot.id).toBe(firstPivot.id);
    expect(sheets.createPivotTable).toHaveBeenLastCalledWith(
      'user-1',
      'sheet-1',
      { ...command.pivot, id: firstPivot.id },
      40,
    );
  });
});
