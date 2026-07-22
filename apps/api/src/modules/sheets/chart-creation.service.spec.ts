import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

describe('SheetsService chart creation', () => {
  const sheet = {
    spreadsheetId: 'workbook-1',
    rowCount: 100,
    colCount: 20,
    version: 4,
  };

  it('materializes only the source range and claims the sheet version', async () => {
    const tx = {
      spreadsheet: {
        findFirst: jest.fn().mockResolvedValue({
          ownerId: 'user-1',
          permissions: [],
        }),
      },
      sheet: {
        findUnique: jest.fn().mockResolvedValue({ version: 4 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      chart: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => ({ ...data })),
      },
      cell: {
        findMany: jest.fn().mockResolvedValue([
          { row: 0, col: 0, value: 'Month' },
          { row: 0, col: 1, value: 'Revenue' },
          { row: 1, col: 0, value: 'Jan' },
          { row: 1, col: 1, value: 10 },
        ]),
      },
    };
    const prisma = {
      sheet: { findUnique: jest.fn().mockResolvedValue(sheet) },
      chart: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);

    const result = await service.createChart(
      'user-1',
      'sheet-1',
      {
        id: 'chart-stable',
        type: 'line',
        sourceRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 },
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        options: { title: 'Revenue', showLegend: true },
      },
      4,
    );

    expect(tx.cell.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sheetId: 'sheet-1',
          row: { gte: 0, lte: 2 },
          col: { gte: 0, lte: 1 },
        },
      }),
    );
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'sheet-1', version: 4 },
      data: { version: { increment: 1 } },
    });
    expect(tx.chart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'chart-stable',
        data: [
          ['Month', 'Revenue'],
          ['Jan', 10],
          [null, null],
        ],
        sourceRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 },
      }),
    });
    expect(result).toMatchObject({ version: 5, replayed: false });
  });

  it('replays an existing chart without starting a write transaction', async () => {
    const request = {
      id: 'chart-stable',
      type: 'bar' as const,
      sourceRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 },
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      options: { title: 'Revenue', showLegend: true },
    };
    const prisma = {
      sheet: { findUnique: jest.fn().mockResolvedValue(sheet) },
      chart: {
        findUnique: jest.fn().mockResolvedValue({
          ...request,
          sheetId: 'sheet-1',
          data: [],
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);

    await expect(
      service.createChart('user-1', 'sheet-1', request, 4),
    ).resolves.toMatchObject({ version: 4, replayed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
