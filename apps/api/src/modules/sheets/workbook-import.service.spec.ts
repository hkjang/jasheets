import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ImportWorkbookDto } from './dto/import-workbook.dto';
import { SheetsService } from './sheets.service';

const model = () => ({
  create: jest.fn(),
  createMany: jest.fn().mockResolvedValue({ count: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  findMany: jest.fn(),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
});

describe('SheetsService workbook import', () => {
  const existing = [
    { id: 'sheet-1', name: 'Old one', index: 0, version: 4 },
    { id: 'sheet-2', name: 'Keep me', index: 1, version: 2 },
  ];
  const sourceSheet = {
    name: 'Imported',
    rowCount: 20,
    colCount: 10,
    frozenRows: 1,
    frozenCols: 2,
    defaultRowHeight: 25,
    defaultColWidth: 100,
    cells: [{ row: 0, col: 0, value: 'hello', format: { bold: true } }],
    rowMeta: [{ row: 1, height: 30, hidden: false }],
    colMeta: [{ col: 2, width: 140, hidden: false }],
    mergedRanges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }],
  };
  let tx: ReturnType<typeof createTransactionMock>;
  let prisma: {
    spreadsheet: ReturnType<typeof model>;
    $transaction: jest.Mock;
  };
  let service: SheetsService;

  function createTransactionMock() {
    return {
      spreadsheet: model(),
      sheet: model(),
      cell: model(),
      rowMeta: model(),
      colMeta: model(),
      mergedRange: model(),
      conditionalRule: model(),
      chart: model(),
      pivotTable: model(),
    };
  }

  function dto(overrides: Partial<ImportWorkbookDto> = {}): ImportWorkbookDto {
    return {
      mode: 'replace',
      sheets: [structuredClone(sourceSheet)],
      expectedSheetVersions: existing.map(({ id, version }) => ({
        sheetId: id,
        version,
      })),
      ...overrides,
    } as ImportWorkbookDto;
  }

  beforeEach(() => {
    tx = createTransactionMock();
    tx.sheet.findMany.mockResolvedValue(existing);
    tx.spreadsheet.findMany.mockResolvedValue([]);
    (tx.spreadsheet as unknown as { findFirst: jest.Mock }).findFirst = jest
      .fn()
      .mockResolvedValue({ ownerId: 'user-1', permissions: [] });
    tx.sheet.create.mockResolvedValue({
      id: 'created-sheet',
      name: 'Imported',
      version: 0,
    });
    prisma = {
      spreadsheet: model(),
      $transaction: jest.fn(async (operation) => operation(tx)),
    };
    service = new SheetsService(
      prisma as unknown as PrismaService,
      {
        detectCellChange: jest.fn(),
        detectMultiCellChange: jest.fn(),
      } as unknown as EventsService,
    );
    jest.spyOn(service, 'checkEditAccess').mockResolvedValue(undefined);
  });

  it('replaces content atomically while preserving surplus sheet records', async () => {
    const result = await service.importWorkbook(
      'user-1',
      'spreadsheet-1',
      dto(),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'sheet-1', version: 4 },
      data: expect.objectContaining({
        rowCount: 20,
        version: { increment: 1 },
      }),
    });
    expect(tx.sheet.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      'name',
    );
    expect(tx.cell.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1' },
    });
    expect(tx.conditionalRule.deleteMany).not.toHaveBeenCalled();
    expect(tx.chart.deleteMany).not.toHaveBeenCalled();
    expect(tx.pivotTable.deleteMany).not.toHaveBeenCalled();
    expect(tx.cell.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sheetId: 'sheet-1',
          row: 0,
          col: 0,
          value: 'hello',
        }),
      ],
    });
    expect(tx.sheet.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      mode: 'replace',
      preservedSheetCount: 1,
      imported: [{ id: 'sheet-1', name: 'Old one', version: 5 }],
    });
  });

  it('appends at the next durable tab index without modifying existing content', async () => {
    const result = await service.importWorkbook(
      'user-1',
      'spreadsheet-1',
      dto({ mode: 'append' }),
    );

    expect(tx.sheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        spreadsheetId: 'spreadsheet-1',
        name: 'Imported',
        index: 2,
      }),
      select: { id: true, name: true, version: true },
    });
    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
    expect(tx.cell.deleteMany).not.toHaveBeenCalled();
    expect(result.preservedSheetCount).toBe(2);
  });

  it('rejects stale or incomplete sheet versions before any writes', async () => {
    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({
          expectedSheetVersions: [{ sheetId: 'sheet-1', version: 3 }],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.sheet.updateMany).not.toHaveBeenCalled();
    expect(tx.sheet.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping merges and non-anchor merged-cell data', async () => {
    const invalid = structuredClone(sourceSheet);
    invalid.mergedRanges.push({
      startRow: 0,
      startCol: 1,
      endRow: 1,
      endCol: 1,
    });

    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({ sheets: [invalid] }),
      ),
    ).rejects.toThrow('Merged ranges overlap');

    invalid.mergedRanges.pop();
    invalid.cells.push({ row: 0, col: 1, value: 'hidden' } as never);
    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({ sheets: [invalid] }),
      ),
    ).rejects.toThrow('Non-anchor cell');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsafe, duplicate and oversized cell payloads', async () => {
    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({ sheets: [{ ...sourceSheet, name: 'bad/name' }] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({
          mode: 'append',
          sheets: [{ ...sourceSheet, name: 'keep me' }],
        }),
      ),
    ).rejects.toThrow('unique');

    const large = structuredClone(sourceSheet);
    large.cells[0].value = 'x'.repeat(50_001);
    await expect(
      service.importWorkbook(
        'user-1',
        'spreadsheet-1',
        dto({ sheets: [large] }),
      ),
    ).rejects.toThrow('oversized string');
  });
});
