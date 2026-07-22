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
import { rewriteMergedRange } from './merged-range.util';
import { PivotCoordinateRange, rewritePivotRange } from './pivot-range.util';
import {
  ImportWorkbookDto,
  WorkbookImportSheetDto,
} from './dto/import-workbook.dto';
import { PivotSourceRangeDto, PivotTableDto } from './dto/pivot-table.dto';

class ColumnCoverageTree {
  private readonly maximum: Int32Array;
  private readonly lazy: Int32Array;

  constructor(private readonly size: number) {
    this.maximum = new Int32Array(size * 4);
    this.lazy = new Int32Array(size * 4);
  }

  add(start: number, end: number, delta: number): void {
    this.update(1, 0, this.size - 1, start, end, delta);
  }

  max(start: number, end: number): number {
    return this.query(1, 0, this.size - 1, start, end);
  }

  private update(
    node: number,
    left: number,
    right: number,
    start: number,
    end: number,
    delta: number,
  ): void {
    if (start <= left && right <= end) {
      this.maximum[node] += delta;
      this.lazy[node] += delta;
      return;
    }
    const middle = Math.floor((left + right) / 2);
    if (start <= middle) this.update(node * 2, left, middle, start, end, delta);
    if (end > middle)
      this.update(node * 2 + 1, middle + 1, right, start, end, delta);
    this.maximum[node] =
      this.lazy[node] +
      Math.max(this.maximum[node * 2], this.maximum[node * 2 + 1]);
  }

  private query(
    node: number,
    left: number,
    right: number,
    start: number,
    end: number,
  ): number {
    if (start <= left && right <= end) return this.maximum[node];
    const middle = Math.floor((left + right) / 2);
    let result = 0;
    if (start <= middle)
      result = this.query(node * 2, left, middle, start, end);
    if (end > middle)
      result = Math.max(
        result,
        this.query(node * 2 + 1, middle + 1, right, start, end),
      );
    return this.lazy[node] + result;
  }
}

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private readonly maxSheetsPerSpreadsheet = 200;
  private readonly maxWorkbookImportBytes = 16 * 1024 * 1024;
  private readonly maxWorkbookImportCells = 100_000;
  private readonly maxCellImportBytes = 256 * 1024;

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
            mergedRanges: {
              orderBy: [{ startRow: 'asc' }, { startCol: 'asc' }],
            },
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

  async describeSheetSchema(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    headerRow = 0,
    sampleRows = 100,
  ) {
    const sheet = await this.prisma.sheet.findFirst({
      where: { id: sheetId, spreadsheetId },
      select: {
        id: true,
        name: true,
        rowCount: true,
        colCount: true,
        version: true,
      },
    });
    if (!sheet) throw new NotFoundException('Sheet not found in spreadsheet');
    if (!(await this.checkAccess(userId, spreadsheetId))) {
      throw new ForbiddenException(
        'You do not have access to this spreadsheet',
      );
    }
    if (
      !Number.isInteger(headerRow) ||
      headerRow < 0 ||
      headerRow >= sheet.rowCount
    ) {
      throw new BadRequestException('Header row is outside the sheet bounds');
    }
    if (!Number.isInteger(sampleRows) || sampleRows < 1 || sampleRows > 1000) {
      throw new BadRequestException('Sample rows must be between 1 and 1000');
    }

    const sampleEndRow = Math.min(sheet.rowCount - 1, headerRow + sampleRows);
    const cells = await this.prisma.cell.findMany({
      where: {
        sheetId,
        row: { gte: headerRow, lte: sampleEndRow },
      },
      select: { row: true, col: true, value: true, formula: true },
      orderBy: [{ col: 'asc' }, { row: 'asc' }],
    });

    const columns = new Map<
      number,
      {
        header: string | null;
        types: Set<string>;
        nullable: boolean;
        hasFormula: boolean;
        sampledValues: number;
      }
    >();
    for (const cell of cells) {
      const column = columns.get(cell.col) ?? {
        header: null,
        types: new Set<string>(),
        nullable: false,
        hasFormula: false,
        sampledValues: 0,
      };
      if (cell.row === headerRow) {
        if (
          typeof cell.value === 'string' ||
          typeof cell.value === 'number' ||
          typeof cell.value === 'boolean'
        ) {
          column.header = String(cell.value);
        }
      } else {
        column.hasFormula ||= Boolean(cell.formula);
        if (cell.value === null) {
          column.nullable = true;
        } else if (cell.value !== undefined) {
          column.types.add(
            Array.isArray(cell.value) ? 'array' : typeof cell.value,
          );
          column.sampledValues += 1;
        }
      }
      columns.set(cell.col, column);
    }

    return {
      spreadsheetId,
      sheetId: sheet.id,
      name: sheet.name,
      version: sheet.version,
      dimensions: { rows: sheet.rowCount, columns: sheet.colCount },
      sampling: { headerRow, sampleRows, endRow: sampleEndRow },
      columns: [...columns.entries()].map(([index, column]) => ({
        index,
        label: this.columnLabel(index),
        header: column.header,
        inferredType:
          column.types.size === 0
            ? 'unknown'
            : column.types.size === 1
              ? [...column.types][0]
              : 'mixed',
        nullable: column.nullable,
        hasFormula: column.hasFormula,
        sampledValues: column.sampledValues,
      })),
    };
  }

  async readSheetRange(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) {
    const coordinates = [startRow, startCol, endRow, endCol];
    if (
      coordinates.some(
        (coordinate) => !Number.isInteger(coordinate) || coordinate < 0,
      )
    ) {
      throw new BadRequestException(
        'Range coordinates must be non-negative integers',
      );
    }
    if (endRow < startRow || endCol < startCol) {
      throw new BadRequestException('Range end must not precede range start');
    }
    const requestedCells = (endRow - startRow + 1) * (endCol - startCol + 1);
    if (requestedCells > 10_000) {
      throw new BadRequestException('Range reads are limited to 10,000 cells');
    }

    const sheet = await this.prisma.sheet.findFirst({
      where: { id: sheetId, spreadsheetId },
      select: {
        id: true,
        name: true,
        rowCount: true,
        colCount: true,
        version: true,
      },
    });
    if (!sheet) throw new NotFoundException('Sheet not found in spreadsheet');
    if (!(await this.checkAccess(userId, spreadsheetId))) {
      throw new ForbiddenException(
        'You do not have access to this spreadsheet',
      );
    }
    if (endRow >= sheet.rowCount || endCol >= sheet.colCount) {
      throw new BadRequestException('Range exceeds sheet bounds');
    }

    const cells = await this.prisma.cell.findMany({
      where: {
        sheetId,
        row: { gte: startRow, lte: endRow },
        col: { gte: startCol, lte: endCol },
      },
      select: {
        row: true,
        col: true,
        value: true,
        formula: true,
        format: true,
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });

    return {
      spreadsheetId,
      sheetId,
      sheetName: sheet.name,
      version: sheet.version,
      range: { startRow, startCol, endRow, endCol },
      requestedCells,
      cells,
    };
  }

  private columnLabel(index: number): string {
    let value = index + 1;
    let label = '';
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
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

  /**
   * Imports parsed workbook data without deleting Sheet records. In replace
   * mode imported tabs overwrite existing tabs by index, additional tabs are
   * created, and surplus existing tabs are intentionally preserved. This keeps
   * permissions, comments, revision logs, filters and automation ownership
   * intact instead of relying on destructive cascades.
   */
  async importWorkbook(
    userId: string,
    spreadsheetId: string,
    dto: ImportWorkbookDto,
  ) {
    await this.checkEditAccess(userId, spreadsheetId);
    this.validateWorkbookImport(dto);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertImportEditAccess(tx, userId, spreadsheetId);
          const currentSheets = await tx.sheet.findMany({
            where: { spreadsheetId },
            orderBy: { index: 'asc' },
            select: { id: true, name: true, index: true, version: true },
          });
          this.assertExpectedSheetVersions(
            currentSheets,
            dto.expectedSheetVersions,
          );

          const createdCount =
            dto.mode === 'append'
              ? dto.sheets.length
              : Math.max(0, dto.sheets.length - currentSheets.length);
          if (
            currentSheets.length + createdCount >
            this.maxSheetsPerSpreadsheet
          ) {
            throw new BadRequestException(
              `A spreadsheet can contain at most ${this.maxSheetsPerSpreadsheet} sheets`,
            );
          }

          const preservedNames =
            dto.mode === 'append'
              ? currentSheets.map(({ name }) => name)
              : currentSheets.map(({ name }) => name);
          const createdNames =
            dto.mode === 'append'
              ? dto.sheets.map(({ name }) => name)
              : dto.sheets.slice(currentSheets.length).map(({ name }) => name);
          this.assertUniqueImportedSheetNames([
            ...preservedNames,
            ...createdNames,
          ]);

          const imported: Array<{ id: string; name: string; version: number }> =
            [];
          let nextIndex =
            currentSheets.reduce(
              (maximum, sheet) => Math.max(maximum, sheet.index),
              -1,
            ) + 1;

          for (let index = 0; index < dto.sheets.length; index += 1) {
            const source = dto.sheets[index];
            const target =
              dto.mode === 'replace' ? currentSheets[index] : undefined;
            if (target) {
              const claimed = await tx.sheet.updateMany({
                where: { id: target.id, version: target.version },
                data: {
                  rowCount: source.rowCount,
                  colCount: source.colCount,
                  frozenRows: source.frozenRows,
                  frozenCols: source.frozenCols,
                  defaultRowHeight: source.defaultRowHeight,
                  defaultColWidth: source.defaultColWidth,
                  version: { increment: 1 },
                },
              });
              if (claimed.count !== 1) {
                throw new ConflictException(
                  'Spreadsheet changed while the workbook was being imported',
                );
              }
              await this.replaceImportedSheetContent(tx, target.id, source);
              imported.push({
                id: target.id,
                // Reusing an existing tab deliberately preserves its identity
                // and name so formulas in surplus tabs never become stale.
                name: target.name,
                version: target.version + 1,
              });
            } else {
              const created = await tx.sheet.create({
                data: {
                  spreadsheetId,
                  name: source.name,
                  index: nextIndex++,
                  rowCount: source.rowCount,
                  colCount: source.colCount,
                  frozenRows: source.frozenRows,
                  frozenCols: source.frozenCols,
                  defaultRowHeight: source.defaultRowHeight,
                  defaultColWidth: source.defaultColWidth,
                },
                select: { id: true, name: true, version: true },
              });
              await this.createImportedSheetContent(tx, created.id, source);
              imported.push(created);
            }
          }

          return {
            mode: dto.mode,
            imported,
            preservedSheetCount:
              dto.mode === 'replace'
                ? Math.max(0, currentSheets.length - dto.sheets.length)
                : currentSheets.length,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 120_000,
        },
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new ConflictException(
          'Spreadsheet changed while the workbook was being imported',
        );
      }
      throw error;
    }
  }

  private async assertImportEditAccess(
    tx: Prisma.TransactionClient,
    userId: string,
    spreadsheetId: string,
  ): Promise<void> {
    const spreadsheet = await tx.spreadsheet.findFirst({
      where: { id: spreadsheetId, deletedAt: null },
      select: {
        ownerId: true,
        permissions: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!spreadsheet) throw new NotFoundException('Spreadsheet not found');
    const role = spreadsheet.permissions[0]?.role;
    if (
      spreadsheet.ownerId !== userId &&
      role !== PermissionRole.EDITOR &&
      role !== PermissionRole.OWNER
    ) {
      throw new ForbiddenException(
        'You do not have edit access to this spreadsheet',
      );
    }
  }

  private validateWorkbookImport(dto: ImportWorkbookDto): void {
    let encoded: string;
    try {
      encoded = JSON.stringify(dto);
    } catch {
      throw new BadRequestException('Workbook payload must be valid JSON');
    }
    if (Buffer.byteLength(encoded, 'utf8') > this.maxWorkbookImportBytes) {
      throw new BadRequestException('Workbook payload exceeds the 16 MB limit');
    }
    const totalCells = dto.sheets.reduce(
      (sum, sheet) => sum + sheet.cells.length,
      0,
    );
    if (totalCells > this.maxWorkbookImportCells) {
      throw new BadRequestException(
        `Workbook import cannot contain more than ${this.maxWorkbookImportCells} cells`,
      );
    }
    this.assertUniqueImportedSheetNames(dto.sheets.map(({ name }) => name));
    dto.sheets.forEach((sheet) => this.validateImportedSheet(sheet));
  }

  private validateImportedSheet(sheet: WorkbookImportSheetDto): void {
    if (/[[\]:*?/\\\u0000-\u001f\u007f]/u.test(sheet.name)) {
      throw new BadRequestException(
        `Sheet name contains unsafe characters: ${sheet.name}`,
      );
    }
    if (
      sheet.frozenRows > sheet.rowCount ||
      sheet.frozenCols > sheet.colCount
    ) {
      throw new BadRequestException(
        `Frozen rows or columns exceed bounds for sheet ${sheet.name}`,
      );
    }

    const cells = new Set<string>();
    for (const cell of sheet.cells) {
      this.validateCellCoordinates(
        cell.row,
        cell.col,
        sheet.rowCount,
        sheet.colCount,
      );
      const key = `${cell.row}:${cell.col}`;
      if (cells.has(key)) {
        throw new BadRequestException(
          `Duplicate cell coordinate in sheet ${sheet.name}: ${key}`,
        );
      }
      cells.add(key);
      if (
        !Object.prototype.hasOwnProperty.call(cell, 'value') &&
        !Object.prototype.hasOwnProperty.call(cell, 'formula') &&
        !Object.prototype.hasOwnProperty.call(cell, 'format')
      ) {
        throw new BadRequestException(`Imported cell ${key} has no content`);
      }
      this.assertSafeImportValue(cell, `cell ${key}`);
    }

    this.assertUniqueImportCoordinates(
      sheet.rowMeta,
      'row',
      sheet.rowCount,
      sheet.name,
    );
    this.assertUniqueImportCoordinates(
      sheet.colMeta,
      'col',
      sheet.colCount,
      sheet.name,
    );

    for (const range of sheet.mergedRanges) {
      this.validateMergedRange(range, sheet.rowCount, sheet.colCount);
    }
    this.assertImportedMergesDoNotOverlap(sheet);
    this.assertNoImportedNonAnchorCells(sheet);
  }

  private assertSafeImportValue(value: unknown, label: string): void {
    let encoded: string | undefined;
    try {
      encoded = JSON.stringify(value);
    } catch {
      throw new BadRequestException(`${label} is not JSON serializable`);
    }
    if (encoded === undefined) {
      throw new BadRequestException(`${label} contains an unsupported value`);
    }
    if (Buffer.byteLength(encoded, 'utf8') > this.maxCellImportBytes) {
      throw new BadRequestException(`${label} exceeds the 256 KB limit`);
    }
    const visit = (current: unknown, depth: number): void => {
      if (depth > 20)
        throw new BadRequestException(`${label} is too deeply nested`);
      if (typeof current === 'string' && current.length > 50_000) {
        throw new BadRequestException(`${label} contains an oversized string`);
      }
      if (Array.isArray(current))
        current.forEach((entry) => visit(entry, depth + 1));
      else if (current && typeof current === 'object')
        Object.values(current).forEach((entry) => visit(entry, depth + 1));
    };
    visit(value, 0);
  }

  private assertUniqueImportCoordinates<T extends object, K extends keyof T>(
    values: T[],
    coordinate: K,
    bound: number,
    sheetName: string,
  ): void {
    const seen = new Set<number>();
    for (const value of values) {
      const rawPosition = value[coordinate];
      const position = typeof rawPosition === 'number' ? rawPosition : -1;
      if (!Number.isInteger(position) || position < 0 || position >= bound) {
        throw new BadRequestException(
          `${String(coordinate)} metadata is outside bounds for sheet ${sheetName}`,
        );
      }
      if (seen.has(position)) {
        throw new BadRequestException(
          `Duplicate ${String(coordinate)} metadata in sheet ${sheetName}: ${position}`,
        );
      }
      seen.add(position);
    }
  }

  private assertUniqueImportedSheetNames(names: string[]): void {
    const seen = new Set<string>();
    for (const name of names) {
      const normalized = name.normalize('NFKC').trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) {
        throw new BadRequestException('Workbook sheet names must be unique');
      }
      seen.add(normalized);
    }
  }

  private assertExpectedSheetVersions(
    current: Array<{ id: string; version: number }>,
    expected: Array<{ sheetId: string; version: number }>,
  ): void {
    const expectedMap = new Map<string, number>();
    for (const entry of expected) {
      if (expectedMap.has(entry.sheetId)) {
        throw new BadRequestException(
          'Expected sheet versions contain duplicates',
        );
      }
      expectedMap.set(entry.sheetId, entry.version);
    }
    if (
      expectedMap.size !== current.length ||
      current.some((sheet) => expectedMap.get(sheet.id) !== sheet.version)
    ) {
      throw new ConflictException(
        'Spreadsheet changed since the workbook import was prepared',
      );
    }
  }

  private importedMergeEvents(sheet: WorkbookImportSheetDto) {
    return sheet.mergedRanges
      .flatMap((range) => [
        { row: range.startRow, delta: 1, range },
        { row: range.endRow + 1, delta: -1, range },
      ])
      .sort((left, right) => left.row - right.row || left.delta - right.delta);
  }

  private assertImportedMergesDoNotOverlap(
    sheet: WorkbookImportSheetDto,
  ): void {
    const coverage = new ColumnCoverageTree(sheet.colCount);
    for (const event of this.importedMergeEvents(sheet)) {
      const { startCol, endCol } = event.range;
      if (event.delta > 0 && coverage.max(startCol, endCol) > 0) {
        throw new BadRequestException(
          `Merged ranges overlap in sheet ${sheet.name}`,
        );
      }
      coverage.add(startCol, endCol, event.delta);
    }
  }

  private assertNoImportedNonAnchorCells(sheet: WorkbookImportSheetDto): void {
    if (!sheet.mergedRanges.length || !sheet.cells.length) return;
    const coverage = new ColumnCoverageTree(sheet.colCount);
    const events = this.importedMergeEvents(sheet);
    const anchors = new Set(
      sheet.mergedRanges.map(
        ({ startRow, startCol }) => `${startRow}:${startCol}`,
      ),
    );
    const cells = [...sheet.cells].sort(
      (left, right) => left.row - right.row || left.col - right.col,
    );
    let eventIndex = 0;
    for (const cell of cells) {
      while (eventIndex < events.length && events[eventIndex].row <= cell.row) {
        const event = events[eventIndex++];
        coverage.add(event.range.startCol, event.range.endCol, event.delta);
      }
      const key = `${cell.row}:${cell.col}`;
      if (coverage.max(cell.col, cell.col) > 0 && !anchors.has(key)) {
        throw new BadRequestException(
          `Non-anchor cell ${key} contains data inside a merged range`,
        );
      }
    }
  }

  private async replaceImportedSheetContent(
    tx: Prisma.TransactionClient,
    sheetId: string,
    sheet: WorkbookImportSheetDto,
  ): Promise<void> {
    const where = { where: { sheetId } };
    await tx.cell.deleteMany(where);
    await tx.rowMeta.deleteMany(where);
    await tx.colMeta.deleteMany(where);
    await tx.mergedRange.deleteMany(where);
    // XLSX parsing does not currently model JaSheets charts, pivots or
    // conditional rules. Preserve them rather than silently deleting content
    // which cannot be recreated from the import payload.
    await this.createImportedSheetContent(tx, sheetId, sheet);
  }

  private async createImportedSheetContent(
    tx: Prisma.TransactionClient,
    sheetId: string,
    sheet: WorkbookImportSheetDto,
  ): Promise<void> {
    const batchSize = 1_000;
    for (let offset = 0; offset < sheet.cells.length; offset += batchSize) {
      await tx.cell.createMany({
        data: sheet.cells.slice(offset, offset + batchSize).map((cell) => ({
          sheetId,
          row: cell.row,
          col: cell.col,
          ...(Object.prototype.hasOwnProperty.call(cell, 'value')
            ? {
                value:
                  cell.value === null
                    ? Prisma.JsonNull
                    : (cell.value as Prisma.InputJsonValue),
              }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(cell, 'formula')
            ? { formula: cell.formula }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(cell, 'format')
            ? {
                format:
                  cell.format === null
                    ? Prisma.JsonNull
                    : (cell.format as Prisma.InputJsonValue),
              }
            : {}),
        })),
      });
    }
    if (sheet.rowMeta.length)
      await tx.rowMeta.createMany({
        data: sheet.rowMeta.map((meta) => ({ sheetId, ...meta })),
      });
    if (sheet.colMeta.length)
      await tx.colMeta.createMany({
        data: sheet.colMeta.map((meta) => ({ sheetId, ...meta })),
      });
    if (sheet.mergedRanges.length)
      await tx.mergedRange.createMany({
        data: sheet.mergedRanges.map((range) => ({ sheetId, ...range })),
      });
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
            mergedRanges: true,
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
            mergedRanges: true,
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
        mergedRanges: true;
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
    if (source.mergedRanges.length)
      await tx.mergedRange.createMany({
        data: source.mergedRanges.map(
          ({ startRow, startCol, endRow, endCol }) => ({
            sheetId: targetSheetId,
            startRow,
            startCol,
            endRow,
            endCol,
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
      await this.shiftMergedRanges(tx, sheetId, change);
      await this.shiftPivotTableRanges(tx, sheetId, change);

      return tx.sheet.findUniqueOrThrow({
        where: { id: sheetId },
        include: { pivotTables: true },
      });
    });

    return {
      id: updatedSheet.id,
      version: updatedSheet.version,
      rowCount: updatedSheet.rowCount,
      colCount: updatedSheet.colCount,
      pivotTables: updatedSheet.pivotTables,
    };
  }

  async listMergedRanges(userId: string, sheetId: string) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { spreadsheetId: true },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    if (!(await this.checkAccess(userId, sheet.spreadsheetId))) {
      throw new ForbiddenException(
        'You do not have access to this spreadsheet',
      );
    }
    return this.prisma.mergedRange.findMany({
      where: { sheetId },
      orderBy: [{ startRow: 'asc' }, { startCol: 'asc' }],
    });
  }

  async mergeCells(
    userId: string,
    sheetId: string,
    range: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
      expectedVersion?: number;
    },
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    await this.checkEditAccess(userId, sheet.spreadsheetId);
    this.validateMergedRange(range, sheet.rowCount, sheet.colCount);

    const versionToMatch = range.expectedVersion ?? sheet.version;
    return this.prisma.$transaction(async (tx) => {
      const versionUpdate = await tx.sheet.updateMany({
        where: { id: sheetId, version: versionToMatch },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) {
        throw new ConflictException(
          'Sheet was modified by another user. Reload before merging cells.',
        );
      }

      const overlap = await tx.mergedRange.findFirst({
        where: {
          sheetId,
          startRow: { lte: range.endRow },
          endRow: { gte: range.startRow },
          startCol: { lte: range.endCol },
          endCol: { gte: range.startCol },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException('The range overlaps already merged cells');
      }

      const mergedRange = await tx.mergedRange.create({
        data: {
          sheetId,
          startRow: range.startRow,
          startCol: range.startCol,
          endRow: range.endRow,
          endCol: range.endCol,
        },
      });
      await tx.cell.deleteMany({
        where: {
          sheetId,
          row: { gte: range.startRow, lte: range.endRow },
          col: { gte: range.startCol, lte: range.endCol },
          NOT: { row: range.startRow, col: range.startCol },
        },
      });
      return { mergedRange, version: versionToMatch + 1 };
    });
  }

  async unmergeCells(
    userId: string,
    sheetId: string,
    range: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
      expectedVersion?: number;
    },
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    await this.checkEditAccess(userId, sheet.spreadsheetId);
    this.validateMergedRange(range, sheet.rowCount, sheet.colCount);
    const versionToMatch = range.expectedVersion ?? sheet.version;

    return this.prisma.$transaction(async (tx) => {
      const versionUpdate = await tx.sheet.updateMany({
        where: { id: sheetId, version: versionToMatch },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) {
        throw new ConflictException(
          'Sheet was modified by another user. Reload before unmerging cells.',
        );
      }
      const removed = await tx.mergedRange.deleteMany({
        where: {
          sheetId,
          startRow: range.startRow,
          startCol: range.startCol,
          endRow: range.endRow,
          endCol: range.endCol,
        },
      });
      if (removed.count !== 1) {
        throw new NotFoundException('Merged range not found');
      }
      return { version: versionToMatch + 1 };
    });
  }

  private validateMergedRange(
    range: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    },
    rowCount: number,
    colCount: number,
  ) {
    const coordinates = [
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol,
    ];
    if (coordinates.some((coordinate) => !Number.isInteger(coordinate))) {
      throw new BadRequestException(
        'Merged range coordinates must be integers',
      );
    }
    if (
      range.startRow < 0 ||
      range.startCol < 0 ||
      range.endRow < range.startRow ||
      range.endCol < range.startCol ||
      range.endRow >= rowCount ||
      range.endCol >= colCount
    ) {
      throw new BadRequestException('Merged range is outside the sheet bounds');
    }
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      throw new BadRequestException(
        'A merged range must contain multiple cells',
      );
    }
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
    await Promise.all(
      rules.map(({ id, ranges }) => {
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
      }),
    );
  }

  private async shiftMergedRanges(
    tx: Prisma.TransactionClient,
    sheetId: string,
    change: {
      axis: 'row' | 'column';
      type: 'insert' | 'delete';
      index: number;
    },
  ) {
    const ranges = await tx.mergedRange.findMany({
      where: { sheetId },
      select: {
        id: true,
        startRow: true,
        startCol: true,
        endRow: true,
        endCol: true,
      },
    });
    // Preserve range ids and avoid transient coordinate uniqueness collisions:
    // insertions move the furthest ranges first, deletions the nearest first.
    ranges.sort((left, right) => {
      const leftStart = change.axis === 'row' ? left.startRow : left.startCol;
      const rightStart =
        change.axis === 'row' ? right.startRow : right.startCol;
      return change.type === 'insert'
        ? rightStart - leftStart
        : leftStart - rightStart;
    });
    for (const { id, ...range } of ranges) {
      const rewritten = rewriteMergedRange(range, change);
      if (!rewritten) {
        await tx.mergedRange.delete({ where: { id } });
        continue;
      }
      if (
        rewritten.startRow === range.startRow &&
        rewritten.startCol === range.startCol &&
        rewritten.endRow === range.endRow &&
        rewritten.endCol === range.endCol
      ) {
        continue;
      }
      await tx.mergedRange.update({
        where: { id },
        data: rewritten,
      });
    }
  }

  private async shiftPivotTableRanges(
    tx: Prisma.TransactionClient,
    sheetId: string,
    change: {
      axis: 'row' | 'column';
      type: 'insert' | 'delete';
      index: number;
    },
  ): Promise<void> {
    const pivots = await tx.pivotTable.findMany({
      where: { sheetId },
      select: {
        id: true,
        config: true,
        sourceRange: true,
        targetCell: true,
      },
    });
    for (const pivot of pivots) {
      const config = this.readStoredPivotConfig(pivot.config);
      const source = config
        ? rewritePivotRange(config.sourceRange, change)
        : null;
      const parsedTarget = pivot.targetCell
        ? this.tryParseA1Cell(pivot.targetCell)
        : null;
      const target = parsedTarget
        ? rewritePivotRange(parsedTarget, change)
        : null;

      // A managed pivot cannot survive without its source definition or
      // materialization anchor. Deleting either is an explicit pivot delete.
      if (!source || !target) {
        const remainingOutput = config?.outputRange
          ? rewritePivotRange(config.outputRange, change)
          : null;
        if (remainingOutput) {
          await tx.cell.deleteMany({
            where: {
              sheetId,
              row: {
                gte: remainingOutput.startRow,
                lte: remainingOutput.endRow,
              },
              col: {
                gte: remainingOutput.startCol,
                lte: remainingOutput.endCol,
              },
            },
          });
        }
        await tx.pivotTable.delete({ where: { id: pivot.id } });
        continue;
      }

      const outputRange = config?.outputRange
        ? rewritePivotRange(config.outputRange, change)
        : undefined;
      const nextConfig: Record<string, unknown> = {
        ...config,
        sourceRange: source,
      };
      if (outputRange) nextConfig.outputRange = outputRange;
      else delete nextConfig.outputRange;
      await tx.pivotTable.update({
        where: { id: pivot.id },
        data: {
          config: nextConfig as Prisma.InputJsonValue,
          sourceRange: this.formatA1Range(source),
          targetCell: this.formatA1Cell(target.startRow, target.startCol),
        },
      });
    }
  }

  private readStoredPivotConfig(value: Prisma.JsonValue):
    | (Record<string, Prisma.JsonValue> & {
        sourceRange: PivotCoordinateRange;
        outputRange?: PivotCoordinateRange;
      })
    | null {
    if (!value || Array.isArray(value) || typeof value !== 'object')
      return null;
    const sourceRange = this.readPivotCoordinateRange(value.sourceRange);
    if (!sourceRange) return null;
    const outputRange = this.readPivotCoordinateRange(value.outputRange);
    return {
      ...value,
      sourceRange,
      ...(outputRange ? { outputRange } : {}),
    } as Record<string, Prisma.JsonValue> & {
      sourceRange: PivotCoordinateRange;
      outputRange?: PivotCoordinateRange;
    };
  }

  private readPivotCoordinateRange(
    value: unknown,
  ): PivotCoordinateRange | null {
    if (!value || Array.isArray(value) || typeof value !== 'object')
      return null;
    const candidate = value as Record<string, unknown>;
    const coordinates = [
      candidate.startRow,
      candidate.startCol,
      candidate.endRow,
      candidate.endCol,
    ];
    if (coordinates.some((coordinate) => !Number.isInteger(coordinate))) {
      return null;
    }
    const [startRow, startCol, endRow, endCol] = coordinates as number[];
    if (
      startRow < 0 ||
      startCol < 0 ||
      startRow > endRow ||
      startCol > endCol
    ) {
      return null;
    }
    return { startRow, startCol, endRow, endCol };
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
    await this.assertMergedCellWriteAllowed(sheetId, [{ row, col }]);
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

    await this.assertMergedCellWriteAllowed(sheetId, normalizedUpdates);

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
          const currentSheet = await tx.sheet.findUnique({
            where: { id: sheetId },
            select: { version: true },
          });
          throw new ConflictException({
            message:
              'Sheet was modified by another user. Reload before saving again.',
            currentVersion: currentSheet?.version ?? versionToMatch,
          });
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

  private async assertMergedCellWriteAllowed(
    sheetId: string,
    coordinates: Array<{ row: number; col: number }>,
  ): Promise<void> {
    const containingRange = await this.prisma.mergedRange.findFirst({
      where: {
        sheetId,
        OR: coordinates.map(({ row, col }) => ({
          startRow: { lte: row },
          endRow: { gte: row },
          startCol: { lte: col },
          endCol: { gte: col },
          NOT: { startRow: row, startCol: col },
        })),
      },
      select: { startRow: true, startCol: true, endRow: true, endCol: true },
    });

    if (containingRange) {
      throw new BadRequestException(
        'Cannot write to a non-anchor cell inside a merged range',
      );
    }
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
    pivotTables: PivotTableDto[],
    expectedVersion?: number,
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    await this.checkEditAccess(userId, sheet.spreadsheetId);
    this.assertUniquePivotIds(pivotTables);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertImportEditAccess(tx, userId, sheet.spreadsheetId);
          const currentSheet = await tx.sheet.findUnique({
            where: { id: sheetId },
            select: {
              id: true,
              spreadsheetId: true,
              rowCount: true,
              colCount: true,
              version: true,
            },
          });
          if (!currentSheet) throw new NotFoundException('Sheet not found');
          if (currentSheet.spreadsheetId !== sheet.spreadsheetId) {
            throw new ConflictException('Sheet ownership changed while saving');
          }

          const existing = await tx.pivotTable.findMany({
            where: { sheetId },
            select: { id: true },
          });
          const existingIds = new Set(existing.map(({ id }) => id));
          for (const pivot of pivotTables) {
            if (pivot.id && !existingIds.has(pivot.id)) {
              throw new BadRequestException(
                `Pivot table does not belong to this sheet: ${pivot.id}`,
              );
            }
          }

          const policy =
            (await tx.pivotPolicy.findFirst({
              where: { userId, isActive: true },
              orderBy: { updatedAt: 'desc' },
            })) ??
            (await tx.pivotPolicy.findFirst({
              where: { userId: null, isGlobal: true, isActive: true },
              orderBy: { updatedAt: 'desc' },
            }));
          const maxPivotsPerSheet = policy?.maxPivotsPerSheet ?? 10;
          if (pivotTables.length > maxPivotsPerSheet) {
            throw new BadRequestException(
              `This sheet can contain at most ${maxPivotsPerSheet} pivot tables`,
            );
          }

          // PivotTable has no creator identity, so maxPivotsPerUser cannot be
          // truthfully enforced here. Counting every pivot the actor can view
          // would incorrectly charge collaborators for other people's data.
          // Per-sheet and computation limits remain enforceable and exact.
          this.validatePivotRelationships(
            pivotTables,
            currentSheet.rowCount,
            currentSheet.colCount,
          );

          for (const pivot of pivotTables) {
            await this.validatePivotTable(
              tx,
              sheetId,
              currentSheet.rowCount,
              currentSheet.colCount,
              pivot,
              policy?.allowedAggregates ?? [
                'SUM',
                'COUNT',
                'AVERAGE',
                'MIN',
                'MAX',
              ],
              policy?.maxRowsForPivot ?? 100_000,
            );
          }

          const versionToMatch = expectedVersion ?? currentSheet.version;
          const claimed = await tx.sheet.updateMany({
            where: { id: sheetId, version: versionToMatch },
            data: { version: { increment: 1 } },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'Sheet was modified by another user. Reload before saving again.',
            );
          }

          await tx.pivotTable.deleteMany({ where: { sheetId } });
          const created = [];
          for (const pivot of pivotTables) {
            created.push(
              await tx.pivotTable.create({
                data: {
                  ...(pivot.id ? { id: pivot.id } : {}),
                  sheetId,
                  name: pivot.name,
                  config: pivot.config as unknown as Prisma.InputJsonValue,
                  sourceRange:
                    pivot.sourceRange ??
                    this.formatA1Range(pivot.config.sourceRange),
                  targetCell: pivot.targetCell,
                },
              }),
            );
          }

          return { pivotTables: created, version: versionToMatch + 1 };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 60_000,
        },
      );
    } catch (error) {
      if (this.isTransactionConflict(error)) {
        throw new ConflictException(
          'Sheet was modified by another user. Reload before saving again.',
        );
      }
      throw error;
    }
  }

  private assertUniquePivotIds(pivotTables: PivotTableDto[]): void {
    const ids = pivotTables.flatMap(({ id }) => (id ? [id] : []));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate pivot table id');
    }
  }

  private async validatePivotTable(
    tx: Prisma.TransactionClient,
    sheetId: string,
    rowCount: number,
    colCount: number,
    pivot: PivotTableDto,
    allowedAggregates: string[],
    maxRowsForPivot: number,
  ): Promise<void> {
    const source = pivot.config.sourceRange;
    this.assertPivotRange(source, rowCount, colCount, 'source');
    const sourceRows = source.endRow - source.startRow + 1;
    const sourceColumns = source.endCol - source.startCol + 1;
    if (sourceRows > maxRowsForPivot) {
      throw new BadRequestException(
        `Pivot source cannot contain more than ${maxRowsForPivot} rows`,
      );
    }
    if (sourceRows * sourceColumns > 1_000_000) {
      throw new BadRequestException(
        'Pivot source cannot contain more than 1000000 cells',
      );
    }

    const canonicalSource = this.formatA1Range(source);
    if (
      pivot.sourceRange &&
      this.normalizeA1(pivot.sourceRange) !== canonicalSource
    ) {
      throw new BadRequestException(
        'sourceRange must match config.sourceRange',
      );
    }

    const target = this.parseA1Cell(pivot.targetCell);
    this.assertPivotRange(target, rowCount, colCount, 'target');
    if (this.rangesOverlap(source, target)) {
      throw new BadRequestException(
        'Pivot output cannot overlap its source range',
      );
    }

    const output = pivot.config.outputRange;
    if (output) {
      this.assertPivotRange(output, rowCount, colCount, 'output');
      if (
        target.startRow !== output.startRow ||
        target.startCol !== output.startCol
      ) {
        throw new BadRequestException(
          'targetCell must match the start of config.outputRange',
        );
      }
      if (this.rangesOverlap(source, output)) {
        throw new BadRequestException(
          'Pivot output cannot overlap its source range',
        );
      }
    }

    const headers = await tx.cell.findMany({
      where: {
        sheetId,
        row: source.startRow,
        col: { gte: source.startCol, lte: source.endCol },
      },
      select: { col: true, value: true },
    });
    const valuesByColumn = new Map(
      headers.map(({ col, value }) => [col, value]),
    );
    const headerNames: string[] = [];
    for (let col = source.startCol; col <= source.endCol; col += 1) {
      headerNames.push(String(valuesByColumn.get(col) ?? `Col ${col}`));
    }
    if (new Set(headerNames).size !== headerNames.length) {
      throw new BadRequestException('Pivot source headers must be unique');
    }
    const knownFields = new Set(headerNames);
    const configuredFields = [
      ...pivot.config.rows,
      ...pivot.config.cols,
      ...pivot.config.values.map(({ field }) => field),
      ...(pivot.config.filters ?? []).map(({ field }) => field),
      ...(pivot.config.rowSort?.valueField
        ? [pivot.config.rowSort.valueField]
        : []),
      ...(pivot.config.colSort?.valueField
        ? [pivot.config.colSort.valueField]
        : []),
    ];
    for (const field of configuredFields) {
      if (!knownFields.has(field)) {
        throw new BadRequestException(`Unknown pivot field: ${field}`);
      }
    }
    if (new Set(pivot.config.rows).size !== pivot.config.rows.length) {
      throw new BadRequestException('Pivot row fields must be unique');
    }
    if (new Set(pivot.config.cols).size !== pivot.config.cols.length) {
      throw new BadRequestException('Pivot column fields must be unique');
    }
    const valueKeys = pivot.config.values.map(
      ({ field, aggregation }) => `${field}\u0000${aggregation}`,
    );
    if (new Set(valueKeys).size !== valueKeys.length) {
      throw new BadRequestException('Pivot value aggregations must be unique');
    }
    for (const { aggregation } of pivot.config.values) {
      if (!allowedAggregates.includes(aggregation)) {
        throw new BadRequestException(
          `Pivot aggregation is not allowed by policy: ${aggregation}`,
        );
      }
    }
    for (const sort of [pivot.config.rowSort, pivot.config.colSort]) {
      if (!sort) continue;
      if (sort.by === 'VALUE' && (!sort.valueField || !sort.aggregation)) {
        throw new BadRequestException(
          'Value-based pivot sorting requires valueField and aggregation',
        );
      }
      if (sort.aggregation && !allowedAggregates.includes(sort.aggregation)) {
        throw new BadRequestException(
          `Pivot aggregation is not allowed by policy: ${sort.aggregation}`,
        );
      }
      if (
        sort.by !== 'VALUE' &&
        (sort.valueField !== undefined || sort.aggregation !== undefined)
      ) {
        throw new BadRequestException(
          'Label-based pivot sorting cannot specify a value aggregation',
        );
      }
    }
    for (const filter of pivot.config.filters ?? []) {
      const hasValue = filter.value !== undefined;
      const hasValues = filter.values !== undefined;
      if (hasValue && !this.isPivotScalar(filter.value)) {
        throw new BadRequestException('Pivot filter values must be scalar');
      }
      if (
        hasValues &&
        filter.values!.some((value) => !this.isPivotScalar(value))
      ) {
        throw new BadRequestException('Pivot filter values must be scalar');
      }
      if (filter.operator === 'BETWEEN' && filter.values?.length !== 2) {
        throw new BadRequestException(
          'BETWEEN pivot filters require exactly two values',
        );
      }
      if (
        filter.operator === 'IN' &&
        (!filter.values || filter.values.length === 0)
      ) {
        throw new BadRequestException('IN pivot filters require values');
      }
      if (['BETWEEN', 'IN'].includes(filter.operator) && hasValue) {
        throw new BadRequestException(
          `${filter.operator} pivot filters cannot specify value`,
        );
      }
      if (
        ['IS_BLANK', 'IS_NOT_BLANK'].includes(filter.operator) &&
        (hasValue || hasValues)
      ) {
        throw new BadRequestException(
          `${filter.operator} pivot filters cannot specify values`,
        );
      }
      if (
        !['BETWEEN', 'IN', 'IS_BLANK', 'IS_NOT_BLANK'].includes(
          filter.operator,
        ) &&
        filter.value === undefined
      ) {
        throw new BadRequestException(
          `${filter.operator} pivot filters require a value`,
        );
      }
      if (!['BETWEEN', 'IN'].includes(filter.operator) && hasValues) {
        throw new BadRequestException(
          `${filter.operator} pivot filters cannot specify values`,
        );
      }
    }
  }

  private isPivotScalar(value: unknown): boolean {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    );
  }

  private validatePivotRelationships(
    pivots: PivotTableDto[],
    rowCount: number,
    colCount: number,
  ): void {
    const footprints = pivots.map((pivot) => {
      const target = this.parseA1Cell(pivot.targetCell);
      this.assertPivotRange(target, rowCount, colCount, 'target');
      return pivot.config.outputRange ?? target;
    });
    for (let index = 0; index < pivots.length; index += 1) {
      const output = footprints[index];
      for (let other = 0; other < pivots.length; other += 1) {
        if (this.rangesOverlap(output, pivots[other].config.sourceRange)) {
          throw new BadRequestException(
            index === other
              ? 'Pivot output cannot overlap its source range'
              : 'A pivot output cannot overlap another pivot source range',
          );
        }
        if (index < other && this.rangesOverlap(output, footprints[other])) {
          throw new BadRequestException(
            'Pivot output ranges cannot overlap each other',
          );
        }
      }
    }
  }

  private assertPivotRange(
    range: PivotSourceRangeDto,
    rowCount: number,
    colCount: number,
    label: string,
  ): void {
    if (
      !Number.isInteger(range.startRow) ||
      !Number.isInteger(range.startCol) ||
      !Number.isInteger(range.endRow) ||
      !Number.isInteger(range.endCol) ||
      range.startRow < 0 ||
      range.startCol < 0 ||
      range.startRow > range.endRow ||
      range.startCol > range.endCol ||
      range.endRow >= rowCount ||
      range.endCol >= colCount
    ) {
      throw new BadRequestException(`Pivot ${label} range is out of bounds`);
    }
  }

  private rangesOverlap(
    first: PivotSourceRangeDto,
    second: Pick<PivotSourceRangeDto, 'startRow' | 'startCol'> &
      Partial<Pick<PivotSourceRangeDto, 'endRow' | 'endCol'>>,
  ): boolean {
    const secondEndRow = second.endRow ?? second.startRow;
    const secondEndCol = second.endCol ?? second.startCol;
    return !(
      first.endRow < second.startRow ||
      secondEndRow < first.startRow ||
      first.endCol < second.startCol ||
      secondEndCol < first.startCol
    );
  }

  private parseA1Cell(value: string): PivotSourceRangeDto {
    const match = /^\$?([A-Z]+)\$?([1-9][0-9]*)$/i.exec(value.trim());
    if (!match) throw new BadRequestException('Invalid pivot target cell');
    let col = 0;
    for (const character of match[1].toUpperCase()) {
      col = col * 26 + character.charCodeAt(0) - 64;
    }
    const row = Number(match[2]) - 1;
    return { startRow: row, endRow: row, startCol: col - 1, endCol: col - 1 };
  }

  private tryParseA1Cell(value: string): PivotSourceRangeDto | null {
    try {
      return this.parseA1Cell(value);
    } catch {
      return null;
    }
  }

  private formatA1Cell(row: number, col: number): string {
    let value = col + 1;
    let column = '';
    while (value > 0) {
      value -= 1;
      column = String.fromCharCode(65 + (value % 26)) + column;
      value = Math.floor(value / 26);
    }
    return `${column}${row + 1}`;
  }

  private formatA1Range(range: PivotSourceRangeDto): string {
    return `${this.formatA1Cell(range.startRow, range.startCol)}:${this.formatA1Cell(range.endRow, range.endCol)}`;
  }

  private normalizeA1(value: string): string {
    return value.replace(/\$/g, '').toUpperCase();
  }

  private isTransactionConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }
}
