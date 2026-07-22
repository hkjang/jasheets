import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

interface PrismaMock {
  sheet: { findUnique: jest.Mock; updateMany: jest.Mock };
  mergedRange: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  cell: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
}

describe('SheetsService merged ranges', () => {
  const sheet = {
    id: 'sheet-1',
    spreadsheetId: 'spreadsheet-1',
    rowCount: 100,
    colCount: 26,
    version: 7,
  };
  let prisma: PrismaMock;
  let service: SheetsService;
  let checkAccessSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = {
      sheet: {
        findUnique: jest.fn().mockResolvedValue(sheet),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      mergedRange: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'merge-1', ...data }),
          ),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cell: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
      $transaction: jest.fn(
        (callback: (client: PrismaMock) => Promise<unknown>) =>
          callback(prisma),
      ),
    };
    service = new SheetsService(
      prisma as unknown as PrismaService,
      {
        detectCellChange: jest.fn(),
        detectMultiCellChange: jest.fn(),
      } as unknown as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
    checkAccessSpy = jest.spyOn(service, 'checkAccess').mockResolvedValue(true);
  });

  it('creates a range atomically and clears all non-anchor cells', async () => {
    const result = await service.mergeCells('user-1', sheet.id, {
      startRow: 2,
      startCol: 3,
      endRow: 4,
      endCol: 5,
      expectedVersion: 7,
    });

    expect(prisma.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: sheet.id, version: 7 },
      data: { version: { increment: 1 } },
    });
    expect(prisma.mergedRange.findFirst).toHaveBeenCalledWith({
      // Jest asymmetric matchers are intentionally typed as any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: expect.objectContaining({
        sheetId: sheet.id,
        startRow: { lte: 4 },
        endRow: { gte: 2 },
        startCol: { lte: 5 },
        endCol: { gte: 3 },
      }),
      select: { id: true },
    });
    expect(prisma.cell.deleteMany).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: expect.objectContaining({
        sheetId: sheet.id,
        NOT: { row: 2, col: 3 },
      }),
    });
    expect(result).toMatchObject({
      version: 8,
      mergedRange: { id: 'merge-1' },
    });
  });

  it('rejects overlap and relies on the transaction to roll back version CAS', async () => {
    prisma.mergedRange.findFirst.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.mergeCells('user-1', sheet.id, {
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.mergedRange.create).not.toHaveBeenCalled();
    expect(prisma.cell.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects stale versions before changing cells', async () => {
    prisma.sheet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.mergeCells('user-1', sheet.id, {
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 1,
        expectedVersion: 6,
      }),
    ).rejects.toThrow('modified by another user');
    expect(prisma.mergedRange.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    [{ startRow: -1, startCol: 0, endRow: 0, endCol: 1 }],
    [{ startRow: 0, startCol: 0, endRow: 100, endCol: 1 }],
    [{ startRow: 2, startCol: 2, endRow: 1, endCol: 3 }],
    [{ startRow: 1, startCol: 1, endRow: 1, endCol: 1 }],
  ])('rejects invalid or degenerate range %j', async (range) => {
    await expect(
      service.mergeCells('user-1', sheet.id, range),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes exactly the requested merged range with version CAS', async () => {
    await expect(
      service.unmergeCells('user-1', sheet.id, {
        startRow: 2,
        startCol: 3,
        endRow: 4,
        endCol: 5,
        expectedVersion: 7,
      }),
    ).resolves.toEqual({ version: 8 });
    expect(prisma.mergedRange.deleteMany).toHaveBeenCalledWith({
      where: {
        sheetId: sheet.id,
        startRow: 2,
        startCol: 3,
        endRow: 4,
        endCol: 5,
      },
    });
  });

  it('reports an absent merged range without a false success', async () => {
    prisma.mergedRange.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.unmergeCells('user-1', sheet.id, {
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists ranges for readers and rejects users without access', async () => {
    prisma.mergedRange.findMany.mockResolvedValueOnce([{ id: 'merge-1' }]);
    await expect(service.listMergedRanges('user-1', sheet.id)).resolves.toEqual(
      [{ id: 'merge-1' }],
    );

    checkAccessSpy.mockResolvedValueOnce(false);
    await expect(
      service.listMergedRanges('user-2', sheet.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
