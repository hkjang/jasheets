import { PrismaService } from '../../prisma/prisma.service';
import { RevisionLogsService } from './revision-logs.service';

describe('RevisionLogsService getRevisionHistory', () => {
  const prisma = {
    sheet: { findUnique: jest.fn() },
    revisionLog: { findMany: jest.fn() },
  };
  let service: RevisionLogsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RevisionLogsService(prisma as unknown as PrismaService);
    prisma.sheet.findUnique.mockResolvedValue({
      spreadsheet: {
        ownerId: 'user-1',
        isPublic: false,
        permissions: [],
      },
    });
    prisma.revisionLog.findMany.mockResolvedValue([
      {
        id: 'revision-3',
        sheetId: 'sheet-1',
        sheetVersion: 3,
        action: 'BULK_UPDATE',
        targetRange: 'A1:B2',
        description: 'Updated 4 cell(s)',
        previousData: [{ row: 0, col: 0, value: 1 }],
        newData: [{ row: 0, col: 0, value: 2 }],
        createdAt: new Date('2026-07-23T01:00:00Z'),
        user: { id: 'user-1', email: 'user@example.com', name: 'User' },
      },
      { id: 'revision-2' },
      { id: 'revision-1' },
    ]);
  });

  it('returns a bounded cursor page and omits payloads by default', async () => {
    const result = await service.getRevisionHistory('user-1', 'sheet-1', {
      limit: 2,
      action: 'BULK_UPDATE',
    });

    expect(prisma.revisionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sheetId: 'sheet-1', action: 'BULK_UPDATE' },
        take: 3,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toMatchObject({ hasMore: true, nextCursor: 'revision-2' });
    expect(result.revisions[0]).not.toHaveProperty('previousData');
    expect(result.revisions[0]).not.toHaveProperty('newData');
  });

  it('includes change payloads and applies a cursor when requested', async () => {
    prisma.revisionLog.findMany.mockResolvedValueOnce([
      {
        id: 'revision-1',
        previousData: [{ value: 1 }],
        newData: [{ value: 2 }],
      },
    ]);
    const result = await service.getRevisionHistory('user-1', 'sheet-1', {
      limit: 10,
      cursor: 'revision-2',
      includeChanges: true,
    });

    expect(prisma.revisionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'revision-2' }, skip: 1 }),
    );
    expect(result.revisions[0]).toMatchObject({
      previousData: [{ value: 1 }],
      newData: [{ value: 2 }],
    });
  });

  it('rejects users without workbook access before reading history', async () => {
    prisma.sheet.findUnique.mockResolvedValueOnce({
      spreadsheet: {
        ownerId: 'owner-1',
        isPublic: false,
        permissions: [],
      },
    });

    await expect(
      service.getRevisionHistory('user-1', 'sheet-1', { limit: 10 }),
    ).rejects.toThrow('No access');
    expect(prisma.revisionLog.findMany).not.toHaveBeenCalled();
  });
});
