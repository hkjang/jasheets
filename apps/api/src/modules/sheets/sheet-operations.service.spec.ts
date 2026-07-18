import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SheetsService } from './sheets.service';

describe('SheetsService sheet operations', () => {
  const spreadsheetId = 'spreadsheet-1';
  const tx = {
    sheet: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
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
    tx.sheet.findFirst.mockResolvedValue({ index: 4 });
    tx.sheet.create.mockResolvedValue({
      id: 'sheet-3',
      spreadsheetId,
      name: 'Forecast',
      index: 5,
    });
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
});
