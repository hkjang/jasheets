import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SnapshotData {
  schemaVersion?: 2;
  sheet?: {
    rowCount: number;
    colCount: number;
    frozenRows: number;
    frozenCols: number;
    defaultRowHeight: number;
    defaultColWidth: number;
  };
  cells: Array<{
    row: number;
    col: number;
    value: any;
    formula?: string;
    format?: any;
  }>;
  rowMeta?: Array<{ row: number; height?: number; hidden?: boolean }>;
  colMeta?: Array<{ col: number; width?: number; hidden?: boolean }>;
  mergedRanges?: Array<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }>;
  conditionalRules?: Array<{
    name: string;
    priority: number;
    ranges: string[];
    conditions: any;
    format: any;
    active: boolean;
  }>;
  charts?: Array<{
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    data: any;
    options?: any;
  }>;
  pivotTables?: Array<{
    name?: string;
    config: any;
    sourceRange?: string;
    targetCell?: string;
  }>;
}

export interface DiffResult {
  added: Array<{ row: number; col: number; value: any }>;
  removed: Array<{ row: number; col: number; value: any }>;
  modified: Array<{ row: number; col: number; oldValue: any; newValue: any }>;
  summary: string;
}

@Injectable()
export class SheetSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertValidSnapshotData(
    value: unknown,
  ): asserts value is SnapshotData {
    if (
      !value ||
      typeof value !== 'object' ||
      !Array.isArray((value as SnapshotData).cells)
    ) {
      throw new BadRequestException('Snapshot data is invalid');
    }

    const data = value as SnapshotData;
    const arraySections = [
      'rowMeta',
      'colMeta',
      'mergedRanges',
      'conditionalRules',
      'charts',
      'pivotTables',
    ] as const;
    for (const section of arraySections) {
      if (data[section] !== undefined && !Array.isArray(data[section])) {
        throw new BadRequestException(`Snapshot section ${section} is invalid`);
      }
    }
    const isIndex = (index: unknown) =>
      Number.isInteger(index) && Number(index) >= 0;
    if (
      data.cells.some(
        (cell) => !cell || !isIndex(cell.row) || !isIndex(cell.col),
      )
    ) {
      throw new BadRequestException(
        'Snapshot contains invalid cell coordinates',
      );
    }
    if (data.rowMeta?.some((meta) => !meta || !isIndex(meta.row))) {
      throw new BadRequestException('Snapshot contains invalid row metadata');
    }
    if (data.colMeta?.some((meta) => !meta || !isIndex(meta.col))) {
      throw new BadRequestException(
        'Snapshot contains invalid column metadata',
      );
    }
    if (
      data.mergedRanges?.some(
        (range) =>
          !range ||
          !isIndex(range.startRow) ||
          !isIndex(range.startCol) ||
          !isIndex(range.endRow) ||
          !isIndex(range.endCol) ||
          range.endRow < range.startRow ||
          range.endCol < range.startCol,
      )
    ) {
      throw new BadRequestException('Snapshot contains invalid merged ranges');
    }
    if (
      data.sheet !== undefined &&
      (!data.sheet ||
        !Number.isInteger(data.sheet.rowCount) ||
        data.sheet.rowCount < 1 ||
        !Number.isInteger(data.sheet.colCount) ||
        data.sheet.colCount < 1 ||
        !isIndex(data.sheet.frozenRows) ||
        !isIndex(data.sheet.frozenCols) ||
        !Number.isInteger(data.sheet.defaultRowHeight) ||
        data.sheet.defaultRowHeight < 1 ||
        !Number.isInteger(data.sheet.defaultColWidth) ||
        data.sheet.defaultColWidth < 1)
    ) {
      throw new BadRequestException('Snapshot contains invalid sheet settings');
    }
  }

  /**
   * Check sheet access
   */
  private async checkSheetAccess(
    userId: string,
    sheetId: string,
    requireEdit = false,
  ): Promise<void> {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      include: {
        spreadsheet: {
          include: { permissions: { where: { userId } } },
        },
      },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const isOwner = sheet.spreadsheet.ownerId === userId;
    const permission = sheet.spreadsheet.permissions[0];

    if (!isOwner && !permission && !sheet.spreadsheet.isPublic) {
      throw new ForbiddenException('No access to this sheet');
    }

    if (
      requireEdit &&
      !isOwner &&
      (!permission || !['OWNER', 'EDITOR'].includes(permission.role))
    ) {
      throw new ForbiddenException('No edit access to this sheet');
    }
  }

  /**
   * Get all snapshots for a sheet
   */
  async getSnapshots(userId: string, sheetId: string) {
    await this.checkSheetAccess(userId, sheetId);

    return this.prisma.sheetSnapshot.findMany({
      where: { sheetId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific snapshot
   */
  async getSnapshot(userId: string, snapshotId: string) {
    const snapshot = await this.prisma.sheetSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    await this.checkSheetAccess(userId, snapshot.sheetId);
    return snapshot;
  }

  /**
   * Create a new snapshot of the current sheet state
   */
  async createSnapshot(
    userId: string,
    sheetId: string,
    name: string,
    description?: string,
    parentId?: string,
  ) {
    await this.checkSheetAccess(userId, sheetId, true);

    // Get current sheet state
    const [
      sheet,
      cells,
      rowMeta,
      colMeta,
      mergedRanges,
      conditionalRules,
      charts,
      pivotTables,
    ] = await Promise.all([
      this.prisma.sheet.findUniqueOrThrow({
        where: { id: sheetId },
        select: {
          rowCount: true,
          colCount: true,
          frozenRows: true,
          frozenCols: true,
          defaultRowHeight: true,
          defaultColWidth: true,
        },
      }),
      this.prisma.cell.findMany({ where: { sheetId } }),
      this.prisma.rowMeta.findMany({ where: { sheetId } }),
      this.prisma.colMeta.findMany({ where: { sheetId } }),
      this.prisma.mergedRange.findMany({ where: { sheetId } }),
      this.prisma.conditionalRule.findMany({ where: { sheetId } }),
      this.prisma.chart.findMany({ where: { sheetId } }),
      this.prisma.pivotTable.findMany({ where: { sheetId } }),
    ]);

    const data: SnapshotData = {
      schemaVersion: 2,
      sheet,
      cells: cells.map((c) => ({
        row: c.row,
        col: c.col,
        value: c.value,
        formula: c.formula ?? undefined,
        format: c.format ?? undefined,
      })),
      rowMeta: rowMeta.map((rm) => ({
        row: rm.row,
        height: rm.height ?? undefined,
        hidden: rm.hidden,
      })),
      colMeta: colMeta.map((cm) => ({
        col: cm.col,
        width: cm.width ?? undefined,
        hidden: cm.hidden,
      })),
      mergedRanges: mergedRanges.map(
        ({ startRow, startCol, endRow, endCol }) => ({
          startRow,
          startCol,
          endRow,
          endCol,
        }),
      ),
      conditionalRules: conditionalRules.map(
        ({ name, priority, ranges, conditions, format, active }) => ({
          name,
          priority,
          ranges,
          conditions,
          format,
          active,
        }),
      ),
      charts: charts.map(({ type, x, y, width, height, data, options }) => ({
        type,
        x,
        y,
        width,
        height,
        data,
        options: options ?? undefined,
      })),
      pivotTables: pivotTables.map(
        ({ name, config, sourceRange, targetCell }) => ({
          name: name ?? undefined,
          config,
          sourceRange: sourceRange ?? undefined,
          targetCell: targetCell ?? undefined,
        }),
      ),
    };

    return this.prisma.sheetSnapshot.create({
      data: {
        sheetId,
        name,
        description,
        data: data as unknown as any,
        parentId,
        isBranch: !!parentId,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  /**
   * Restore a sheet to a snapshot state
   */
  async restoreSnapshot(userId: string, snapshotId: string) {
    const snapshot = await this.getSnapshot(userId, snapshotId);
    await this.checkSheetAccess(userId, snapshot.sheetId, true);

    const data = snapshot.data as unknown;
    this.assertValidSnapshotData(data);

    const currentSheet = await this.prisma.sheet.findUnique({
      where: { id: snapshot.sheetId },
      select: { version: true },
    });
    if (!currentSheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Create a backup snapshot before restoring
    await this.createSnapshot(
      userId,
      snapshot.sheetId,
      `Backup before restore to "${snapshot.name}"`,
      `Automatic backup created before restoring to snapshot: ${snapshot.name}`,
    );

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.sheet.updateMany({
        where: { id: snapshot.sheetId, version: currentSheet.version },
        data: {
          ...(data.sheet ?? {}),
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Sheet changed while the snapshot was being restored',
        );
      }

      await tx.cell.deleteMany({ where: { sheetId: snapshot.sheetId } });
      if (data.rowMeta !== undefined) {
        await tx.rowMeta.deleteMany({ where: { sheetId: snapshot.sheetId } });
      }
      if (data.colMeta !== undefined) {
        await tx.colMeta.deleteMany({ where: { sheetId: snapshot.sheetId } });
      }

      // Advanced sections are versioned independently so legacy snapshots do
      // not unexpectedly erase state they never captured.
      if (data.mergedRanges !== undefined) {
        await tx.mergedRange.deleteMany({
          where: { sheetId: snapshot.sheetId },
        });
      }
      if (data.conditionalRules !== undefined) {
        await tx.conditionalRule.deleteMany({
          where: { sheetId: snapshot.sheetId },
        });
      }
      if (data.charts !== undefined) {
        await tx.chart.deleteMany({ where: { sheetId: snapshot.sheetId } });
      }
      if (data.pivotTables !== undefined) {
        await tx.pivotTable.deleteMany({
          where: { sheetId: snapshot.sheetId },
        });
      }

      if (data.cells && data.cells.length > 0) {
        await tx.cell.createMany({
          data: data.cells.map((c) => ({
            sheetId: snapshot.sheetId,
            row: c.row,
            col: c.col,
            value: c.value,
            formula: c.formula,
            format: c.format,
          })),
        });
      }

      if (data.rowMeta && data.rowMeta.length > 0) {
        await tx.rowMeta.createMany({
          data: data.rowMeta.map((rm) => ({
            sheetId: snapshot.sheetId,
            row: rm.row,
            height: rm.height,
            hidden: rm.hidden || false,
          })),
        });
      }

      if (data.colMeta && data.colMeta.length > 0) {
        await tx.colMeta.createMany({
          data: data.colMeta.map((cm) => ({
            sheetId: snapshot.sheetId,
            col: cm.col,
            width: cm.width,
            hidden: cm.hidden || false,
          })),
        });
      }

      if (data.mergedRanges?.length) {
        await tx.mergedRange.createMany({
          data: data.mergedRanges.map((range) => ({
            ...range,
            sheetId: snapshot.sheetId,
          })),
        });
      }
      if (data.conditionalRules?.length) {
        await tx.conditionalRule.createMany({
          data: data.conditionalRules.map((rule) => ({
            ...rule,
            sheetId: snapshot.sheetId,
            conditions: rule.conditions as Prisma.InputJsonValue,
            format: rule.format as Prisma.InputJsonValue,
          })),
        });
      }
      if (data.charts?.length) {
        await tx.chart.createMany({
          data: data.charts.map((chart) => ({
            ...chart,
            sheetId: snapshot.sheetId,
            data: chart.data as Prisma.InputJsonValue,
            ...(chart.options === undefined
              ? { options: Prisma.JsonNull }
              : { options: chart.options as Prisma.InputJsonValue }),
          })),
        });
      }
      if (data.pivotTables?.length) {
        await tx.pivotTable.createMany({
          data: data.pivotTables.map((pivot) => ({
            ...pivot,
            sheetId: snapshot.sheetId,
            config: pivot.config as Prisma.InputJsonValue,
            name: pivot.name ?? null,
            sourceRange: pivot.sourceRange ?? null,
            targetCell: pivot.targetCell ?? null,
          })),
        });
      }
    });

    return { success: true, cellsRestored: data.cells?.length || 0 };
  }

  /**
   * Compare two snapshots and return diff
   */
  async compareSnapshots(
    userId: string,
    snapshotId1: string,
    snapshotId2: string,
  ): Promise<DiffResult> {
    const [snapshot1, snapshot2] = await Promise.all([
      this.getSnapshot(userId, snapshotId1),
      this.getSnapshot(userId, snapshotId2),
    ]);

    const data1 = snapshot1.data as unknown as SnapshotData;
    const data2 = snapshot2.data as unknown as SnapshotData;

    const cellMap1 = new Map<string, any>();
    const cellMap2 = new Map<string, any>();

    (data1.cells || []).forEach((c) =>
      cellMap1.set(`${c.row}:${c.col}`, c.value),
    );
    (data2.cells || []).forEach((c) =>
      cellMap2.set(`${c.row}:${c.col}`, c.value),
    );

    const added: DiffResult['added'] = [];
    const removed: DiffResult['removed'] = [];
    const modified: DiffResult['modified'] = [];

    // Find added and modified cells
    cellMap2.forEach((value, key) => {
      const [row, col] = key.split(':').map(Number);
      if (!cellMap1.has(key)) {
        added.push({ row, col, value });
      } else if (JSON.stringify(cellMap1.get(key)) !== JSON.stringify(value)) {
        modified.push({
          row,
          col,
          oldValue: cellMap1.get(key),
          newValue: value,
        });
      }
    });

    // Find removed cells
    cellMap1.forEach((value, key) => {
      if (!cellMap2.has(key)) {
        const [row, col] = key.split(':').map(Number);
        removed.push({ row, col, value });
      }
    });

    return {
      added,
      removed,
      modified,
      summary: `${added.length} added, ${removed.length} removed, ${modified.length} modified`,
    };
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(userId: string, snapshotId: string) {
    const snapshot = await this.getSnapshot(userId, snapshotId);
    await this.checkSheetAccess(userId, snapshot.sheetId, true);

    await this.prisma.sheetSnapshot.delete({
      where: { id: snapshotId },
    });

    return { success: true };
  }

  /**
   * Create a branch from a snapshot
   */
  async createBranch(
    userId: string,
    snapshotId: string,
    branchName: string,
    description?: string,
  ) {
    const parentSnapshot = await this.getSnapshot(userId, snapshotId);
    await this.checkSheetAccess(userId, parentSnapshot.sheetId, true);

    return this.prisma.sheetSnapshot.create({
      data: {
        sheetId: parentSnapshot.sheetId,
        name: branchName,
        description,
        data: parentSnapshot.data as unknown as any,
        parentId: snapshotId,
        isBranch: true,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }
}
