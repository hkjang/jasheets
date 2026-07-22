import { EventsService } from '../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetsService } from './sheets.service';

describe('SheetsService previewCellChanges', () => {
  const prisma = {
    sheet: { findUnique: jest.fn() },
    cell: { findMany: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
    mergedRange: { findFirst: jest.fn() },
  };
  let service: SheetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
    prisma.sheet.findUnique.mockResolvedValue({
      spreadsheetId: 'workbook-1',
      rowCount: 100,
      colCount: 20,
      version: 7,
    });
    prisma.mergedRange.findFirst.mockResolvedValue(null);
    prisma.cell.findMany.mockResolvedValue([
      {
        row: 0,
        col: 0,
        value: 10,
        formula: null,
        format: { bold: true, color: 'red' },
      },
      { row: 0, col: 1, value: 20, formula: '=A1*2', format: null },
    ]);
  });

  it('returns deterministic before/after changes without writing', async () => {
    const updates = [
      { row: 0, col: 0, value: 11, format: { color: 'red', bold: true } },
      { row: 0, col: 1, formula: '=A1*2' },
    ];

    const first = await service.previewCellChanges(
      'user-1',
      'sheet-1',
      updates,
      7,
    );
    const second = await service.previewCellChanges(
      'user-1',
      'sheet-1',
      updates,
      7,
    );

    expect(first.summary).toEqual({
      requestedCells: 2,
      changedCells: 1,
      unchangedCells: 1,
      valueChanges: 1,
      formulaChanges: 0,
      formatChanges: 0,
    });
    expect(first.canApply).toBe(true);
    expect(first.previewHash).toBe(second.previewHash);
    expect(first.changes[0]).toMatchObject({
      before: { value: 10 },
      after: { value: 11, formula: null },
      changed: true,
    });
    expect(prisma.cell.updateMany).not.toHaveBeenCalled();
    expect(prisma.cell.upsert).not.toHaveBeenCalled();
  });

  it('reports an optimistic concurrency conflict', async () => {
    const result = await service.previewCellChanges(
      'user-1',
      'sheet-1',
      [{ row: 0, col: 0, value: 99 }],
      6,
    );

    expect(result).toMatchObject({
      currentVersion: 7,
      expectedVersion: 6,
      versionConflict: true,
      canApply: false,
    });
  });
});
