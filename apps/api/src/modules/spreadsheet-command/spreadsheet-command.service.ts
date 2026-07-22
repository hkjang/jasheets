import { BadRequestException, Injectable } from '@nestjs/common';
import { shiftFormulaReferences } from '@jasheets/formula-engine';
import { createHash } from 'node:crypto';
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
        const { rowCount, colCount } = this.validateMatrix(
          command.values,
          command.formulas,
        );
        const updates = this.expandMatrix(
          command.startRow,
          command.startCol,
          command.values,
          command.formulas,
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
      case 'APPEND_ROWS': {
        const replay = await this.sheetsService.getCellMutationReplay(
          context.userId,
          command.sheetId,
          command.idempotencyKey,
        );
        if (replay) {
          const metadata =
            replay.metadata &&
            typeof replay.metadata === 'object' &&
            !Array.isArray(replay.metadata)
              ? replay.metadata
              : {};
          return { ...replay, ...metadata };
        }
        const { rowCount, colCount } = this.validateMatrix(
          command.values,
          command.formulas,
        );
        const startCol = command.startCol ?? 0;
        if (!Number.isInteger(startCol) || startCol < 0) {
          throw new BadRequestException(
            'Append start column must be a non-negative integer',
          );
        }
        const target = await this.sheetsService.getAppendTarget(
          context.userId,
          command.sheetId,
          rowCount,
          startCol,
          colCount,
        );
        const updates = this.expandMatrix(
          target.startRow,
          startCol,
          command.values,
          command.formulas,
        );
        const range = {
          startRow: target.startRow,
          startCol,
          endRow: target.startRow + rowCount - 1,
          endCol: startCol + colCount - 1,
        };
        const result = await this.sheetsService.updateCells(
          context.userId,
          command.sheetId,
          updates,
          command.expectedVersion ?? target.version,
          command.idempotencyKey,
          { range },
        );
        return {
          ...result,
          range,
        };
      }
      case 'APPLY_FORMULA': {
        if (!command.formula.startsWith('=')) {
          throw new BadRequestException('Formula must start with =');
        }
        if (command.formula.length > 8192) {
          throw new BadRequestException('Formula exceeds 8,192 characters');
        }
        const rowCount = command.endRow - command.startRow + 1;
        const colCount = command.endCol - command.startCol + 1;
        if (
          command.startRow < 0 ||
          command.startCol < 0 ||
          rowCount < 1 ||
          colCount < 1 ||
          ![
            command.startRow,
            command.startCol,
            command.endRow,
            command.endCol,
          ].every(Number.isInteger)
        ) {
          throw new BadRequestException('Formula range is invalid');
        }
        if (rowCount * colCount > 1000) {
          throw new BadRequestException(
            'Formula application is limited to 1,000 cells',
          );
        }
        const updates = Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: colCount }, (_, colOffset) => ({
            row: command.startRow + rowOffset,
            col: command.startCol + colOffset,
            value: null,
            formula: shiftFormulaReferences(
              command.formula,
              rowOffset,
              colOffset,
            ),
          })),
        ).flat();
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
            endRow: command.endRow,
            endCol: command.endCol,
          },
          appliedCells: updates.length,
        };
      }
      case 'CREATE_PIVOT': {
        const pivotId = this.commandUuid(
          context.userId,
          command.sheetId,
          command.idempotencyKey,
        );
        return await this.sheetsService.createPivotTable(
          context.userId,
          command.sheetId,
          { ...command.pivot, id: pivotId },
          command.expectedVersion,
        );
      }
      case 'CREATE_CHART': {
        const chartId = this.commandUuid(
          context.userId,
          command.sheetId,
          command.idempotencyKey,
        );
        return await this.sheetsService.createChart(
          context.userId,
          command.sheetId,
          { ...command.chart, id: chartId },
          command.expectedVersion,
        );
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

  private validateMatrix(
    values: unknown[][],
    formulas?: Array<Array<string | null>>,
  ) {
    const rowCount = values.length;
    const colCount = values[0]?.length ?? 0;
    if (rowCount < 1 || colCount < 1) {
      throw new BadRequestException('Range values must not be empty');
    }
    if (values.some((row) => row.length !== colCount)) {
      throw new BadRequestException('Range values must be rectangular');
    }
    if (
      formulas &&
      (formulas.length !== rowCount ||
        formulas.some((row) => row.length !== colCount))
    ) {
      throw new BadRequestException(
        'Formula matrix must match the value matrix dimensions',
      );
    }
    if (rowCount * colCount > 1000) {
      throw new BadRequestException('Range writes are limited to 1,000 cells');
    }
    return { rowCount, colCount };
  }

  private expandMatrix(
    startRow: number,
    startCol: number,
    values: unknown[][],
    formulas?: Array<Array<string | null>>,
  ) {
    return values.flatMap((row, rowOffset) =>
      row.map((value, colOffset) => ({
        row: startRow + rowOffset,
        col: startCol + colOffset,
        value,
        ...(formulas ? { formula: formulas[rowOffset][colOffset] } : {}),
      })),
    );
  }

  private commandUuid(userId: string, sheetId: string, key: string): string {
    const hex = createHash('sha256')
      .update(`${userId}\u0000${sheetId}\u0000${key}`)
      .digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
}
