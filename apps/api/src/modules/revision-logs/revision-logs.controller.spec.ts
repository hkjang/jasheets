import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';
import { RevisionLogsController } from './revision-logs.controller';
import { RevisionLogsService } from './revision-logs.service';

describe('RevisionLogsController rollback', () => {
  it('routes REST rollback through SpreadsheetCommandService', async () => {
    const revisions = {} as RevisionLogsService;
    const commands = {
      execute: jest.fn().mockResolvedValue({ version: 9, restoredCells: 1 }),
    };
    const controller = new RevisionLogsController(
      revisions,
      commands as unknown as SpreadsheetCommandService,
    );

    await expect(
      controller.rollbackToRevision(
        { user: { id: 'user-1' } },
        'sheet-1',
        'revision-1',
        { expectedVersion: 8, idempotencyKey: 'rollback-rest-1' },
      ),
    ).resolves.toEqual({ version: 9, restoredCells: 1 });
    expect(commands.execute).toHaveBeenCalledWith(
      { userId: 'user-1', actorType: 'USER' },
      {
        type: 'ROLLBACK_REVISION',
        revisionId: 'revision-1',
        sheetId: 'sheet-1',
        expectedVersion: 8,
        idempotencyKey: 'rollback-rest-1',
      },
    );
  });
});
