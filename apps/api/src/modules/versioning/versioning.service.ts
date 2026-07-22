import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface VersionSnapshot {
  schemaVersion?: 2;
  spreadsheet?: {
    name: string;
  };
  cells: Array<{
    sheetId: string;
    row: number;
    col: number;
    value: any;
    formula?: string;
    format?: any;
  }>;
  sheets: Array<{
    id: string;
    name: string;
    index: number;
    rowCount?: number;
    colCount?: number;
    frozenRows?: number;
    frozenCols?: number;
    defaultRowHeight?: number;
    defaultColWidth?: number;
    version?: number;
    rowMeta?: Array<{ row: number; height: number | null; hidden: boolean }>;
    colMeta?: Array<{ col: number; width: number | null; hidden: boolean }>;
    mergedRanges?: Array<{
      id: string;
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }>;
    conditionalRules?: Array<{
      id: string;
      name: string;
      priority: number;
      ranges: string[];
      conditions: any;
      format: any;
      active: boolean;
    }>;
    charts?: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      data: any;
      options: any;
    }>;
    pivotTables?: Array<{
      id: string;
      name: string | null;
      config: any;
      sourceRange: string | null;
      targetCell: string | null;
    }>;
  }>;
  crossSheetReferences?: Array<{
    id: string;
    sourceSheetId: string;
    sourceCell: string;
    targetSheetId: string;
    targetCell: string;
    formula: string | null;
  }>;
}

@Injectable()
export class VersioningService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new version snapshot
  async createVersion(userId: string, spreadsheetId: string, name?: string) {
    // Verify access
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId, deletedAt: null },
      include: {
        sheets: {
          include: {
            cells: true,
            rowMeta: true,
            colMeta: true,
            mergedRanges: true,
            conditionalRules: true,
            charts: true,
            pivotTables: true,
            sourceReferences: true,
          },
        },
        permissions: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    // Check if user has access
    const permission = spreadsheet.permissions[0];
    const hasAccess =
      spreadsheet.ownerId === userId ||
      permission?.role === 'EDITOR' ||
      permission?.role === 'OWNER';

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Create snapshot
    const snapshot: VersionSnapshot = {
      schemaVersion: 2,
      spreadsheet: { name: spreadsheet.name },
      cells: spreadsheet.sheets.flatMap((sheet: any) =>
        sheet.cells.map((cell: any) => ({
          sheetId: sheet.id,
          row: cell.row,
          col: cell.col,
          value: cell.value,
          formula: cell.formula ?? undefined,
          format: cell.format ?? undefined,
        })),
      ),
      sheets: spreadsheet.sheets.map((sheet: any) => ({
        id: sheet.id,
        name: sheet.name,
        index: sheet.index,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
        frozenRows: sheet.frozenRows,
        frozenCols: sheet.frozenCols,
        defaultRowHeight: sheet.defaultRowHeight,
        defaultColWidth: sheet.defaultColWidth,
        version: sheet.version,
        rowMeta: sheet.rowMeta.map((meta: any) => ({
          row: meta.row,
          height: meta.height,
          hidden: meta.hidden,
        })),
        colMeta: sheet.colMeta.map((meta: any) => ({
          col: meta.col,
          width: meta.width,
          hidden: meta.hidden,
        })),
        mergedRanges: sheet.mergedRanges.map((range: any) => ({
          id: range.id,
          startRow: range.startRow,
          startCol: range.startCol,
          endRow: range.endRow,
          endCol: range.endCol,
        })),
        conditionalRules: sheet.conditionalRules.map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
          ranges: rule.ranges,
          conditions: rule.conditions,
          format: rule.format,
          active: rule.active,
        })),
        charts: sheet.charts.map((chart: any) => ({
          id: chart.id,
          type: chart.type,
          x: chart.x,
          y: chart.y,
          width: chart.width,
          height: chart.height,
          data: chart.data,
          options: chart.options,
        })),
        pivotTables: sheet.pivotTables.map((pivot: any) => ({
          id: pivot.id,
          name: pivot.name,
          config: pivot.config,
          sourceRange: pivot.sourceRange,
          targetCell: pivot.targetCell,
        })),
      })),
      crossSheetReferences: spreadsheet.sheets.flatMap((sheet: any) =>
        sheet.sourceReferences.map((reference: any) => ({
          id: reference.id,
          sourceSheetId: reference.sourceSheetId,
          sourceCell: reference.sourceCell,
          targetSheetId: reference.targetSheetId,
          targetCell: reference.targetCell,
          formula: reference.formula,
        })),
      ),
    };

    return this.prisma.version.create({
      data: {
        spreadsheetId,
        name,
        snapshot: snapshot as any,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  // Get version history
  async getVersions(userId: string, spreadsheetId: string, limit = 50) {
    const safeLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 50;
    // Verify access
    const spreadsheet = await this.prisma.spreadsheet.findFirst({
      where: { id: spreadsheetId, deletedAt: null },
      select: {
        ownerId: true,
        permissions: {
          where: { userId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    const hasAccess =
      spreadsheet.ownerId === userId || spreadsheet.permissions.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.version.findMany({
      where: { spreadsheetId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  // Get a specific version
  async getVersion(userId: string, versionId: string) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      include: {
        spreadsheet: true,
        createdBy: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.spreadsheet.deletedAt) {
      throw new NotFoundException('Spreadsheet not found');
    }

    const hasAccess =
      version.spreadsheet.ownerId === userId ||
      (await this.prisma.permission.findFirst({
        where: { spreadsheetId: version.spreadsheetId, userId },
      }));

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return version;
  }

  // Restore a version
  async restoreVersion(userId: string, versionId: string) {
    const version = await this.getVersion(userId, versionId);
    const snapshot = version.snapshot as unknown as VersionSnapshot;

    if (
      !snapshot ||
      !Array.isArray(snapshot.sheets) ||
      !Array.isArray(snapshot.cells)
    ) {
      throw new BadRequestException('Invalid version snapshot');
    }
    const snapshotSheetIds = snapshot.sheets.map((sheet) => sheet?.id);
    if (
      (snapshot.schemaVersion !== undefined && snapshot.schemaVersion !== 2) ||
      snapshotSheetIds.some((id) => typeof id !== 'string') ||
      new Set(snapshotSheetIds).size !== snapshotSheetIds.length ||
      snapshot.cells.some((cell) => !snapshotSheetIds.includes(cell?.sheetId))
    ) {
      throw new BadRequestException('Invalid version snapshot');
    }
    if (snapshot.schemaVersion === 2) {
      const indexes = snapshot.sheets.map((sheet) => sheet.index);
      const referencesAreValid =
        snapshot.crossSheetReferences === undefined ||
        (Array.isArray(snapshot.crossSheetReferences) &&
          snapshot.crossSheetReferences.every(
            (reference) =>
              snapshotSheetIds.includes(reference?.sourceSheetId) &&
              snapshotSheetIds.includes(reference?.targetSheetId),
          ));
      if (
        snapshot.sheets.some(
          (sheet) =>
            typeof sheet.name !== 'string' ||
            !Number.isInteger(sheet.index) ||
            sheet.index < 0,
        ) ||
        new Set(indexes).size !== indexes.length ||
        !referencesAreValid
      ) {
        throw new BadRequestException('Invalid version snapshot');
      }
    }

    // Check edit access
    const permission = await this.prisma.permission.findFirst({
      where: { spreadsheetId: version.spreadsheetId, userId },
    });

    if (
      version.spreadsheet.ownerId !== userId &&
      (!permission || !['EDITOR', 'OWNER'].includes(permission.role))
    ) {
      throw new ForbiddenException('You do not have edit access');
    }

    // Create a backup version before restoring
    await this.createVersion(
      userId,
      version.spreadsheetId,
      `Backup before restore to "${version.name || version.createdAt.toISOString()}"`,
    );

    // Restore the captured workbook content atomically. Security and user-scoped
    // metadata (permissions, filters, automations and comments) are intentionally
    // not part of a version snapshot.
    return this.prisma.$transaction(async (tx: PrismaService) => {
      const isFullSnapshot = snapshot.schemaVersion === 2;
      const currentSheets = await tx.sheet.findMany({
        where: { spreadsheetId: version.spreadsheetId },
        select: { id: true, index: true, version: true },
        orderBy: { index: 'asc' },
      });
      const claimedSheets = await tx.sheet.findMany({
        where: { id: { in: snapshotSheetIds } },
        select: { id: true, spreadsheetId: true },
      });
      if (
        claimedSheets.some(
          (sheet) => sheet.spreadsheetId !== version.spreadsheetId,
        )
      ) {
        throw new BadRequestException('Invalid version snapshot');
      }

      // Claim optimistic versions before replacing content. A concurrent write
      // aborts the transaction rather than producing a mixed workbook state.
      for (const sheet of currentSheets.filter(
        (candidate) =>
          isFullSnapshot || snapshotSheetIds.includes(candidate.id),
      )) {
        const claimed = await tx.sheet.updateMany({
          where: { id: sheet.id, version: sheet.version },
          data: { version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('Sheet changed during version restore');
        }
      }

      if (isFullSnapshot) {
        await tx.crossSheetReference.deleteMany({
          where: {
            OR: [
              { sourceSheetId: { in: snapshotSheetIds } },
              { targetSheetId: { in: snapshotSheetIds } },
            ],
          },
        });

        // Move current sheets out of the unique index range before restoring
        // captured order. Tabs added later are preserved because deleting them
        // would cascade into user-owned and security metadata.
        const currentIds = currentSheets.map((sheet) => sheet.id);
        for (const [offset, id] of currentIds.entries()) {
          await tx.sheet.update({
            where: { id },
            data: { index: -(offset + 1) },
          });
        }

        const retained = new Set(
          currentIds.filter((id) => snapshotSheetIds.includes(id)),
        );
        for (const sheet of snapshot.sheets) {
          const data = {
            name: sheet.name,
            index: sheet.index,
            rowCount: sheet.rowCount ?? 1000,
            colCount: sheet.colCount ?? 26,
            frozenRows: sheet.frozenRows ?? 0,
            frozenCols: sheet.frozenCols ?? 0,
            defaultRowHeight: sheet.defaultRowHeight ?? 25,
            defaultColWidth: sheet.defaultColWidth ?? 100,
          };
          if (retained.has(sheet.id)) {
            await tx.sheet.update({
              where: { id: sheet.id },
              data,
            });
          } else {
            await tx.sheet.create({
              data: {
                id: sheet.id,
                spreadsheetId: version.spreadsheetId,
                ...data,
                version: (sheet.version ?? 0) + 1,
              },
            });
          }
        }

        const addedAfterSnapshot = currentSheets.filter(
          (sheet) => !snapshotSheetIds.includes(sheet.id),
        );
        const restoredMaxIndex = snapshot.sheets.reduce(
          (max, sheet) => Math.max(max, sheet.index),
          -1,
        );
        for (const [offset, sheet] of addedAfterSnapshot.entries()) {
          await tx.sheet.update({
            where: { id: sheet.id },
            data: { index: restoredMaxIndex + offset + 1 },
          });
        }

        const relationWhere = { sheetId: { in: snapshotSheetIds } };
        await tx.cell.deleteMany({ where: relationWhere });
        await tx.rowMeta.deleteMany({ where: relationWhere });
        await tx.colMeta.deleteMany({ where: relationWhere });
        await tx.mergedRange.deleteMany({ where: relationWhere });
        await tx.conditionalRule.deleteMany({ where: relationWhere });
        await tx.chart.deleteMany({ where: relationWhere });
        await tx.pivotTable.deleteMany({ where: relationWhere });

        for (const sheet of snapshot.sheets) {
          if (sheet.rowMeta?.length) {
            await tx.rowMeta.createMany({
              data: sheet.rowMeta.map((meta) => ({
                ...meta,
                sheetId: sheet.id,
              })),
            });
          }
          if (sheet.colMeta?.length) {
            await tx.colMeta.createMany({
              data: sheet.colMeta.map((meta) => ({
                ...meta,
                sheetId: sheet.id,
              })),
            });
          }
          if (sheet.mergedRanges?.length) {
            await tx.mergedRange.createMany({
              data: sheet.mergedRanges.map((range) => ({
                ...range,
                sheetId: sheet.id,
              })),
            });
          }
          if (sheet.conditionalRules?.length) {
            await tx.conditionalRule.createMany({
              data: sheet.conditionalRules.map((rule) => ({
                ...rule,
                sheetId: sheet.id,
              })),
            });
          }
          if (sheet.charts?.length) {
            await tx.chart.createMany({
              data: sheet.charts.map((chart) => ({
                ...chart,
                sheetId: sheet.id,
              })),
            });
          }
          if (sheet.pivotTables?.length) {
            await tx.pivotTable.createMany({
              data: sheet.pivotTables.map((pivot) => ({
                ...pivot,
                sheetId: sheet.id,
              })),
            });
          }
        }

        if (snapshot.crossSheetReferences?.length) {
          await tx.crossSheetReference.createMany({
            data: snapshot.crossSheetReferences,
          });
        }
      } else {
        // Legacy snapshots only owned cell state. Missing extended fields mean
        // "preserve", not "wipe", for backward compatibility.
        for (const sheet of snapshot.sheets) {
          await tx.cell.deleteMany({
            where: { sheetId: sheet.id },
          });
        }
      }

      // Recreate cells from snapshot
      if (snapshot.cells.length > 0) {
        await tx.cell.createMany({
          data: snapshot.cells.map((cell) => ({
            sheetId: cell.sheetId,
            row: cell.row,
            col: cell.col,
            value: cell.value,
            formula: cell.formula,
            format: cell.format as any,
          })),
        });
      }

      // Update spreadsheet timestamp
      await tx.spreadsheet.update({
        where: { id: version.spreadsheetId },
        data: {
          updatedAt: new Date(),
          ...(isFullSnapshot && snapshot.spreadsheet
            ? { name: snapshot.spreadsheet.name }
            : {}),
        },
      });

      return { success: true, restoredVersionId: versionId };
    });
  }

  // Name a version
  async nameVersion(userId: string, versionId: string, name: string) {
    const version = await this.getVersion(userId, versionId);

    return this.prisma.version.update({
      where: { id: versionId },
      data: { name },
    });
  }

  // Auto-create version (for periodic snapshots)
  async autoCreateVersion(spreadsheetId: string) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet) return null;

    // Check if we already have a recent version (within 30 minutes)
    const recentVersion = await this.prisma.version.findFirst({
      where: {
        spreadsheetId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
    });

    if (recentVersion) return null;

    // Create auto-save version
    return this.createVersion(
      spreadsheet.ownerId,
      spreadsheetId,
      undefined, // No name for auto-saves
    );
  }

  // Get diff between two versions
  async compareVersions(
    userId: string,
    versionId1: string,
    versionId2: string,
  ) {
    const [version1, version2] = await Promise.all([
      this.getVersion(userId, versionId1),
      this.getVersion(userId, versionId2),
    ]);

    const snapshot1 = version1.snapshot as unknown as VersionSnapshot;
    const snapshot2 = version2.snapshot as unknown as VersionSnapshot;

    // Create cell maps for comparison
    const cellKey = (c: { sheetId: string; row: number; col: number }) =>
      `${c.sheetId}:${c.row}:${c.col}`;

    const cells1 = new Map(snapshot1.cells.map((c) => [cellKey(c), c]));
    const cells2 = new Map(snapshot2.cells.map((c) => [cellKey(c), c]));

    const changes: Array<{
      type: 'added' | 'removed' | 'modified';
      sheetId: string;
      row: number;
      col: number;
      oldValue?: any;
      newValue?: any;
    }> = [];

    // Find added and modified cells
    for (const [key, cell] of cells2) {
      const oldCell = cells1.get(key);
      if (!oldCell) {
        changes.push({
          type: 'added',
          sheetId: cell.sheetId,
          row: cell.row,
          col: cell.col,
          newValue: cell.value,
        });
      } else if (JSON.stringify(oldCell.value) !== JSON.stringify(cell.value)) {
        changes.push({
          type: 'modified',
          sheetId: cell.sheetId,
          row: cell.row,
          col: cell.col,
          oldValue: oldCell.value,
          newValue: cell.value,
        });
      }
    }

    // Find removed cells
    for (const [key, cell] of cells1) {
      if (!cells2.has(key)) {
        changes.push({
          type: 'removed',
          sheetId: cell.sheetId,
          row: cell.row,
          col: cell.col,
          oldValue: cell.value,
        });
      }
    }

    return {
      version1: {
        id: version1.id,
        createdAt: version1.createdAt,
        name: version1.name,
      },
      version2: {
        id: version2.id,
        createdAt: version2.createdAt,
        name: version2.name,
      },
      changes,
      totalChanges: changes.length,
    };
  }
}
