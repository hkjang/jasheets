import { BadRequestException, ConflictException } from '@nestjs/common';
import { SheetSnapshotsService } from './sheet-snapshots.service';

describe('SheetSnapshotsService', () => {
  const sheetId = 'sheet-1';
  const userId = 'user-1';

  const makePrisma = () => {
    const tx = {
      sheet: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      cell: { deleteMany: jest.fn(), createMany: jest.fn() },
      rowMeta: { deleteMany: jest.fn(), createMany: jest.fn() },
      colMeta: { deleteMany: jest.fn(), createMany: jest.fn() },
      mergedRange: { deleteMany: jest.fn(), createMany: jest.fn() },
      conditionalRule: { deleteMany: jest.fn(), createMany: jest.fn() },
      chart: { deleteMany: jest.fn(), createMany: jest.fn() },
      pivotTable: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const prisma = {
      sheet: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      cell: { findMany: jest.fn() },
      rowMeta: { findMany: jest.fn() },
      colMeta: { findMany: jest.fn() },
      mergedRange: { findMany: jest.fn() },
      conditionalRule: { findMany: jest.fn() },
      chart: { findMany: jest.fn() },
      pivotTable: { findMany: jest.fn() },
      sheetSnapshot: { create: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    return { prisma, tx };
  };

  it('captures the complete sheet content in a versioned payload', async () => {
    const { prisma } = makePrisma();
    prisma.sheet.findUnique.mockResolvedValue({
      spreadsheet: { ownerId: userId, permissions: [], isPublic: false },
    });
    prisma.sheet.findUniqueOrThrow.mockResolvedValue({
      rowCount: 100,
      colCount: 20,
      frozenRows: 1,
      frozenCols: 2,
      defaultRowHeight: 25,
      defaultColWidth: 100,
    });
    prisma.cell.findMany.mockResolvedValue([
      { row: 0, col: 0, value: 'A', formula: null, format: null },
    ]);
    prisma.rowMeta.findMany.mockResolvedValue([
      { row: 1, height: 40, hidden: false },
    ]);
    prisma.colMeta.findMany.mockResolvedValue([
      { col: 2, width: 160, hidden: true },
    ]);
    prisma.mergedRange.findMany.mockResolvedValue([
      { startRow: 0, startCol: 0, endRow: 0, endCol: 2 },
    ]);
    prisma.conditionalRule.findMany.mockResolvedValue([
      {
        name: 'negative',
        priority: 0,
        ranges: ['A:A'],
        conditions: {},
        format: {},
        active: true,
      },
    ]);
    prisma.chart.findMany.mockResolvedValue([
      {
        type: 'bar',
        x: 1,
        y: 2,
        width: 300,
        height: 200,
        data: {},
        options: null,
      },
    ]);
    prisma.pivotTable.findMany.mockResolvedValue([
      {
        name: null,
        config: {},
        sourceRange: null,
        targetCell: null,
      },
    ]);
    prisma.sheetSnapshot.create.mockImplementation(({ data }: any) => data);

    const service = new SheetSnapshotsService(prisma as any);
    const result = await service.createSnapshot(userId, sheetId, 'Complete');

    expect(result.data).toMatchObject({
      schemaVersion: 2,
      mergedRanges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 2 }],
      conditionalRules: [{ name: 'negative' }],
      charts: [{ type: 'bar' }],
      pivotTables: [{ config: {} }],
    });
  });

  it('restores all captured sections atomically and increments the sheet version with CAS', async () => {
    const { prisma, tx } = makePrisma();
    const service = new SheetSnapshotsService(prisma as any);
    const data = {
      schemaVersion: 2,
      sheet: {
        rowCount: 50,
        colCount: 10,
        frozenRows: 1,
        frozenCols: 0,
        defaultRowHeight: 24,
        defaultColWidth: 90,
      },
      cells: [{ row: 0, col: 0, value: 'restored' }],
      rowMeta: [],
      colMeta: [],
      mergedRanges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }],
      conditionalRules: [
        {
          name: 'rule',
          priority: 0,
          ranges: ['A1'],
          conditions: {},
          format: {},
          active: true,
        },
      ],
      charts: [{ type: 'line', x: 0, y: 0, width: 100, height: 100, data: {} }],
      pivotTables: [{ config: {} }],
    } as const;
    jest
      .spyOn(service, 'getSnapshot')
      .mockResolvedValue({ id: 'snap', sheetId, name: 'Full', data } as any);
    jest.spyOn(service as any, 'checkSheetAccess').mockResolvedValue(undefined);
    jest.spyOn(service, 'createSnapshot').mockResolvedValue({} as any);
    prisma.sheet.findUnique.mockResolvedValue({ version: 7 });

    await service.restoreSnapshot(userId, 'snap');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: sheetId, version: 7 },
      data: { ...data.sheet, version: { increment: 1 } },
    });
    expect(tx.cell.deleteMany).toHaveBeenCalled();
    expect(tx.mergedRange.deleteMany).toHaveBeenCalled();
    expect(tx.conditionalRule.createMany).toHaveBeenCalled();
    expect(tx.chart.createMany).toHaveBeenCalled();
    expect(tx.pivotTable.createMany).toHaveBeenCalled();
  });

  it('preserves sections absent from a legacy snapshot', async () => {
    const { prisma, tx } = makePrisma();
    const service = new SheetSnapshotsService(prisma as any);
    jest.spyOn(service, 'getSnapshot').mockResolvedValue({
      id: 'snap',
      sheetId,
      name: 'Legacy',
      data: { cells: [] },
    } as any);
    jest.spyOn(service as any, 'checkSheetAccess').mockResolvedValue(undefined);
    jest.spyOn(service, 'createSnapshot').mockResolvedValue({} as any);
    prisma.sheet.findUnique.mockResolvedValue({ version: 2 });

    await service.restoreSnapshot(userId, 'snap');

    expect(tx.rowMeta.deleteMany).not.toHaveBeenCalled();
    expect(tx.colMeta.deleteMany).not.toHaveBeenCalled();
    expect(tx.mergedRange.deleteMany).not.toHaveBeenCalled();
    expect(tx.conditionalRule.deleteMany).not.toHaveBeenCalled();
    expect(tx.chart.deleteMany).not.toHaveBeenCalled();
    expect(tx.pivotTable.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects invalid coordinates before modifying the sheet', async () => {
    const { prisma } = makePrisma();
    const service = new SheetSnapshotsService(prisma as any);
    jest.spyOn(service, 'getSnapshot').mockResolvedValue({
      id: 'snap',
      sheetId,
      name: 'Invalid',
      data: { cells: [{ row: -1, col: 0, value: null }] },
    } as any);
    jest.spyOn(service as any, 'checkSheetAccess').mockResolvedValue(undefined);

    await expect(
      service.restoreSnapshot(userId, 'snap'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back when the sheet changes during restore', async () => {
    const { prisma, tx } = makePrisma();
    const service = new SheetSnapshotsService(prisma as any);
    jest.spyOn(service, 'getSnapshot').mockResolvedValue({
      id: 'snap',
      sheetId,
      name: 'Conflict',
      data: { cells: [] },
    } as any);
    jest.spyOn(service as any, 'checkSheetAccess').mockResolvedValue(undefined);
    jest.spyOn(service, 'createSnapshot').mockResolvedValue({} as any);
    prisma.sheet.findUnique.mockResolvedValue({ version: 3 });
    tx.sheet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.restoreSnapshot(userId, 'snap'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.cell.deleteMany).not.toHaveBeenCalled();
  });
});
