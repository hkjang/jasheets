import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VersioningService } from './versioning.service';

const model = () => ({
  create: jest.fn(),
  createMany: jest.fn(),
  deleteMany: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
});

describe('VersioningService', () => {
  const tx = {
    cell: model(),
    chart: model(),
    colMeta: model(),
    conditionalRule: model(),
    crossSheetReference: model(),
    mergedRange: model(),
    pivotTable: model(),
    rowMeta: model(),
    sheet: model(),
    spreadsheet: model(),
  };
  const prisma = {
    spreadsheet: model(),
    permission: model(),
    version: model(),
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new VersioningService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.sheet.findMany.mockResolvedValue([]);
    tx.sheet.updateMany.mockResolvedValue({ count: 1 });
  });

  it('does not let a viewer create a restorable version', async () => {
    prisma.spreadsheet.findUnique.mockResolvedValue({
      id: 'spreadsheet-1',
      ownerId: 'owner-1',
      sheets: [],
      permissions: [{ role: 'VIEWER' }],
    });

    await expect(
      service.createVersion('viewer-1', 'spreadsheet-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.version.create).not.toHaveBeenCalled();
  });

  it('captures workbook content without security or user-scoped metadata', async () => {
    prisma.spreadsheet.findUnique.mockResolvedValue({
      id: 'spreadsheet-1',
      name: 'Budget',
      ownerId: 'owner-1',
      permissions: [],
      sheets: [
        {
          id: 'sheet-1',
          name: 'Q1',
          index: 0,
          rowCount: 100,
          colCount: 20,
          frozenRows: 1,
          frozenCols: 2,
          defaultRowHeight: 30,
          defaultColWidth: 120,
          version: 7,
          cells: [{ row: 1, col: 2, value: 3, formula: '=1+2' }],
          rowMeta: [{ row: 1, height: 40, hidden: false }],
          colMeta: [{ col: 2, width: 150, hidden: true }],
          mergedRanges: [
            {
              id: 'merge-1',
              startRow: 1,
              startCol: 1,
              endRow: 1,
              endCol: 2,
            },
          ],
          conditionalRules: [
            {
              id: 'rule-1',
              name: 'High',
              priority: 0,
              ranges: ['A1:A5'],
              conditions: [{ operator: 'gt', value: 10 }],
              format: { bold: true },
              active: true,
            },
          ],
          charts: [
            {
              id: 'chart-1',
              type: 'bar',
              x: 1,
              y: 2,
              width: 300,
              height: 200,
              data: { labels: [] },
              options: null,
            },
          ],
          pivotTables: [
            {
              id: 'pivot-1',
              name: 'Summary',
              config: { rows: [] },
              sourceRange: 'A1:B5',
              targetCell: 'D1',
            },
          ],
          sourceReferences: [
            {
              id: 'ref-1',
              sourceSheetId: 'sheet-1',
              sourceCell: 'A1',
              targetSheetId: 'sheet-1',
              targetCell: 'B1',
              formula: '=B1',
            },
          ],
          comments: [{ id: 'comment-1' }],
          filterProfiles: [{ id: 'filter-1' }],
          sheetPermissions: [{ id: 'permission-1' }],
        },
      ],
    });
    prisma.version.create.mockImplementation(({ data }) => data);

    const result = (await service.createVersion(
      'owner-1',
      'spreadsheet-1',
    )) as any;

    expect(result.snapshot).toEqual(
      expect.objectContaining({
        schemaVersion: 2,
        spreadsheet: { name: 'Budget' },
        crossSheetReferences: [expect.objectContaining({ id: 'ref-1' })],
        sheets: [
          expect.objectContaining({
            id: 'sheet-1',
            rowMeta: [{ row: 1, height: 40, hidden: false }],
            mergedRanges: [expect.objectContaining({ id: 'merge-1' })],
            conditionalRules: [expect.objectContaining({ id: 'rule-1' })],
            charts: [expect.objectContaining({ id: 'chart-1' })],
            pivotTables: [expect.objectContaining({ id: 'pivot-1' })],
          }),
        ],
      }),
    );
    expect(JSON.stringify(result.snapshot)).not.toContain('comment-1');
    expect(JSON.stringify(result.snapshot)).not.toContain('filter-1');
    expect(JSON.stringify(result.snapshot)).not.toContain('permission-1');
  });

  it('returns metadata-only collaborator history with a bounded limit', async () => {
    prisma.spreadsheet.findFirst.mockResolvedValue({
      ownerId: 'owner-1',
      permissions: [{ id: 'permission-1' }],
    });
    prisma.version.findMany.mockResolvedValue([]);

    await service.getVersions('reader-1', 'spreadsheet-1', 1000);

    expect(prisma.version.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        select: expect.objectContaining({
          id: true,
          name: true,
          createdAt: true,
        }),
      }),
    );
    expect(prisma.version.findMany.mock.calls[0][0]).not.toHaveProperty(
      'include',
    );
  });

  it('rejects access to versions of a deleted spreadsheet', async () => {
    prisma.version.findUnique.mockResolvedValue({
      id: 'version-1',
      spreadsheetId: 'spreadsheet-1',
      spreadsheet: {
        ownerId: 'owner-1',
        deletedAt: new Date(),
      },
    });

    await expect(
      service.getVersion('owner-1', 'version-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores a full snapshot atomically while preserving newer sheets', async () => {
    const snapshot = {
      schemaVersion: 2 as const,
      spreadsheet: { name: 'Old budget' },
      cells: [{ sheetId: 'sheet-1', row: 0, col: 0, value: 42 }],
      sheets: [
        {
          id: 'sheet-1',
          name: 'Restored',
          index: 0,
          rowCount: 50,
          colCount: 10,
          version: 3,
          rowMeta: [{ row: 0, height: 35, hidden: false }],
          colMeta: [],
          mergedRanges: [],
          conditionalRules: [],
          charts: [],
          pivotTables: [],
        },
      ],
      crossSheetReferences: [],
    };
    jest.spyOn(service, 'getVersion').mockResolvedValue({
      id: 'version-1',
      name: 'Before',
      createdAt: new Date('2026-01-01'),
      spreadsheetId: 'spreadsheet-1',
      spreadsheet: { ownerId: 'owner-1' },
      snapshot,
    } as any);
    jest.spyOn(service, 'createVersion').mockResolvedValue({} as any);
    prisma.permission.findFirst.mockResolvedValue(null);
    tx.sheet.findMany
      .mockResolvedValueOnce([
        { id: 'sheet-1', index: 0, version: 8 },
        { id: 'new-sheet', index: 1, version: 2 },
      ])
      .mockResolvedValueOnce([
        { id: 'sheet-1', spreadsheetId: 'spreadsheet-1' },
      ]);

    await service.restoreVersion('owner-1', 'version-1');

    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'sheet-1', version: 8 },
      data: { version: { increment: 1 } },
    });
    expect(tx.sheet.updateMany).toHaveBeenCalledWith({
      where: { id: 'new-sheet', version: 2 },
      data: { version: { increment: 1 } },
    });
    expect(tx.sheet.deleteMany).not.toHaveBeenCalled();
    expect(tx.rowMeta.createMany).toHaveBeenCalledWith({
      data: [{ sheetId: 'sheet-1', row: 0, height: 35, hidden: false }],
    });
    expect(tx.sheet.update).toHaveBeenCalledWith({
      where: { id: 'new-sheet' },
      data: { index: 1 },
    });
    expect(tx.spreadsheet.update).toHaveBeenCalledWith({
      where: { id: 'spreadsheet-1' },
      data: { name: 'Old budget', updatedAt: expect.any(Date) },
    });
  });

  it('preserves extended metadata when restoring a legacy cell snapshot', async () => {
    jest.spyOn(service, 'getVersion').mockResolvedValue({
      id: 'version-1',
      name: null,
      createdAt: new Date('2026-01-01'),
      spreadsheetId: 'spreadsheet-1',
      spreadsheet: { ownerId: 'owner-1' },
      snapshot: {
        sheets: [{ id: 'sheet-1', name: 'Sheet 1', index: 0 }],
        cells: [{ sheetId: 'sheet-1', row: 0, col: 0, value: 'old' }],
      },
    } as any);
    jest.spyOn(service, 'createVersion').mockResolvedValue({} as any);
    prisma.permission.findFirst.mockResolvedValue(null);
    tx.sheet.findMany
      .mockResolvedValueOnce([{ id: 'sheet-1', index: 0, version: 4 }])
      .mockResolvedValueOnce([
        { id: 'sheet-1', spreadsheetId: 'spreadsheet-1' },
      ]);

    await service.restoreVersion('owner-1', 'version-1');

    expect(tx.cell.deleteMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1' },
    });
    expect(tx.cell.createMany).toHaveBeenCalled();
    expect(tx.rowMeta.deleteMany).not.toHaveBeenCalled();
    expect(tx.mergedRange.deleteMany).not.toHaveBeenCalled();
    expect(tx.conditionalRule.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a snapshot that claims a sheet from another workbook', async () => {
    jest.spyOn(service, 'getVersion').mockResolvedValue({
      id: 'version-1',
      name: null,
      createdAt: new Date(),
      spreadsheetId: 'spreadsheet-1',
      spreadsheet: { ownerId: 'owner-1' },
      snapshot: {
        schemaVersion: 2,
        sheets: [{ id: 'foreign-sheet', name: 'Foreign', index: 0 }],
        cells: [],
      },
    } as any);
    jest.spyOn(service, 'createVersion').mockResolvedValue({} as any);
    prisma.permission.findFirst.mockResolvedValue(null);
    tx.sheet.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'foreign-sheet', spreadsheetId: 'spreadsheet-2' },
      ]);

    await expect(
      service.restoreVersion('owner-1', 'version-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.cell.deleteMany).not.toHaveBeenCalled();
  });

  it('aborts restore if optimistic sheet claiming loses a race', async () => {
    jest.spyOn(service, 'getVersion').mockResolvedValue({
      id: 'version-1',
      name: null,
      createdAt: new Date(),
      spreadsheetId: 'spreadsheet-1',
      spreadsheet: { ownerId: 'owner-1' },
      snapshot: {
        sheets: [{ id: 'sheet-1', name: 'Sheet', index: 0 }],
        cells: [],
      },
    } as any);
    jest.spyOn(service, 'createVersion').mockResolvedValue({} as any);
    prisma.permission.findFirst.mockResolvedValue(null);
    tx.sheet.findMany
      .mockResolvedValueOnce([{ id: 'sheet-1', index: 0, version: 9 }])
      .mockResolvedValueOnce([
        { id: 'sheet-1', spreadsheetId: 'spreadsheet-1' },
      ]);
    tx.sheet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.restoreVersion('owner-1', 'version-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.cell.deleteMany).not.toHaveBeenCalled();
  });
});
