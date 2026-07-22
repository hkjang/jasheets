import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetRevisionsDto } from './dto/revision-log.dto';

export interface RevisionLogEntry {
  action: string;
  targetRange?: string;
  previousData?: any;
  newData?: any;
  description?: string;
}

@Injectable()
export class RevisionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if user has access to the sheet
   */
  private async checkSheetAccess(
    userId: string,
    sheetId: string,
  ): Promise<void> {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      include: {
        spreadsheet: {
          include: {
            permissions: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const spreadsheet = sheet.spreadsheet;
    const isOwner = spreadsheet.ownerId === userId;
    const hasPermission = spreadsheet.permissions.length > 0;
    const isPublic = spreadsheet.isPublic;

    if (!isOwner && !hasPermission && !isPublic) {
      throw new ForbiddenException('No access to this sheet');
    }
  }

  /**
   * Log a revision for a sheet
   */
  async logRevision(sheetId: string, userId: string, entry: RevisionLogEntry) {
    return this.prisma.revisionLog.create({
      data: {
        sheetId,
        userId,
        action: entry.action,
        targetRange: entry.targetRange,
        previousData: entry.previousData,
        newData: entry.newData,
        description: entry.description,
      },
    });
  }

  /**
   * Log multiple cell updates as a single revision
   */
  async logBulkUpdate(
    sheetId: string,
    userId: string,
    updates: Array<{
      row: number;
      col: number;
      oldValue?: any;
      newValue?: any;
    }>,
  ) {
    if (updates.length === 0) return null;

    // Calculate the affected range
    const rows = updates.map((u) => u.row);
    const cols = updates.map((u) => u.col);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    const startCell = this.toColumnLetter(minCol) + (minRow + 1);
    const endCell = this.toColumnLetter(maxCol) + (maxRow + 1);
    const targetRange =
      startCell === endCell ? startCell : `${startCell}:${endCell}`;

    return this.prisma.revisionLog.create({
      data: {
        sheetId,
        userId,
        action: updates.length === 1 ? 'CELL_UPDATE' : 'BULK_UPDATE',
        targetRange,
        previousData: updates.map((u) => ({
          row: u.row,
          col: u.col,
          value: u.oldValue,
        })),
        newData: updates.map((u) => ({
          row: u.row,
          col: u.col,
          value: u.newValue,
        })),
        description: `Updated ${updates.length} cell(s)`,
      },
    });
  }

  /**
   * Convert column index to letter (0 -> A, 1 -> B, etc.)
   */
  private toColumnLetter(col: number): string {
    let result = '';
    let n = col;
    while (n >= 0) {
      result = String.fromCharCode((n % 26) + 65) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  }

  /**
   * Get revision timeline for a sheet
   */
  async getRevisionTimeline(
    userId: string,
    sheetId: string,
    dto: GetRevisionsDto,
    limit = 100,
    offset = 0,
  ) {
    await this.checkSheetAccess(userId, sheetId);

    const where: any = { sheetId };

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) {
        where.createdAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.createdAt.lte = new Date(dto.endDate);
      }
    }

    if (dto.action) {
      where.action = dto.action;
    }

    const [revisions, total] = await Promise.all([
      this.prisma.revisionLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.revisionLog.count({ where }),
    ]);

    return {
      revisions,
      total,
      hasMore: offset + revisions.length < total,
    };
  }

  async getRevisionHistory(
    userId: string,
    sheetId: string,
    options: {
      limit: number;
      cursor?: string;
      action?: string;
      includeChanges?: boolean;
    },
  ) {
    await this.checkSheetAccess(userId, sheetId);
    const rows = await this.prisma.revisionLog.findMany({
      where: {
        sheetId,
        ...(options.action ? { action: options.action } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        sheetId: true,
        sheetVersion: true,
        action: true,
        targetRange: true,
        description: true,
        previousData: true,
        newData: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
    const hasMore = rows.length > options.limit;
    const page = rows.slice(0, options.limit);
    return {
      revisions: page.map(({ previousData, newData, ...revision }) => ({
        ...revision,
        ...(options.includeChanges ? { previousData, newData } : {}),
      })),
      hasMore,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Get a specific revision by ID
   */
  async getRevision(userId: string, revisionId: string) {
    const revision = await this.prisma.revisionLog.findUnique({
      where: { id: revisionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
        sheet: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    await this.checkSheetAccess(userId, revision.sheetId);

    return revision;
  }

  async prepareRevisionRollback(userId: string, revisionId: string) {
    const revision = await this.getRevision(userId, revisionId);
    if (
      !Array.isArray(revision.previousData) ||
      !Array.isArray(revision.newData) ||
      revision.previousData.length < 1 ||
      revision.previousData.length > 1000
    ) {
      throw new BadRequestException(
        'Revision does not contain a reversible cell change set',
      );
    }

    const previous = this.parseRevisionCells(
      revision.previousData,
      'previousData',
    );
    const next = this.parseRevisionCells(revision.newData, 'newData');
    const nextByCoordinate = new Map(
      next.map((cell) => [`${cell.row}:${cell.col}`, cell]),
    );
    if (
      previous.length !== next.length ||
      previous.some(({ row, col }) => !nextByCoordinate.has(`${row}:${col}`))
    ) {
      throw new BadRequestException('Revision cell states do not align');
    }

    const currentCells = await this.prisma.cell.findMany({
      where: {
        sheetId: revision.sheetId,
        OR: next.map(({ row, col }) => ({ row, col })),
      },
      select: {
        row: true,
        col: true,
        value: true,
        formula: true,
        format: true,
      },
    });
    const currentByCoordinate = new Map(
      currentCells.map((cell) => [`${cell.row}:${cell.col}`, cell]),
    );
    const currentMatchesRevision = next.every((expected) => {
      const current = currentByCoordinate.get(
        `${expected.row}:${expected.col}`,
      );
      return ['value', 'formula', 'format'].every(
        (field) =>
          !(field in expected) ||
          this.jsonEqual(
            current?.[field as 'value' | 'formula' | 'format'] ?? null,
            expected[field as 'value' | 'formula' | 'format'] ?? null,
          ),
      );
    });

    return {
      sheetId: revision.sheetId,
      currentVersion: revision.sheet.version,
      currentMatchesRevision,
      updates: previous,
    };
  }

  private parseRevisionCells(value: unknown[], fieldName: string) {
    const seen = new Set<string>();
    return value.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`${fieldName} contains an invalid cell`);
      }
      const cell = item as Record<string, unknown>;
      if (
        !Number.isInteger(cell.row) ||
        !Number.isInteger(cell.col) ||
        (cell.row as number) < 0 ||
        (cell.col as number) < 0
      ) {
        throw new BadRequestException(
          `${fieldName} contains invalid coordinates`,
        );
      }
      const coordinate = `${cell.row}:${cell.col}`;
      if (seen.has(coordinate)) {
        throw new BadRequestException(
          `${fieldName} contains duplicate coordinates`,
        );
      }
      if (
        'formula' in cell &&
        cell.formula !== null &&
        typeof cell.formula !== 'string'
      ) {
        throw new BadRequestException(
          `${fieldName} contains an invalid formula`,
        );
      }
      if (
        'format' in cell &&
        cell.format !== null &&
        (typeof cell.format !== 'object' || Array.isArray(cell.format))
      ) {
        throw new BadRequestException(
          `${fieldName} contains an invalid format`,
        );
      }
      seen.add(coordinate);
      return {
        row: cell.row as number,
        col: cell.col as number,
        ...('value' in cell ? { value: cell.value } : {}),
        ...('formula' in cell
          ? { formula: cell.formula as string | null }
          : {}),
        ...('format' in cell
          ? { format: cell.format as Record<string, unknown> }
          : {}),
      };
    });
  }

  private jsonEqual(left: unknown, right: unknown): boolean {
    return (
      JSON.stringify(this.canonicalize(left)) ===
      JSON.stringify(this.canonicalize(right))
    );
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value))
      return value.map((item) => this.canonicalize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }
    return value;
  }

  /**
   * Rollback to a specific revision
   * This will apply the previous state from the revision
   */
  async rollbackToRevision(userId: string, revisionId: string) {
    const revision = await this.getRevision(userId, revisionId);

    // Check if user has edit access
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: revision.sheetId },
      include: {
        spreadsheet: {
          include: {
            permissions: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const isOwner = sheet.spreadsheet.ownerId === userId;
    const permission = sheet.spreadsheet.permissions[0];
    const canEdit =
      isOwner || (permission && ['OWNER', 'EDITOR'].includes(permission.role));

    if (!canEdit) {
      throw new ForbiddenException('No edit access to this sheet');
    }

    // Get all revisions after this one (to be rolled back)
    const revisionsToRollback = await this.prisma.revisionLog.findMany({
      where: {
        sheetId: revision.sheetId,
        createdAt: { gt: revision.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Apply rollback for each revision in reverse order
    const cellUpdates: Array<{ row: number; col: number; value: any }> = [];

    for (const rev of revisionsToRollback) {
      if (rev.previousData && Array.isArray(rev.previousData)) {
        for (const cell of rev.previousData as Array<{
          row: number;
          col: number;
          value: any;
        }>) {
          cellUpdates.push({
            row: cell.row,
            col: cell.col,
            value: cell.value,
          });
        }
      }
    }

    // Apply cell updates
    if (cellUpdates.length > 0) {
      await this.prisma.$transaction(
        cellUpdates.map((update) =>
          this.prisma.cell.upsert({
            where: {
              sheetId_row_col: {
                sheetId: revision.sheetId,
                row: update.row,
                col: update.col,
              },
            },
            update: { value: update.value },
            create: {
              sheetId: revision.sheetId,
              row: update.row,
              col: update.col,
              value: update.value,
            },
          }),
        ),
      );
    }

    // Log the rollback action
    await this.logRevision(revision.sheetId, userId, {
      action: 'ROLLBACK',
      description: `Rolled back to revision from ${revision.createdAt.toISOString()}`,
      previousData: { revisionsRolledBack: revisionsToRollback.length },
    });

    return {
      success: true,
      cellsRestored: cellUpdates.length,
      revisionsRolledBack: revisionsToRollback.length,
    };
  }

  /**
   * Get revision statistics for a sheet
   */
  async getRevisionStats(userId: string, sheetId: string) {
    await this.checkSheetAccess(userId, sheetId);

    const [total, byAction, recentActivity] = await Promise.all([
      this.prisma.revisionLog.count({ where: { sheetId } }),
      this.prisma.revisionLog.groupBy({
        by: ['action'],
        where: { sheetId },
        _count: { id: true },
      }),
      this.prisma.revisionLog.findMany({
        where: { sheetId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    // Group by day for activity chart
    const activityByDay = recentActivity.reduce(
      (acc, rev) => {
        const day = rev.createdAt.toISOString().split('T')[0];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalRevisions: total,
      revisionsByAction: byAction.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
      activityByDay,
    };
  }
}
