import { ForbiddenException } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetsService } from './sheets.service';

describe('SheetsService searchWorkbook', () => {
  const prisma = { $queryRaw: jest.fn() };
  let service: SheetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SheetsService(
      prisma as unknown as PrismaService,
      {} as EventsService,
    );
    jest.spyOn(service, 'checkAccess').mockResolvedValue(true);
  });

  it('returns a bounded page with value/formula match metadata and a cursor', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        sheetName: 'Sales',
        sheetIndex: 0,
        row: 0,
        col: 0,
        value: 'Revenue',
        formula: null,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        sheetName: 'Sales',
        sheetIndex: 0,
        row: 1,
        col: 1,
        value: 100,
        formula: '=SUM(Revenue)',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        sheetId: '550e8400-e29b-41d4-a716-446655440002',
        sheetName: 'Forecast',
        sheetIndex: 1,
        row: 0,
        col: 0,
        value: 'Revenue plan',
        formula: null,
      },
    ]);

    const result = await service.searchWorkbook(
      'user-1',
      '550e8400-e29b-41d4-a716-446655440000',
      ' revenue ',
      { mode: 'all', limit: 2 },
    );

    expect(result).toMatchObject({
      query: 'revenue',
      hasMore: true,
      matches: [
        { sheetName: 'Sales', cell: 'A1', matchIn: ['value'] },
        { sheetName: 'Sales', cell: 'B2', matchIn: ['formula'] },
      ],
    });
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid cursors before querying cells', async () => {
    await expect(
      service.searchWorkbook('user-1', 'workbook-1', 'needle', {
        mode: 'values',
        limit: 10,
        cursor: 'not-a-valid-cursor',
      }),
    ).rejects.toThrow('cursor is invalid');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('enforces workbook access before searching', async () => {
    jest.spyOn(service, 'checkAccess').mockResolvedValueOnce(false);
    await expect(
      service.searchWorkbook('user-1', 'workbook-1', 'needle', {
        mode: 'all',
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
