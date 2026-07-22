import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

describe('SheetsService sheet schema', () => {
  it('returns bounded, permission-checked column metadata', async () => {
    const prisma = {
      sheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sheet-1',
          name: 'Data',
          rowCount: 1000,
          colCount: 30,
          version: 7,
        }),
      },
      cell: {
        findMany: jest.fn().mockResolvedValue([
          { row: 0, col: 0, value: 'Name', formula: null },
          { row: 1, col: 0, value: 'Ada', formula: null },
          { row: 2, col: 0, value: 'Grace', formula: null },
          { row: 0, col: 1, value: 'Score', formula: null },
          { row: 1, col: 1, value: 10, formula: '=SUM(5,5)' },
          { row: 2, col: 1, value: null, formula: null },
          { row: 0, col: 26, value: 'Extended', formula: null },
          { row: 1, col: 26, value: true, formula: null },
        ]),
      },
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkAccess').mockResolvedValue(true);

    const result = await service.describeSheetSchema(
      'user-1',
      'workbook-1',
      'sheet-1',
      0,
      25,
    );

    expect(prisma.sheet.findFirst).toHaveBeenCalledWith({
      where: { id: 'sheet-1', spreadsheetId: 'workbook-1' },
      select: expect.any(Object),
    });
    expect(prisma.cell.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sheetId: 'sheet-1', row: { gte: 0, lte: 25 } },
      }),
    );
    expect(result.columns).toEqual([
      expect.objectContaining({
        index: 0,
        label: 'A',
        header: 'Name',
        inferredType: 'string',
        sampledValues: 2,
      }),
      expect.objectContaining({
        index: 1,
        label: 'B',
        header: 'Score',
        inferredType: 'number',
        nullable: true,
        hasFormula: true,
      }),
      expect.objectContaining({
        index: 26,
        label: 'AA',
        inferredType: 'boolean',
      }),
    ]);
  });

  it('reads only the requested range after checking access', async () => {
    const prisma = {
      sheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sheet-1',
          name: 'Data',
          rowCount: 1000,
          colCount: 100,
          version: 9,
        }),
      },
      cell: {
        findMany: jest.fn().mockResolvedValue([
          {
            row: 10,
            col: 2,
            value: 'bounded',
            formula: null,
            format: null,
          },
        ]),
      },
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkAccess').mockResolvedValue(true);

    const result = await service.readSheetRange(
      'user-1',
      'workbook-1',
      'sheet-1',
      10,
      2,
      20,
      5,
    );

    expect(prisma.cell.findMany).toHaveBeenCalledWith({
      where: {
        sheetId: 'sheet-1',
        row: { gte: 10, lte: 20 },
        col: { gte: 2, lte: 5 },
      },
      select: {
        row: true,
        col: true,
        value: true,
        formula: true,
        format: true,
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });
    expect(result).toMatchObject({
      version: 9,
      requestedCells: 44,
      cells: [{ value: 'bounded' }],
    });
  });

  it('rejects oversized range reads before touching the database', async () => {
    const prisma = {
      sheet: { findFirst: jest.fn() },
      cell: { findMany: jest.fn() },
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );

    await expect(
      service.readSheetRange('user-1', 'workbook-1', 'sheet-1', 0, 0, 100, 100),
    ).rejects.toThrow('limited to 10,000 cells');
    expect(prisma.sheet.findFirst).not.toHaveBeenCalled();
  });

  it('finds the append row from non-empty cells and returns the CAS version', async () => {
    const prisma = {
      sheet: {
        findUnique: jest.fn().mockResolvedValue({
          spreadsheetId: 'workbook-1',
          rowCount: 100,
          colCount: 20,
          version: 12,
        }),
      },
      cell: {
        findFirst: jest.fn().mockResolvedValue({ row: 6 }),
      },
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);

    await expect(
      service.getAppendTarget('user-1', 'sheet-1', 2, 1, 3),
    ).resolves.toEqual({ startRow: 7, version: 12 });
    expect(prisma.cell.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sheetId: 'sheet-1' }),
        orderBy: { row: 'desc' },
      }),
    );
  });

  it('does not query cells when access is denied', async () => {
    const prisma = {
      sheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sheet-1',
          name: 'Data',
          rowCount: 100,
          colCount: 10,
          version: 1,
        }),
      },
      cell: { findMany: jest.fn() },
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkAccess').mockResolvedValue(false);

    await expect(
      service.describeSheetSchema('user-1', 'workbook-1', 'sheet-1'),
    ).rejects.toThrow('do not have access');
    expect(prisma.cell.findMany).not.toHaveBeenCalled();
  });
});
