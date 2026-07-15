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
import { PermissionRole } from '@prisma/client';
import { EventsService, CellChangeEvent } from '../events/events.service';
import { createHash } from 'crypto';

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);

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

    const lastSheet = await this.prisma.sheet.findFirst({
      where: { spreadsheetId },
      orderBy: { index: 'desc' },
    });

    return this.prisma.sheet.create({
      data: {
        spreadsheetId,
        name,
        index: (lastSheet?.index ?? -1) + 1,
      },
    });
  }

  async updateSheet(userId: string, sheetId: string, data: { name?: string }) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    return this.prisma.sheet.update({
      where: { id: sheetId },
      data,
    });
  }

  async deleteSheet(userId: string, sheetId: string) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);

    // Check if this is the last sheet
    const sheetCount = await this.prisma.sheet.count({
      where: { spreadsheetId: sheet.spreadsheetId },
    });

    if (sheetCount <= 1) {
      throw new ForbiddenException('Cannot delete the last sheet');
    }

    return this.prisma.sheet.delete({
      where: { id: sheetId },
    });
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
          expectedVersion: versionToMatch,
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
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: {
        permissions: {
          where: { userId },
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
