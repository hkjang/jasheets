import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpreadsheetDto } from './dto/create-spreadsheet.dto';
import { UpdateSpreadsheetDto } from './dto/update-spreadsheet.dto';
import { PermissionRole, Prisma } from '@prisma/client';
import { EventsService, CellChangeEvent } from '../events/events.service';
import { createHash } from 'crypto';
import { rewriteSheetReferences } from './sheet-reference.util';
import { rewriteConditionalRanges } from './conditional-range.util';

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private readonly maxSheetsPerSpreadsheet = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async create(userId: string, dto: CreateSpreadsheetDto) {
    const sheetsCreateInput = dto.data?.sheets
      ? {
          create: dto.data.sheets.map((sheet: any, index: number) => ({
            name: sheet.name,
            index: index,
            cells: sheet.cells
              ? {
                  create: Object.entries(sheet.cells).map(
                    ([key, cell]: [string, any]) => {
                      const [row, col] = key.split(':').map(Number);
                      return { row, col, ...cell };
                    },
                  ),
                }
              : undefined,
          })),
        }
      : {
          create: {
            name: 'Sheet1',
            index: 0,
          },
        };

    return this.prisma.spreadsheet.create({
      data: {
        name: dto.name,
        ownerId: userId,
        sheets: sheetsCreateInput,
        permissions: {
          create: {
            userId,
            role: PermissionRole.OWNER,
          },
        },
      },
      include: {
        sheets: true,
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  async findAll(userId: string, filter?: string, search?: string) {
    const where: any = { deletedAt: null };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (filter === 'favorites') {
      where.favorites = { some: { userId } };
    } else if (filter === 'shared') {
      where.AND = [
        { ownerId: { not: userId } },
        { permissions: { some: { userId } } },
      ];
    } else if (filter === 'created') {
      where.ownerId = userId;
    } else {
      where.OR = [{ ownerId: userId }, { permissions: { some: { userId } } }];
    }

    const spreadsheets = await this.prisma.spreadsheet.findMany({
      where,
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        _count: { select: { sheets: true } },
        favorites: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return spreadsheets.map((s) => ({
      ...s,
      isFavorite: s.favorites.length > 0,
    }));
  }

  async toggleFavorite(userId: string, spreadsheetId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_spreadsheetId: { userId, spreadsheetId },
      },
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });
      return { isFavorite: false };
    } else {
      await this.prisma.favorite.create({
        data: { userId, spreadsheetId },
      });
      return { isFavorite: true };
    }
  }

  async findAllAdmin() {
    return this.prisma.spreadsheet.findMany({
      where: { deletedAt: null },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        _count: { select: { sheets: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listTrash(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.isAdmin || false; // TODO: Check Role logic as well if needed

    if (isAdmin) {
      return this.prisma.spreadsheet.findMany({
        where: { NOT: { deletedAt: null } },
        include: {
          owner: {
            select: { id: true, email: true, name: true, avatar: true },
          },
          _count: { select: { sheets: true } },
        },
        orderBy: { deletedAt: 'desc' },
      });
    }

    return this.prisma.spreadsheet.findMany({
      where: {
        AND: [{ NOT: { deletedAt: null } }, { ownerId: userId }],
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        _count: { select: { sheets: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(userId: string, id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.isAdmin || false;

    if (spreadsheet.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException('Only owner or admin can restore');
    }

    return this.prisma.spreadsheet.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Hard delete
  async hardDelete(userId: string, id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.isAdmin || false;

    if (!isAdmin && spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.spreadsheet.delete({ where: { id } });
  }

  async findOne(userId: string, id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        sheets: {
          orderBy: { index: 'asc' },
          include: {
            cells: true,
            rowMeta: true,
            colMeta: true,
            charts: true,
            pivotTables: true,
            conditionalRules: { orderBy: { priority: 'asc' } },
          },
        },
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        permissions: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    // Check access
    const hasAccess = await this.checkAccess(userId, id);
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this spreadsheet',
      );
    }

    return spreadsheet;
  }

  async update(userId: string, id: string, dto: UpdateSpreadsheetDto) {
    await this.checkEditAccess(userId, id);

    return this.prisma.spreadsheet.update({
      where: { id },
      data: {
        name: dto.name,
      },
      include: {
        sheets: true,
        owner: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    if (spreadsheet.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the owner can delete this spreadsheet',
      );
    }

    return this.prisma.spreadsheet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async removeAdmin(id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    return this.prisma.spreadsheet.delete({
      where: { id },
    });
  }

  // Sheet operations
  async addSheet(userId: string, spreadsheetId: string, name: string) {
    await this.checkEditAccess(userId, spreadsheetId);

    return this.prisma.$transaction(
      async (tx) => {
        const sheetCount = await tx.sheet.count({ where: { spreadsheetId } });
        if (sheetCount >= this.maxSheetsPerSpreadsheet) {
          throw new BadRequestException(
            `A spreadsheet can contain at most ${this.maxSheetsPerSpreadsheet} sheets`,
          );
        }

        await this.assertUniqueSheetName(tx, spreadsheetId, name);

        const lastSheet = await tx.sheet.findFirst({
          where: { spreadsheetId },
          orderBy: { index: 'desc' },
        });

        return tx.sheet.create({
          data: {
            spreadsheetId,
            name,
            index: (lastSheet?.index ?? -1) + 1,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 60_000,
      },
    );
  }

  async updateSheet(userId: string, sheetId: string, data: { name: string }) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    if (sheet.name === data.name) return sheet;

    return this.prisma.$transaction(
      async (tx) => {
        await this.assertUniqueSheetName(
          tx,
          sheet.spreadsheetId,
          data.name,
          sheetId,
        );
        await this.rewriteStoredSheetReferences(
          tx,
          sheet.spreadsheetId,
          sheet.name,
          data.name,
        );
        return tx.sheet.update({ where: { id: sheetId }, data });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 60_000,
      },
    );
  }

  async deleteSheet(userId: string, sheetId: string) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    return this.prisma.$transaction(
      async (tx) => {
        const sheetCount = await tx.sheet.count({
          where: { spreadsheetId: sheet.spreadsheetId },
        });
        if (sheetCount <= 1) {
          throw new ForbiddenException('Cannot delete the last sheet');
        }
        await this.rewriteStoredSheetReferences(
          tx,
          sheet.spreadsheetId,
          sheet.name,
          undefined,
          sheetId,
        );
        return tx.sheet.delete({ where: { id: sheetId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async duplicateSheet(userId: string, sheetId: string) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { id: true, spreadsheetId: true },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    await this.checkEditAccess(userId, sheet.spreadsheetId);

    return this.prisma.$transaction(
      async (tx) => {
        const sheetCount = await tx.sheet.count({
          where: { spreadsheetId: sheet.spreadsheetId },
        });
        if (sheetCount >= this.maxSheetsPerSpreadsheet) {
          throw new BadRequestException(
            `A spreadsheet can contain at most ${this.maxSheetsPerSpreadsheet} sheets`,
          );
        }
        const source = await tx.sheet.findUnique({
          where: { id: sheetId },
          include: {
            cells: true,
            rowMeta: true,
            colMeta: true,
            charts: true,
            pivotTables: true,
            conditionalRules: true,
          },
        });
        if (!source || source.spreadsheetId !== sheet.spreadsheetId) {
          throw new NotFoundException('Sheet not found');
        }
        const existingNames = await tx.sheet.findMany({
          where: { spreadsheetId: sheet.spreadsheetId },
          select: { name: true },
        });
        const names = new Set(
          existingNames.map(({ name }) => name.toLocaleLowerCase()),
        );
        const baseName = `Copy of ${source.name}`.slice(0, 100);
        let name = baseName;
        let suffix = 2;
        while (names.has(name.toLocaleLowerCase())) {
          const ending = ` (${suffix++})`;
          name = `${baseName.slice(0, 100 - ending.length)}${ending}`;
        }

        const created = await tx.sheet.create({
          data: {
            spreadsheetId: source.spreadsheetId,
            name,
            index: sheetCount,
            rowCount: source.rowCount,
            colCount: source.colCount,
            frozenRows: source.frozenRows,
            frozenCols: source.frozenCols,
            defaultRowHeight: source.defaultRowHeight,
            defaultColWidth: source.defaultColWidth,
          },
        });
        await this.copySheetContent(tx, source, created.id);
        return tx.sheet.findUnique({
          where: { id: created.id },
          include: {
            cells: true,
            rowMeta: true,
            colMeta: true,
            charts: true,
            pivotTables: true,
            conditionalRules: { orderBy: { priority: 'asc' } },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 60_000,
      },
    );
  }

  private async copySheetContent(
    tx: Prisma.TransactionClient,
    source: Prisma.SheetGetPayload<{
      include: {
        cells: true;
        rowMeta: true;
        colMeta: true;
        charts: true;
        pivotTables: true;
        conditionalRules: true;
      };
    }>,
    targetSheetId: string,
  ) {
    const batchSize = 1_000;
    const cells = source.cells.map(({ row, col, value, formula, format }) => ({
      sheetId: targetSheetId,
      row,
      col,
      ...(value === null ? {} : { value: value as Prisma.InputJsonValue }),
      formula,
      ...(format === null ? {} : { format: format as Prisma.InputJsonValue }),
    }));
    for (let offset = 0; offset < cells.length; offset += batchSize) {
      await tx.cell.createMany({
        data: cells.slice(offset, offset + batchSize),
      });
    }
    const rowMeta = source.rowMeta.map(({ row, height, hidden }) => ({
      sheetId: targetSheetId,
      row,
      height,
      hidden,
    }));
    for (let offset = 0; offset < rowMeta.length; offset += batchSize) {
      await tx.rowMeta.createMany({
        data: rowMeta.slice(offset, offset + batchSize),
      });
    }
    const colMeta = source.colMeta.map(({ col, width, hidden }) => ({
      sheetId: targetSheetId,
      col,
      width,
      hidden,
    }));
    for (let offset = 0; offset < colMeta.length; offset += batchSize) {
      await tx.colMeta.createMany({
        data: colMeta.slice(offset, offset + batchSize),
      });
    }
    if (source.charts.length)
      await tx.chart.createMany({
        data: source.charts.map(
          ({ type, x, y, width, height, data, options }) => ({
            sheetId: targetSheetId,
            type,
            x,
            y,
            width,
            height,
            data: data as Prisma.InputJsonValue,
            ...(options === null
              ? {}
              : { options: options as Prisma.InputJsonValue }),
          }),
        ),
      });
    if (source.pivotTables.length)
      await tx.pivotTable.createMany({
        data: source.pivotTables.map(
          ({ name, config, sourceRange, targetCell }) => ({
            sheetId: targetSheetId,
            name,
            config: config as Prisma.InputJsonValue,
            sourceRange,
            targetCell,
          }),
        ),
      });
    if (source.conditionalRules.length)
      await tx.conditionalRule.createMany({
        data: source.conditionalRules.map(
          ({ name, priority, ranges, conditions, format, active }) => ({
            sheetId: targetSheetId,
            name,
            priority,
            ranges,
            conditions: conditions as Prisma.InputJsonValue,
            format: format as Prisma.InputJsonValue,
            active,
          }),
        ),
      });
  }

  async reorderSheet(userId: string, sheetId: string, targetIndex: number) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { id: true, spreadsheetId: true },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    await this.checkEditAccess(userId, sheet.spreadsheetId);

    return this.prisma.$transaction(
      async (tx) => {
        const ordered = await tx.sheet.findMany({
          where: { spreadsheetId: sheet.spreadsheetId },
          orderBy: { index: 'asc' },
          select: { id: true },
        });
        if (targetIndex >= ordered.length) {
          throw new BadRequestException('Sheet index is out of range');
        }

        const currentIndex = ordered.findIndex(({ id }) => id === sheetId);
        if (currentIndex < 0) throw new NotFoundException('Sheet not found');
        const reordered = [...ordered];
        const [moved] = reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, moved);

        if (currentIndex !== targetIndex) {
          await tx.$executeRaw`
          UPDATE "sheets"
          SET "index" = -"index" - 1
          WHERE "spreadsheetId" = ${sheet.spreadsheetId}
        `;
          await Promise.all(
            reordered.map(({ id }, index) =>
              tx.sheet.update({
                where: { id },
                data: { index },
              }),
            ),
          );
        }

        return tx.sheet.findMany({
          where: { spreadsheetId: sheet.spreadsheetId },
          orderBy: { index: 'asc' },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertUniqueSheetName(
    tx: Prisma.TransactionClient,
    spreadsheetId: string,
    name: string,
    excludedSheetId?: string,
  ) {
    const duplicate = await tx.sheet.findFirst({
      where: {
        spreadsheetId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludedSheetId ? { id: { not: excludedSheetId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictException('A sheet with this name already exists');
  }

  private async rewriteStoredSheetReferences(
    tx: Prisma.TransactionClient,
    spreadsheetId: string,
    oldName: string,
    newName?: string,
    excludedSheetId?: string,
  ) {
    const formulaCells = await tx.cell.findMany({
      where: {
        sheet: { spreadsheetId },
        formula: { not: null },
        ...(excludedSheetId ? { sheetId: { not: excludedSheetId } } : {}),
      },
      select: { id: true, formula: true },
    });
    await Promise.all(
      formulaCells.map(({ id, formula }) => {
        const rewritten = rewriteSheetReferences(formula!, oldName, newName);
        if (rewritten === formula) return Promise.resolve();
        return tx.cell.update({
          where: { id },
          data: {
            formula: rewritten,
            ...(newName === undefined ? { value: '#REF!' } : {}),
          },
        });
      }),
    );
  }

  async changeStructure(
    userId: string,
    sheetId: string,
    change: {
      axis: 'row' | 'column';
      type: 'insert' | 'delete';
      index: number;
    },
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    await this.checkEditAccess(userId, sheet.spreadsheetId);
    const size = change.axis === 'row' ? sheet.rowCount : sheet.colCount;
    const maxSize = change.axis === 'row' ? 1_000_000 : 18_278;
    const maxIndex = change.type === 'insert' ? size : size - 1;
    if (
      !Number.isInteger(change.index) ||
      change.index < 0 ||
      change.index > maxIndex
    ) {
      throw new BadRequestException(
        `${change.axis} index must be between 0 and ${maxIndex}`,
      );
    }
    if (change.type === 'insert' && size >= maxSize) {
      throw new BadRequestException(`${change.axis} limit has been reached`);
    }

    const updatedSheet = await this.prisma.$transaction(async (tx) => {
      const versionUpdate = await tx.sheet.updateMany({
        where: { id: sheetId, version: sheet.version },
        data: {
          version: { increment: 1 },
          ...(change.type === 'insert'
            ? change.axis === 'row'
              ? { rowCount: { increment: 1 } }
              : { colCount: { increment: 1 } }
            : {}),
        },
      });
      if (versionUpdate.count !== 1) {
        throw new ConflictException(
          'Sheet was modified by another user. Reload before changing its structure.',
        );
      }

      if (change.axis === 'row') {
        await this.shiftRows(tx, sheetId, change.type, change.index);
      } else {
        await this.shiftColumns(tx, sheetId, change.type, change.index);
      }
      await this.shiftConditionalRuleRanges(tx, sheetId, change);

      return tx.sheet.findUniqueOrThrow({ where: { id: sheetId } });
    });

    return {
      id: updatedSheet.id,
      version: updatedSheet.version,
      rowCount: updatedSheet.rowCount,
      colCount: updatedSheet.colCount,
    };
  }

  private async shiftConditionalRuleRanges(
    tx: Prisma.TransactionClient,
    sheetId: string,
    change: {
      axis: 'row' | 'column';
      type: 'insert' | 'delete';
      index: number;
    },
  ) {
    const rules = await tx.conditionalRule.findMany({
      where: { sheetId },
      select: { id: true, ranges: true },
    });
    await Promise.all(rules.map(({ id, ranges }) => {
      const rewritten = rewriteConditionalRanges(ranges, change);
      if (rewritten.length === 0) {
        return tx.conditionalRule.delete({ where: { id } });
      }
      if (
        rewritten.length === ranges.length &&
        rewritten.every((range, index) => range === ranges[index])
      ) {
        return Promise.resolve();
      }
      return tx.conditionalRule.update({
        where: { id },
        data: { ranges: rewritten },
      });
    }));
  }

  private async shiftRows(
    tx: Prisma.TransactionClient,
    sheetId: string,
    type: 'insert' | 'delete',
    index: number,
  ) {
    if (type === 'delete') {
      await tx.cell.deleteMany({ where: { sheetId, row: index } });
      await tx.rowMeta.deleteMany({ where: { sheetId, row: index } });
      await tx.comment.deleteMany({ where: { sheetId, row: index } });
    }
    const threshold = type === 'insert' ? index : index + 1;
    const offset = type === 'insert' ? 1 : -1;
    await tx.$executeRaw`
      UPDATE "cells" SET "row" = -"row" - 1
      WHERE "sheetId" = ${sheetId} AND "row" >= ${threshold}
    `;
    await tx.$executeRaw`
      UPDATE "cells" SET "row" = -"row" - 1 + ${offset}
      WHERE "sheetId" = ${sheetId} AND "row" < 0
    `;
    await tx.$executeRaw`
      UPDATE "row_meta" SET "row" = -"row" - 1
      WHERE "sheetId" = ${sheetId} AND "row" >= ${threshold}
    `;
    await tx.$executeRaw`
      UPDATE "row_meta" SET "row" = -"row" - 1 + ${offset}
      WHERE "sheetId" = ${sheetId} AND "row" < 0
    `;
    await tx.$executeRaw`
      UPDATE "comments" SET "row" = "row" + ${offset}
      WHERE "sheetId" = ${sheetId} AND "row" >= ${threshold}
    `;
  }

  private async shiftColumns(
    tx: Prisma.TransactionClient,
    sheetId: string,
    type: 'insert' | 'delete',
    index: number,
  ) {
    if (type === 'delete') {
      await tx.cell.deleteMany({ where: { sheetId, col: index } });
      await tx.colMeta.deleteMany({ where: { sheetId, col: index } });
      await tx.comment.deleteMany({ where: { sheetId, col: index } });
    }
    const threshold = type === 'insert' ? index : index + 1;
    const offset = type === 'insert' ? 1 : -1;
    await tx.$executeRaw`
      UPDATE "cells" SET "col" = -"col" - 1
      WHERE "sheetId" = ${sheetId} AND "col" >= ${threshold}
    `;
    await tx.$executeRaw`
      UPDATE "cells" SET "col" = -"col" - 1 + ${offset}
      WHERE "sheetId" = ${sheetId} AND "col" < 0
    `;
    await tx.$executeRaw`
      UPDATE "col_meta" SET "col" = -"col" - 1
      WHERE "sheetId" = ${sheetId} AND "col" >= ${threshold}
    `;
    await tx.$executeRaw`
      UPDATE "col_meta" SET "col" = -"col" - 1 + ${offset}
      WHERE "sheetId" = ${sheetId} AND "col" < 0
    `;
    await tx.$executeRaw`
      UPDATE "comments" SET "col" = "col" + ${offset}
      WHERE "sheetId" = ${sheetId} AND "col" >= ${threshold}
    `;
  }

  async saveView(
    userId: string,
    sheetId: string,
    view: {
      frozenRows: number;
      frozenCols: number;
      rowMeta: Array<{ row: number; height: number; hidden: boolean }>;
      colMeta: Array<{ col: number; width: number; hidden: boolean }>;
    },
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    await this.checkEditAccess(userId, sheet.spreadsheetId);

    if (view.frozenRows > sheet.rowCount || view.frozenCols > sheet.colCount) {
      throw new BadRequestException(
        'Frozen rows or columns exceed sheet dimensions',
      );
    }
    this.validateViewCoordinates(view.rowMeta, 'row', sheet.rowCount);
    this.validateViewCoordinates(view.colMeta, 'col', sheet.colCount);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sheet.update({
        where: { id: sheetId },
        data: {
          frozenRows: view.frozenRows,
          frozenCols: view.frozenCols,
          version: { increment: 1 },
        },
        select: { id: true, version: true },
      });
      await tx.rowMeta.deleteMany({ where: { sheetId } });
      await tx.colMeta.deleteMany({ where: { sheetId } });
      if (view.rowMeta.length > 0) {
        await tx.rowMeta.createMany({
          data: view.rowMeta.map((meta) => ({ sheetId, ...meta })),
        });
      }
      if (view.colMeta.length > 0) {
        await tx.colMeta.createMany({
          data: view.colMeta.map((meta) => ({ sheetId, ...meta })),
        });
      }
      return updated;
    });
  }

  private validateViewCoordinates<T extends 'row' | 'col'>(
    metadata: Array<Record<T, number>>,
    coordinate: T,
    size: number,
  ) {
    const seen = new Set<number>();
    for (const item of metadata) {
      const index = item[coordinate];
      if (!Number.isInteger(index) || index < 0 || index >= size) {
        throw new BadRequestException(
          `${coordinate} metadata is out of bounds`,
        );
      }
      if (seen.has(index)) {
        throw new BadRequestException(`Duplicate ${coordinate} metadata`);
      }
      seen.add(index);
    }
  }

  // Cell operations
  async updateCell(
    userId: string,
    sheetId: string,
    row: number,
    col: number,
    data: { value?: any; formula?: string | null; format?: any },
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    this.validateCellCoordinates(row, col, sheet.rowCount, sheet.colCount);
    const normalizedData = this.normalizeCellUpdate(data);

    return this.prisma.cell.upsert({
      where: {
        sheetId_row_col: { sheetId, row, col },
      },
      update: normalizedData,
      create: {
        sheetId,
        row,
        col,
        ...normalizedData,
      },
    });
  }

  async updateCells(
    userId: string,
    sheetId: string,
    updates: Array<{
      row: number;
      col: number;
      value?: any;
      formula?: string | null;
      format?: any;
    }>,
    expectedVersion?: number,
    idempotencyKey?: string,
  ) {
    if (updates.length < 1 || updates.length > 1000) {
      throw new BadRequestException(
        'Cell update batch must contain between 1 and 1000 items',
      );
    }

    this.logger.log(
      `[updateCells] Called with sheetId=${sheetId}, updates count=${updates.length}`,
    );
    this.logger.debug(
      `[updateCells] First update: ${JSON.stringify(updates[0])}`,
    );

    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    this.logger.log(
      `[updateCells] Sheet found: spreadsheetId=${sheet.spreadsheetId}`,
    );

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    const seenCoordinates = new Set<string>();
    const normalizedUpdates = updates.map((update) => {
      this.validateCellCoordinates(
        update.row,
        update.col,
        sheet.rowCount,
        sheet.colCount,
      );
      const coordinate = `${update.row}:${update.col}`;
      if (seenCoordinates.has(coordinate)) {
        throw new BadRequestException(
          `Duplicate cell coordinate in batch: ${coordinate}`,
        );
      }
      seenCoordinates.add(coordinate);
      return { ...update, ...this.normalizeCellUpdate(update) };
    });

    const versionToMatch = expectedVersion ?? sheet.version;
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          // Hash the request as the client sent it. Using the current sheet
          // version here makes a retry without expectedVersion change identity
          // after the first successful write increments the version.
          expectedVersion: expectedVersion ?? null,
          updates: normalizedUpdates.map(
            ({ row, col, value, formula, format }) => ({
              row,
              col,
              value,
              formula,
              format,
            }),
          ),
        }),
      )
      .digest('hex');

    if (idempotencyKey) {
      const existingMutation = await this.prisma.cellMutation.findUnique({
        where: {
          sheetId_userId_idempotencyKey: {
            sheetId,
            userId,
            idempotencyKey,
          },
        },
      });
      if (existingMutation) {
        if (existingMutation.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency key was already used for a different request.',
          );
        }
        return { cells: [], version: existingMutation.version, replayed: true };
      }
    }

    const transactionResult = await this.prisma
      .$transaction(async (tx) => {
        if (idempotencyKey) {
          await tx.cellMutation.create({
            data: {
              sheetId,
              userId,
              idempotencyKey,
              requestHash,
              version: versionToMatch + 1,
            },
          });
        }
        const versionUpdate = await tx.sheet.updateMany({
          where: { id: sheetId, version: versionToMatch },
          data: { version: { increment: 1 } },
        });
        if (versionUpdate.count !== 1) {
          throw new ConflictException(
            'Sheet was modified by another user. Reload before saving again.',
          );
        }

        const existingCells = await tx.cell.findMany({
          where: {
            sheetId,
            OR: normalizedUpdates.map((update) => ({
              row: update.row,
              col: update.col,
            })),
          },
        });
        const cells = await Promise.all(
          normalizedUpdates.map((update) =>
            tx.cell.upsert({
              where: {
                sheetId_row_col: { sheetId, row: update.row, col: update.col },
              },
              update: {
                value: update.value,
                formula: update.formula,
                format: update.format,
              },
              create: {
                sheetId,
                row: update.row,
                col: update.col,
                value: update.value,
                formula: update.formula,
                format: update.format,
              },
            }),
          ),
        );
        return { cells, existingCells };
      })
      .catch(async (error: unknown) => {
        if (!idempotencyKey || !this.isUniqueConstraintError(error)) {
          throw error;
        }
        const concurrentMutation = await this.prisma.cellMutation.findUnique({
          where: {
            sheetId_userId_idempotencyKey: {
              sheetId,
              userId,
              idempotencyKey,
            },
          },
        });
        if (!concurrentMutation) {
          throw error;
        }
        if (concurrentMutation.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency key was already used for a different request.',
          );
        }
        return {
          cells: [],
          existingCells: [],
          replayedVersion: concurrentMutation.version,
        };
      });
    if ('replayedVersion' in transactionResult) {
      return {
        cells: transactionResult.cells,
        version: transactionResult.replayedVersion,
        replayed: true,
      };
    }
    const existingMap = new Map(
      transactionResult.existingCells.map((cell) => [
        `${cell.row}:${cell.col}`,
        cell.value,
      ]),
    );

    // Trigger cell change events (async, don't block response)
    const cellChangeEvents: CellChangeEvent[] = normalizedUpdates.map(
      (update) => ({
        spreadsheetId: sheet.spreadsheetId,
        sheetId,
        row: update.row,
        col: update.col,
        previousValue: existingMap.get(`${update.row}:${update.col}`) ?? null,
        newValue: update.value,
        changedBy: userId,
        changeMethod: 'api' as const,
      }),
    );

    this.logger.log(
      `[updateCells] Firing ${cellChangeEvents.length} cell change event(s)`,
    );
    this.logger.debug(
      `[updateCells] First event: spreadsheetId=${cellChangeEvents[0]?.spreadsheetId}, sheetId=${cellChangeEvents[0]?.sheetId}, row=${cellChangeEvents[0]?.row}, col=${cellChangeEvents[0]?.col}`,
    );

    // Fire events asynchronously
    if (cellChangeEvents.length === 1) {
      this.logger.log(`[updateCells] Calling detectCellChange for single cell`);
      this.eventsService.detectCellChange(cellChangeEvents[0]).catch((e) => {
        this.logger.error(`[updateCells] detectCellChange error: ${e.message}`);
      });
    } else if (cellChangeEvents.length > 1) {
      this.logger.log(
        `[updateCells] Calling detectMultiCellChange for ${cellChangeEvents.length} cells`,
      );
      this.eventsService.detectMultiCellChange(cellChangeEvents).catch((e) => {
        this.logger.error(
          `[updateCells] detectMultiCellChange error: ${e.message}`,
        );
      });
    }

    this.logger.log(
      `[updateCells] Completed, returning ${transactionResult.cells.length} updated cells`,
    );
    return { cells: transactionResult.cells, version: versionToMatch + 1 };
  }

  private validateCellCoordinates(
    row: number,
    col: number,
    rowCount: number,
    colCount: number,
  ): void {
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      col < 0
    ) {
      throw new BadRequestException(
        'Cell coordinates must be non-negative integers',
      );
    }
    if (row >= rowCount || col >= colCount) {
      throw new BadRequestException(
        `Cell coordinate (${row}, ${col}) is outside sheet bounds (${rowCount}, ${colCount})`,
      );
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private normalizeCellUpdate(data: {
    value?: any;
    formula?: string | null;
    format?: any;
  }) {
    const hasValue = Object.prototype.hasOwnProperty.call(data, 'value');
    const hasFormula = Object.prototype.hasOwnProperty.call(data, 'formula');
    const hasFormat = Object.prototype.hasOwnProperty.call(data, 'format');

    if (!hasValue && !hasFormula && !hasFormat) {
      throw new BadRequestException(
        'Cell update must include value, formula, or format',
      );
    }

    return {
      value: hasValue ? data.value : undefined,
      formula: hasFormula ? data.formula : hasValue ? null : undefined,
      format: hasFormat ? data.format : undefined,
    };
  }

  // Permission helpers
  async checkAccess(userId: string, spreadsheetId: string): Promise<boolean> {
    const spreadsheet = await this.prisma.spreadsheet.findFirst({
      where: { id: spreadsheetId, deletedAt: null },
      select: {
        isPublic: true,
        ownerId: true,
        permissions: {
          where: { userId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!spreadsheet) return false;
    if (spreadsheet.isPublic) return true;
    if (spreadsheet.ownerId === userId) return true;
    if (spreadsheet.permissions.length > 0) return true;

    return false;
  }

  async checkEditAccess(userId: string, spreadsheetId: string): Promise<void> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: {
        permissions: {
          where: { userId },
        },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    if (spreadsheet.ownerId === userId) return;

    const permission = spreadsheet.permissions[0];
    if (
      !permission ||
      (permission.role !== PermissionRole.EDITOR &&
        permission.role !== PermissionRole.OWNER)
    ) {
      throw new ForbiddenException(
        'You do not have edit access to this spreadsheet',
      );
    }
  }

  async listPermissions(userId: string, spreadsheetId: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: {
        permissions: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');
    if (spreadsheet.ownerId !== userId)
      throw new ForbiddenException('Only owner can view permissions');

    return {
      isPublic: spreadsheet.isPublic,
      permissions: spreadsheet.permissions.map((p) => ({
        id: p.id,
        user: p.user,
        email: p.email,
        role: p.role,
      })),
    };
  }

  async addPermission(
    userId: string,
    spreadsheetId: string,
    email: string,
    role: PermissionRole,
  ) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');
    if (spreadsheet.ownerId !== userId)
      throw new ForbiddenException('Only owner can add permissions');

    // Find user by email
    const targetUser = await this.prisma.user.findUnique({ where: { email } });

    return this.prisma.permission.create({
      data: {
        spreadsheetId,
        userId: targetUser?.id, // If null, maybe invite by email only (future feature), for now assume user exists or store email
        email: email,
        role,
      },
    });
  }

  async removePermission(
    userId: string,
    spreadsheetId: string,
    permissionId: string,
  ) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');
    if (spreadsheet.ownerId !== userId)
      throw new ForbiddenException('Only owner can remove permissions');

    return this.prisma.permission.delete({
      where: { id: permissionId },
    });
  }

  async updatePublicAccess(
    userId: string,
    spreadsheetId: string,
    isPublic: boolean,
  ) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');
    if (spreadsheet.ownerId !== userId)
      throw new ForbiddenException('Only owner can change public access');

    return this.prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { isPublic },
    });
  }

  async getUserRole(
    userId: string,
    spreadsheetId: string,
  ): Promise<PermissionRole | null> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet) return null;
    if (spreadsheet.ownerId === userId) return PermissionRole.OWNER;

    const permission = await this.prisma.permission.findUnique({
      where: {
        spreadsheetId_userId: { spreadsheetId, userId },
      },
    });

    return permission?.role ?? null;
  }
  async copy(userId: string, id: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id },
      include: { sheets: { include: { cells: true } } },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    // Check read access
    const hasAccess = await this.checkAccess(userId, id);
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this spreadsheet',
      );
    }

    const newSpreadsheet = await this.prisma.spreadsheet.create({
      data: {
        name: `Copy of ${spreadsheet.name}`,
        ownerId: userId,
        sheets: {
          create: spreadsheet.sheets.map((sheet) => ({
            name: sheet.name,
            index: sheet.index,
            cells: {
              create: sheet.cells.map((cell) => ({
                row: cell.row,
                col: cell.col,
                value: cell.value as any,
                formula: cell.formula,
                format: cell.format as any,
              })),
            },
          })),
        },
        permissions: {
          create: {
            userId,
            role: PermissionRole.OWNER,
          },
        },
      },
      select: { id: true },
    });

    return newSpreadsheet;
  }

  // Chart operations
  async saveCharts(
    userId: string,
    sheetId: string,
    charts: Array<{
      id?: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      data: any;
      options?: any;
    }>,
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    // Delete existing charts and recreate
    await this.prisma.chart.deleteMany({
      where: { sheetId },
    });

    if (charts.length === 0) {
      return [];
    }

    // Create new charts
    const created = await this.prisma.$transaction(
      charts.map((chart) =>
        this.prisma.chart.create({
          data: {
            sheetId,
            type: chart.type,
            x: chart.x,
            y: chart.y,
            width: chart.width,
            height: chart.height,
            data: chart.data,
            options: chart.options,
          },
        }),
      ),
    );

    return created;
  }

  // Pivot Table operations
  async savePivotTables(
    userId: string,
    sheetId: string,
    pivotTables: Array<{
      id?: string;
      name?: string;
      config: any;
      sourceRange?: string;
      targetCell?: string;
    }>,
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    // Delete existing pivot tables and recreate
    await this.prisma.pivotTable.deleteMany({
      where: { sheetId },
    });

    if (pivotTables.length === 0) {
      return [];
    }

    // Create new pivot tables
    const created = await this.prisma.$transaction(
      pivotTables.map((pt) =>
        this.prisma.pivotTable.create({
          data: {
            sheetId,
            name: pt.name,
            config: pt.config,
            sourceRange: pt.sourceRange,
            targetCell: pt.targetCell,
          },
        }),
      ),
    );

    return created;
  }
}
