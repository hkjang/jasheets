import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

interface UpsertInput {
  create: { row: number; col: number };
  update: { value?: unknown; formula?: string | null; format?: unknown };
}

interface PrismaMock {
  sheet: { findUnique: jest.Mock; updateMany: jest.Mock };
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
      cell: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest
          .fn<Promise<unknown>, [UpsertInput]>()
          .mockImplementation(({ create }: UpsertInput) =>
            Promise.resolve({ id: `${create.row}:${create.col}`, ...create }),
          ),
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
