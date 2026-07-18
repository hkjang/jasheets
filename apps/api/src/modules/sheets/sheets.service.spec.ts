import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

interface UpsertInput {
  create: { row: number; col: number };
  update: { value?: unknown; formula?: string | null; format?: unknown };
}

interface CellMutationCreateInput {
  data: {
    requestHash: string;
    version: number;
  };
}

interface PrismaMock {
  sheet: { findUnique: jest.Mock; updateMany: jest.Mock };
  mergedRange: { findFirst: jest.Mock };
  cellMutation: {
    findUnique: jest.Mock;
    create: jest.Mock<Promise<unknown>, [CellMutationCreateInput]>;
  };
  cell: {
    findMany: jest.Mock;
    upsert: jest.Mock<Promise<unknown>, [UpsertInput]>;
  };
  $transaction: jest.Mock;
}

interface EventsServiceMock {
  detectCellChange: jest.Mock;
  detectMultiCellChange: jest.Mock;
}

describe('SheetsService cell updates', () => {
  const sheet = {
    id: 'sheet-1',
    spreadsheetId: 'spreadsheet-1',
    rowCount: 100,
    colCount: 26,
    version: 0,
  };
  let prisma: PrismaMock;
  let eventsService: EventsServiceMock;
  let service: SheetsService;

  beforeEach(() => {
    prisma = {
      sheet: {
        findUnique: jest.fn().mockResolvedValue(sheet),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      mergedRange: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cell: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest
          .fn<Promise<unknown>, [UpsertInput]>()
          .mockImplementation(({ create }: UpsertInput) =>
            Promise.resolve({ id: `${create.row}:${create.col}`, ...create }),
          ),
      },
      cellMutation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<Promise<unknown>, [CellMutationCreateInput]>()
          .mockResolvedValue({ id: 'mutation-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(
          (operation: (client: PrismaMock) => Promise<unknown>) =>
            operation(prisma),
        ),
    };
    eventsService = {
      detectCellChange: jest.fn().mockResolvedValue(undefined),
      detectMultiCellChange: jest.fn().mockResolvedValue(undefined),
    };
    service = new SheetsService(
      prisma as unknown as PrismaService,
      eventsService as unknown as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
  });

  it('commits a batch atomically and clears a stale formula for plain values', async () => {
    await service.updateCells('user-1', sheet.id, [
      { row: 1, col: 2, value: 'plain text' },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const upsertInput = prisma.cell.upsert.mock.calls[0][0];
    expect(upsertInput.update).toMatchObject({
      value: 'plain text',
      formula: null,
    });
  });

  it('rejects duplicate coordinates before writing', async () => {
    await expect(
      service.updateCells('user-1', sheet.id, [
        { row: 1, col: 2, value: 'first' },
        { row: 1, col: 2, value: 'second' },
      ]),
    ).rejects.toThrow('Duplicate cell coordinate');

    expect(prisma.cell.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a batch write to a non-anchor cell inside a merged range', async () => {
    prisma.mergedRange.findFirst.mockResolvedValueOnce({
      startRow: 2,
      startCol: 3,
      endRow: 4,
      endCol: 5,
    });

    await expect(
      service.updateCells('user-1', sheet.id, [
        { row: 3, col: 4, value: 'hidden value' },
      ]),
    ).rejects.toThrow('non-anchor cell inside a merged range');

    expect(prisma.mergedRange.findFirst).toHaveBeenCalledWith({
      where: {
        sheetId: sheet.id,
        OR: [
          {
            startRow: { lte: 3 },
            endRow: { gte: 3 },
            startCol: { lte: 4 },
            endCol: { gte: 4 },
            NOT: { startRow: 3, startCol: 4 },
          },
        ],
      },
      select: { startRow: true, startCol: true, endRow: true, endCol: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.cell.upsert).not.toHaveBeenCalled();
  });

  it('allows a batch write to the anchor cell of a merged range', async () => {
    await service.updateCells('user-1', sheet.id, [
      { row: 2, col: 3, value: 'anchor value' },
    ]);

    expect(prisma.mergedRange.findFirst).toHaveBeenCalled();
    expect(prisma.cell.upsert).toHaveBeenCalled();
  });

  it('rejects a single-cell write to a non-anchor merged coordinate', async () => {
    prisma.mergedRange.findFirst.mockResolvedValueOnce({
      startRow: 2,
      startCol: 3,
      endRow: 4,
      endCol: 5,
    });

    await expect(
      service.updateCell('user-1', sheet.id, 4, 5, { value: 'hidden value' }),
    ).rejects.toThrow('non-anchor cell inside a merged range');

    expect(prisma.cell.upsert).not.toHaveBeenCalled();
  });

  it.each([
    [-1, 0],
    [0.5, 0],
    [100, 0],
    [0, 26],
  ])(
    'rejects invalid or out-of-bounds coordinate (%s, %s)',
    async (row, col) => {
      await expect(
        service.updateCells('user-1', sheet.id, [{ row, col, value: 'x' }]),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('does not emit change events when the transaction fails', async () => {
    prisma.cell.upsert.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.updateCells('user-1', sheet.id, [{ row: 1, col: 1, value: 'x' }]),
    ).rejects.toThrow('database unavailable');

    expect(eventsService.detectCellChange).not.toHaveBeenCalled();
    expect(eventsService.detectMultiCellChange).not.toHaveBeenCalled();
  });

  it('rejects a stale expected version without writing cells', async () => {
    prisma.sheet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.updateCells(
        'user-1',
        sheet.id,
        [{ row: 1, col: 1, value: 'stale' }],
        3,
      ),
    ).rejects.toThrow('modified by another user');

    expect(prisma.cell.upsert).not.toHaveBeenCalled();
    expect(eventsService.detectCellChange).not.toHaveBeenCalled();
  });

  it('returns the recorded result when the same request is retried', async () => {
    prisma.cellMutation.findUnique.mockResolvedValueOnce({
      requestHash:
        '5e659ce3fe775e3f8eeca78e86cf1ac88c97ef3b517fa12efa63a9e4efdf2b57',
      version: 4,
    });

    const result = await service.updateCells(
      'user-1',
      sheet.id,
      [{ row: 1, col: 1, value: 'same' }],
      3,
      'retry-key',
    );

    expect(result).toEqual({ cells: [], version: 4, replayed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventsService.detectCellChange).not.toHaveBeenCalled();
  });

  it('replays an idempotent request when expectedVersion was omitted', async () => {
    const updates = [{ row: 1, col: 1, value: 'same without version' }];
    const firstResult = await service.updateCells(
      'user-1',
      sheet.id,
      updates,
      undefined,
      'versionless-retry',
    );
    const mutation = prisma.cellMutation.create.mock.calls[0][0].data;

    prisma.sheet.findUnique.mockResolvedValueOnce({ ...sheet, version: 1 });
    prisma.cellMutation.findUnique.mockResolvedValueOnce({
      requestHash: mutation.requestHash,
      version: mutation.version,
    });

    const replay = await service.updateCells(
      'user-1',
      sheet.id,
      updates,
      undefined,
      'versionless-retry',
    );

    expect(firstResult).toMatchObject({ version: 1 });
    expect(replay).toEqual({ cells: [], version: 1, replayed: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventsService.detectCellChange).toHaveBeenCalledTimes(1);
  });

  it('rejects an idempotency key reused for different content', async () => {
    prisma.cellMutation.findUnique.mockResolvedValueOnce({
      requestHash: 'different-hash',
      version: 4,
    });

    await expect(
      service.updateCells(
        'user-1',
        sheet.id,
        [{ row: 1, col: 1, value: 'new content' }],
        3,
        'reused-key',
      ),
    ).rejects.toThrow('already used for a different request');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays the winner when duplicate requests race', async () => {
    prisma.cellMutation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestHash:
          '5e659ce3fe775e3f8eeca78e86cf1ac88c97ef3b517fa12efa63a9e4efdf2b57',
        version: 4,
      });
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    const result = await service.updateCells(
      'user-1',
      sheet.id,
      [{ row: 1, col: 1, value: 'same' }],
      3,
      'racing-key',
    );

    expect(result).toEqual({ cells: [], version: 4, replayed: true });
    expect(eventsService.detectCellChange).not.toHaveBeenCalled();
  });

  it('rejects empty and oversized batches before querying the sheet', async () => {
    await expect(service.updateCells('user-1', sheet.id, [])).rejects.toThrow(
      'between 1 and 1000',
    );
    await expect(
      service.updateCells(
        'user-1',
        sheet.id,
        Array.from({ length: 1001 }, (_, row) => ({ row, col: 0, value: 'x' })),
      ),
    ).rejects.toThrow('between 1 and 1000');

    expect(prisma.sheet.findUnique).not.toHaveBeenCalled();
  });
});
