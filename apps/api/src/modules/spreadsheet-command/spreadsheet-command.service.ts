import { BadRequestException, Injectable } from '@nestjs/common';
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

  async execute(
    context: SpreadsheetCommandContext,
    command: SpreadsheetCommand,
  ) {
    switch (command.type) {
      case 'SET_CELLS':
        return await this.sheetsService.updateCells(
          context.userId,
          command.sheetId,
          command.updates,
          command.expectedVersion,
          command.idempotencyKey,
        );
      case 'WRITE_RANGE': {
        const rowCount = command.values.length;
        const colCount = command.values[0]?.length ?? 0;
        if (rowCount < 1 || colCount < 1) {
          throw new BadRequestException('Range values must not be empty');
        }
        if (command.values.some((row) => row.length !== colCount)) {
          throw new BadRequestException('Range values must be rectangular');
        }
        if (
          command.formulas &&
          (command.formulas.length !== rowCount ||
            command.formulas.some((row) => row.length !== colCount))
        ) {
          throw new BadRequestException(
            'Formula matrix must match the value matrix dimensions',
          );
        }
        if (rowCount * colCount > 1000) {
          throw new BadRequestException(
            'Range writes are limited to 1,000 cells',
          );
        }

        const updates = command.values.flatMap((row, rowOffset) =>
          row.map((value, colOffset) => ({
            row: command.startRow + rowOffset,
            col: command.startCol + colOffset,
            value,
            ...(command.formulas
              ? { formula: command.formulas[rowOffset][colOffset] }
              : {}),
          })),
        );
        const result = await this.sheetsService.updateCells(
          context.userId,
          command.sheetId,
          updates,
          command.expectedVersion,
          command.idempotencyKey,
        );
        return {
          ...result,
          range: {
            startRow: command.startRow,
            startCol: command.startCol,
            endRow: command.startRow + rowCount - 1,
            endCol: command.startCol + colCount - 1,
          },
        };
      }
      case 'CHANGE_STRUCTURE':
        return await this.sheetsService.changeStructure(
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
