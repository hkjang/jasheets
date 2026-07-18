import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConditionalRulesService } from './conditional-rules.service';

describe('ConditionalRulesService', () => {
  const prisma = {
    sheet: { findUnique: jest.fn() },
    conditionalRule: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
  const service = new ConditionalRulesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sheet.findUnique.mockResolvedValue({
      spreadsheet: { ownerId: 'user-1', isPublic: false, permissions: [] },
    });
    prisma.conditionalRule.findMany.mockResolvedValue([
      { id: 'rule-1' },
      { id: 'rule-2' },
    ]);
    prisma.conditionalRule.update.mockResolvedValue({});
  });

  it('rejects foreign, missing, or duplicate rule ids during reorder', async () => {
    await expect(service.reorderRules('user-1', 'sheet-1', ['rule-1', 'foreign']))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorderRules('user-1', 'sheet-1', ['rule-1', 'rule-1']))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conditionalRule.update).not.toHaveBeenCalled();
  });

  it('reorders only a complete set of rules belonging to the sheet', async () => {
    prisma.conditionalRule.findMany
      .mockResolvedValueOnce([{ id: 'rule-1' }, { id: 'rule-2' }])
      .mockResolvedValueOnce([{ id: 'rule-2' }, { id: 'rule-1' }]);

    await service.reorderRules('user-1', 'sheet-1', ['rule-2', 'rule-1']);

    expect(prisma.conditionalRule.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'rule-2' },
      data: { priority: 0 },
    });
    expect(prisma.conditionalRule.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'rule-1' },
      data: { priority: 1 },
    });
  });
});
