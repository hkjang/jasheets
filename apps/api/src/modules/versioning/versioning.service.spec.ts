import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VersioningService } from './versioning.service';

describe('VersioningService', () => {
  const prisma = {
    spreadsheet: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    version: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const service = new VersioningService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

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
});
