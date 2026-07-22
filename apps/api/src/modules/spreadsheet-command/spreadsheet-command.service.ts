import { Injectable } from '@nestjs/common';
import { SheetsService } from '../sheets/sheets.service';
import {
  SpreadsheetCommand,
  SpreadsheetCommandContext,
} from './spreadsheet-command.types';

/**
 * Shared mutation boundary for UI, API, automation and MCP adapters.
 *
 * Adapters must never inject Prisma directly. Permissions, optimistic
 * concurrency and idempotency remain enforced by the domain services called
 * from this boundary while writes are migrated behind dedicated handlers.
 */
@Injectable()
export class SpreadsheetCommandService {
  constructor(private readonly sheetsService: SheetsService) {}

  execute(context: SpreadsheetCommandContext, command: SpreadsheetCommand) {
    switch (command.type) {
      case 'SET_CELLS':
        return this.sheetsService.updateCells(
          context.userId,
          command.sheetId,
          command.updates,
          command.expectedVersion,
          command.idempotencyKey,
        );
      case 'CHANGE_STRUCTURE':
        return this.sheetsService.changeStructure(
          context.userId,
          command.sheetId,
          {
            axis: command.axis,
            type: command.operation,
            index: command.index,
          },
        );
    }
  }
}
