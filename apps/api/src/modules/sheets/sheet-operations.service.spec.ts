import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

describe('SheetsService sheet operations', () => {
  const spreadsheetId = 'spreadsheet-1';
  const tx = {
    sheet: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    cell: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    rowMeta: { deleteMany: jest.fn(), createMany: jest.fn() },
    colMeta: { deleteMany: jest.fn(), createMany: jest.fn() },
    chart: { createMany: jest.fn() },
    pivotTable: { createMany: jest.fn() },
    conditionalRule: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    comment: { deleteMany: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const prisma = {
    sheet: { findUnique: jest.fn() },
    $transaction: jest.fn(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
    ),
  };
  const service = new SheetsService(
    prisma as unknown as PrismaService,
    {} as EventsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
    tx.sheet.count.mockResolvedValue(2);
    tx.sheet.findFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ index: 4 });
    tx.sheet.create.mockResolvedValue({
      id: 'sheet-3',
      spreadsheetId,
      name: 'Forecast',
      index: 5,
    });
    prisma.sheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      spreadsheetId,
      rowCount: 1000,
      colCount: 26,
      version: 3,
      name: 'Revenue',
    });
    tx.sheet.updateMany.mockResolvedValue({ count: 1 });
    tx.sheet.update.mockResolvedValue({ id: 'sheet-1', version: 4 });
    tx.sheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      spreadsheetId,
      name: 'Revenue',
      index: 0,
      rowCount: 1000,
      colCount: 26,
      frozenRows: 1,
      frozenCols: 2,
      defaultRowHeight: 25,
      defaultColWidth: 100,
      cells: [],
      rowMeta: [],
      colMeta: [],
      charts: [],
      pivotTables: [],
      conditionalRules: [],
    });
    tx.sheet.findMany.mockResolvedValue([]);
    tx.sheet.findUniqueOrThrow.mockResolvedValue({
      id: 'sheet-1',
      rowCount: 1001,
      colCount: 26,
      version: 4,
    });
    tx.cell.deleteMany.mockResolvedValue({ count: 0 });
    tx.cell.findMany.mockResolvedValue([]);
    tx.cell.update.mockResolvedValue({});
    tx.cell.createMany.mockResolvedValue({ count: 0 });
    tx.sheet.delete.mockResolvedValue({ id: 'sheet-1' });
    tx.rowMeta.deleteMany.mockResolvedValue({ count: 0 });
    tx.rowMeta.createMany.mockResolvedValue({ count: 1 });
    tx.colMeta.deleteMany.mockResolvedValue({ count: 0 });
    tx.colMeta.createMany.mockResolvedValue({ count: 1 });
    tx.chart.createMany.mockResolvedValue({ count: 0 });
    tx.pivotTable.createMany.mockResolvedValue({ count: 0 });
    tx.conditionalRule.createMany.mockResolvedValue({ count: 0 });
    tx.conditionalRule.findMany.mockResolvedValue([]);
    tx.conditionalRule.update.mockResolvedValue({});
    tx.conditionalRule.delete.mockResolvedValue({});
    tx.comment.deleteMany.mockResolvedValue({ count: 0 });
    tx.$executeRaw.mockResolvedValue(0);
  });

  it('appends a new sheet after the highest existing index', async () => {
    const result = await service.addSheet('user-1', spreadsheetId, 'Forecast');

    expect(tx.sheet.create).toHaveBeenCalledWith({
      data: { spreadsheetId, name: 'Forecast', index: 5 },
    });
    expect(result).toMatchObject({ id: 'sheet-3', index: 5 });
  });

  it('rejects a spreadsheet that reached the sheet limit', async () => {
    tx.sheet.count.mockResolvedValue(200);

    await expect(
      service.addSheet('user-1', spreadsheetId, 'Too many'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.sheet.create).not.toHaveBeenCalled();
  });

  it('renames stored cross-sheet formulas with the sheet', async () => {
    tx.cell.findMany.mockResolvedValueOnce([
      { id: 'cell-1', formula: '=Revenue!A1*2' },
    ]);
    tx.sheet.update.mockResolvedValueOnce({ id: 'sheet-1', name: 'Q1 Sales' });

    await service.updateSheet('user-1', 'sheet-1', { name: 'Q1 Sales' });

    expect(tx.cell.update).toHaveBeenCalledWith({
      where: { id: 'cell-1' },
      data: { formula: "='Q1 Sales'!A1*2" },
    });
    expect(tx.sheet.update).toHaveBeenCalledWith({
      where: { id: 'sheet-1' },
      data: { name: 'Q1 Sales' },
    });
  });

  it('rejects duplicate sheet names case-insensitively', async () => {
    tx.sheet.findFirst.mockReset().mockResolvedValueOnce({ id: 'sheet-2' });

    await expect(
      service.updateSheet('user-1', 'sheet-1', { name: 'revenue' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.sheet.update).not.toHaveBeenCalled();
  });

  it('duplicates sheet content and presentation state into a unique tab', async () => {
    tx.sheet.count.mockResolvedValueOnce(2);
    tx.sheet.findUnique
      .mockResolvedValueOnce({
        id: 'sheet-1',
        spreadsheetId,
        name: 'Revenue',
        rowCount: 500,
        colCount: 12,
        frozenRows: 1,
        frozenCols: 2,
        defaultRowHeight: 24,
        defaultColWidth: 90,
        cells: [
          { row: 0, col: 0, value: 10, formula: null, format: { bold: true } },
        ],
        rowMeta: [{ row: 0, height: 30, hidden: false }],
        colMeta: [],
        charts: [],
        pivotTables: [],
        conditionalRules: [],
      })
      .mockResolvedValueOnce({ id: 'sheet-copy', name: 'Copy of Revenue' });
    tx.sheet.findMany.mockResolvedValueOnce([
      { name: 'Revenue' },
      { name: 'Copy of Revenue' },
    ]);
    tx.sheet.create.mockResolvedValueOnce({ id: 'sheet-copy' });

    const result = await service.duplicateSheet('user-1', 'sheet-1');

    expect(tx.sheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        spreadsheetId,
        name: 'Copy of Revenue (2)',
        index: 2,
        rowCount: 500,
        frozenCols: 2,
      }),
    });
    expect(tx.cell.createMany).toHaveBeenCalledWith({
      data: [
        {
          sheetId: 'sheet-copy',
          row: 0,
          col: 0,
          value: 10,
          formula: null,
          format: { bold: true },
        },
      ],
    });
    expect(tx.rowMeta.createMany).toHaveBeenCalled();
    expect(result).toEqual({ id: 'sheet-copy', name: 'Copy of Revenue' });
  });

  it('reorders tabs atomically without unique index collisions', async () => {
    const before = [{ id: 'sheet-1' }, { id: 'sheet-2' }, { id: 'sheet-3' }];
    const after = [
      { id: 'sheet-2', index: 0 },
      { id: 'sheet-3', index: 1 },
      { id: 'sheet-1', index: 2 },
    ];
    tx.sheet.findMany
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);

    const result = await service.reorderSheet('user-1', 'sheet-1', 2);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.sheet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sheet-2' },
      data: { index: 0 },
    });
    expect(tx.sheet.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'sheet-1' },
      data: { index: 2 },
    });
    expect(result).toEqual(after);
  });

  it('rejects an out-of-range tab position without changing indexes', async () => {
    tx.sheet.findMany.mockResolvedValueOnce([
      { id: 'sheet-1' },
      { id: 'sheet-2' },
    ]);

    await expect(
      service.reorderSheet('user-1', 'sheet-1', 2),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('increments the row count and shifts rows for an insertion', async () => {
    const result = await service.changeStructure('user-1', 'sheet-1', {
      axis: 'row',
      type: 'insert',
      index: 4,
    });

    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'sheet-1', version: 3 },
      data: { version: { increment: 1 }, rowCount: { increment: 1 } },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      id: 'sheet-1',
      version: 4,
      rowCount: 1001,
      colCount: 26,
    });
  });

  it('moves conditional formatting ranges with structural changes', async () => {
    tx.conditionalRule.findMany.mockResolvedValueOnce([
      { id: 'rule-1', ranges: ['A2:C4'] },
      { id: 'rule-2', ranges: ['D5:D5'] },
    ]);

    await service.changeStructure('user-1', 'sheet-1', {
      axis: 'row', type: 'insert', index: 1,
    });

    expect(tx.conditionalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { ranges: ['A3:C5'] },
    });
    expect(tx.conditionalRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-2' },
      data: { ranges: ['D6:D6'] },
    });
  });

  it('deletes column contents without reducing the visible grid size', async () => {
    tx.sheet.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'sheet-1',
      rowCount: 1000,
      colCount: 26,
      version: 4,
    });

    await service.changeStructure('user-1', 'sheet-1', {
      axis: 'column',
      type: 'delete',
      index: 2,
    });

    expect(tx.cell.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1', col: 2 },
    });
    expect(tx.colMeta.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1', col: 2 },
    });
    expect(tx.comment.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1', col: 2 },
    });
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'sheet-1', version: 3 },
      data: { version: { increment: 1 } },
    });
  });

  it('rejects out-of-range structural indexes before opening a transaction', async () => {
    await expect(
      service.changeStructure('user-1', 'sheet-1', {
        axis: 'column',
        type: 'delete',
        index: 26,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replaces bounded row and column view metadata atomically', async () => {
    const result = await service.saveView('user-1', 'sheet-1', {
      frozenRows: 2,
      frozenCols: 1,
      rowMeta: [{ row: 4, height: 36, hidden: false }],
      colMeta: [{ col: 3, width: 180, hidden: true }],
    });

    expect(tx.sheet.update).toHaveBeenCalledWith({
      where: { id: 'sheet-1' },
      data: {
        frozenRows: 2,
        frozenCols: 1,
        version: { increment: 1 },
      },
      select: { id: true, version: true },
    });
    expect(tx.rowMeta.createMany).toHaveBeenCalledWith({
      data: [{ sheetId: 'sheet-1', row: 4, height: 36, hidden: false }],
    });
    expect(tx.colMeta.createMany).toHaveBeenCalledWith({
      data: [{ sheetId: 'sheet-1', col: 3, width: 180, hidden: true }],
    });
    expect(result).toEqual({ id: 'sheet-1', version: 4 });
  });

  it('rejects duplicate view metadata coordinates', async () => {
    await expect(
      service.saveView('user-1', 'sheet-1', {
        frozenRows: 0,
        frozenCols: 0,
        rowMeta: [
          { row: 3, height: 30, hidden: false },
          { row: 3, height: 40, hidden: true },
        ],
        colMeta: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
