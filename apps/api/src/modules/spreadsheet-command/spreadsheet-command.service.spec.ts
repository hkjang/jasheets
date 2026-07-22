import { SheetsService } from '../sheets/sheets.service';
import { SpreadsheetCommandService } from './spreadsheet-command.service';

describe('SpreadsheetCommandService', () => {
  const sheets = {
    updateCells: jest.fn(),
    changeStructure: jest.fn(),
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
});
