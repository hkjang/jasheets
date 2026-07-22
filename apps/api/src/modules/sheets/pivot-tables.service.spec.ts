import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { PivotTableDto } from './dto/pivot-table.dto';
import { SheetsService } from './sheets.service';

function pivot(overrides: Partial<PivotTableDto> = {}): PivotTableDto {
  return {
    name: 'Sales by region',
    sourceRange: 'A1:C10',
    targetCell: 'E1',
    config: {
      sourceRange: { startRow: 0, startCol: 0, endRow: 9, endCol: 2 },
      outputRange: { startRow: 0, startCol: 4, endRow: 5, endCol: 6 },
      rows: ['Region'],
      cols: ['Quarter'],
      values: [{ field: 'Sales', aggregation: 'SUM' }],
      filters: [{ field: 'Sales', operator: 'GREATER_THAN', value: 0 }],
      rowSort: { direction: 'ASC', by: 'LABEL' },
      rowGrandTotals: true,
      columnGrandTotals: true,
    },
    ...overrides,
  };
}

describe('SheetsService managed pivot tables', () => {
  const sheet = {
    id: 'sheet-1',
    spreadsheetId: 'spreadsheet-1',
    rowCount: 100,
    colCount: 26,
    version: 7,
  };
  let tx: any;
  let prisma: any;
  let service: SheetsService;

  beforeEach(() => {
    tx = {
      spreadsheet: {
        findFirst: jest.fn().mockResolvedValue({
          ownerId: 'user-1',
          permissions: [],
        }),
      },
      sheet: {
        findUnique: jest.fn().mockResolvedValue(sheet),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pivotPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
      pivotTable: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: data.id ?? 'pivot-new',
            ...data,
          }),
        ),
      },
      cell: {
        findMany: jest.fn().mockResolvedValue([
          { col: 0, value: 'Region' },
          { col: 1, value: 'Quarter' },
          { col: 2, value: 'Sales' },
        ]),
      },
    };
    prisma = {
      sheet: { findUnique: jest.fn().mockResolvedValue(sheet) },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    };
    service = new SheetsService(prisma as PrismaService, {} as EventsService);
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
  });

  it('atomically claims the sheet version before replacing pivots', async () => {
    const result = await service.savePivotTables(
      'user-1',
      sheet.id,
      [pivot()],
      7,
    );

    expect(result).toMatchObject({
      version: 8,
      pivotTables: [{ id: 'pivot-new', sourceRange: 'A1:C10' }],
    });
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: sheet.id, version: 7 },
      data: { version: { increment: 1 } },
    });
    expect(tx.pivotTable.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: sheet.id },
    });
    expect(tx.pivotTable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sheetId: sheet.id,
        name: 'Sales by region',
        targetCell: 'E1',
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('does not delete persisted pivots when the expected version is stale', async () => {
    tx.sheet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.savePivotTables('user-1', sheet.id, [pivot()], 6),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.pivotTable.deleteMany).not.toHaveBeenCalled();
    expect(tx.pivotTable.create).not.toHaveBeenCalled();
  });

  it('rejects output that overlaps the source before claiming a version', async () => {
    const overlapping = pivot({
      targetCell: 'B2',
      config: {
        ...pivot().config,
        outputRange: { startRow: 1, startCol: 1, endRow: 4, endCol: 3 },
      },
    });

    await expect(
      service.savePivotTables('user-1', sheet.id, [overlapping], 7),
    ).rejects.toThrow('Pivot output cannot overlap its source range');

    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
    expect(tx.pivotTable.deleteMany).not.toHaveBeenCalled();
  });

  it('enforces active policy aggregation and per-sheet limits', async () => {
    tx.pivotPolicy.findFirst.mockResolvedValueOnce({
      maxPivotsPerSheet: 1,
      maxPivotsPerUser: 5,
      maxRowsForPivot: 100,
      allowedAggregates: ['COUNT'],
    });

    await expect(
      service.savePivotTables('user-1', sheet.id, [pivot()], 7),
    ).rejects.toThrow('Pivot aggregation is not allowed by policy: SUM');

    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
  });

  it('rejects unknown fields and duplicate source headers', async () => {
    tx.cell.findMany.mockResolvedValueOnce([
      { col: 0, value: 'Region' },
      { col: 1, value: 'Region' },
      { col: 2, value: 'Sales' },
    ]);

    await expect(
      service.savePivotTables('user-1', sheet.id, [pivot()], 7),
    ).rejects.toThrow('Pivot source headers must be unique');

    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
  });

  it('only preserves ids that already belong to the target sheet', async () => {
    await expect(
      service.savePivotTables(
        'user-1',
        sheet.id,
        [pivot({ id: 'pivot-from-another-sheet' })],
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.cell.findMany).not.toHaveBeenCalled();
    expect(tx.pivotTable.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps a valid existing pivot id stable across an update', async () => {
    tx.pivotTable.findMany.mockResolvedValueOnce([{ id: 'pivot-1' }]);

    const result = await service.savePivotTables(
      'user-1',
      sheet.id,
      [pivot({ id: 'pivot-1' })],
      7,
    );

    expect(result.pivotTables[0]).toMatchObject({ id: 'pivot-1' });
    expect(tx.pivotTable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'pivot-1' }),
    });
  });

  it('rejects overlapping output footprints across managed pivots', async () => {
    const second = pivot({
      name: 'Second pivot',
      targetCell: 'G4',
      config: {
        ...pivot().config,
        outputRange: { startRow: 3, startCol: 6, endRow: 8, endCol: 9 },
      },
    });

    await expect(
      service.savePivotTables('user-1', sheet.id, [pivot(), second], 7),
    ).rejects.toThrow('Pivot output ranges cannot overlap each other');

    expect(tx.cell.findMany).not.toHaveBeenCalled();
    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an excessive source area even when its row count is allowed', async () => {
    const wideSheet = { ...sheet, rowCount: 1000, colCount: 2000 };
    prisma.sheet.findUnique.mockResolvedValueOnce(wideSheet);
    tx.sheet.findUnique.mockResolvedValueOnce(wideSheet);
    const excessive = pivot({
      sourceRange: 'A1:ALL1000',
      targetCell: 'BXX1',
      config: {
        ...pivot().config,
        sourceRange: {
          startRow: 0,
          startCol: 0,
          endRow: 999,
          endCol: 1000,
        },
        outputRange: undefined,
      },
    });

    await expect(
      service.savePivotTables('user-1', sheet.id, [excessive], 7),
    ).rejects.toThrow('Pivot source cannot contain more than 1000000 cells');

    expect(tx.cell.findMany).not.toHaveBeenCalled();
  });
});
