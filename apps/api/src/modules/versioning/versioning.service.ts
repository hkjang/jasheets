import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface VersionSnapshot {
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
  }>;
}

@Injectable()
export class VersioningService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new version snapshot
  async createVersion(
    userId: string,
    spreadsheetId: string,
    name?: string,
  ) {
    // Verify access
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: {
        sheets: {
          include: {
            cells: true,
          },
        },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    // Check if user has access
    const hasAccess = spreadsheet.ownerId === userId ||
      await this.prisma.permission.findFirst({
        where: { spreadsheetId, userId },
      });

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Create snapshot
    const snapshot: VersionSnapshot = {
      cells: spreadsheet.sheets.flatMap((sheet: any) =>
        sheet.cells.map((cell: any) => ({
          sheetId: sheet.id,
          row: cell.row,
          col: cell.col,
          value: cell.value,
          formula: cell.formula ?? undefined,
          format: cell.format ?? undefined,
        }))
      ),
      sheets: spreadsheet.sheets.map((sheet: any) => ({
        id: sheet.id,
        name: sheet.name,
        index: sheet.index,
      })),
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
    // Verify access
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    const hasAccess = spreadsheet.ownerId === userId ||
      await this.prisma.permission.findFirst({
        where: { spreadsheetId, userId },
      });

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.version.findMany({
      where: { spreadsheetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
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

    const hasAccess = version.spreadsheet.ownerId === userId ||
      await this.prisma.permission.findFirst({
        where: { spreadsheetId: version.spreadsheetId, userId },
      });

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return version;
  }

  // Restore a version
  async restoreVersion(userId: string, versionId: string) {
    const version = await this.getVersion(userId, versionId);
    const snapshot = version.snapshot as unknown as VersionSnapshot;

    // Check edit access
    const permission = await this.prisma.permission.findFirst({
      where: { spreadsheetId: version.spreadsheetId, userId },
    });

    if (version.spreadsheet.ownerId !== userId && 
        (!permission || !['EDITOR', 'OWNER'].includes(permission.role))) {
      throw new ForbiddenException('You do not have edit access');
    }

    // Create a backup version before restoring
    await this.createVersion(
      userId,
      version.spreadsheetId,
      `Backup before restore to "${version.name || version.createdAt.toISOString()}"`,
    );

    // Restore cells from snapshot
    return this.prisma.$transaction(async (tx: PrismaService) => {
      // Delete existing cells
      for (const sheet of snapshot.sheets) {
        await tx.cell.deleteMany({
          where: { sheetId: sheet.id },
        });
      }

      // Recreate cells from snapshot
      if (snapshot.cells.length > 0) {
        await tx.cell.createMany({
          data: snapshot.cells.map(cell => ({
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
        data: { updatedAt: new Date() },
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
  async compareVersions(userId: string, versionId1: string, versionId2: string) {
    const [version1, version2] = await Promise.all([
      this.getVersion(userId, versionId1),
      this.getVersion(userId, versionId2),
    ]);

    const snapshot1 = version1.snapshot as unknown as VersionSnapshot;
    const snapshot2 = version2.snapshot as unknown as VersionSnapshot;

    // Create cell maps for comparison
    const cellKey = (c: { sheetId: string; row: number; col: number }) =>
      `${c.sheetId}:${c.row}:${c.col}`;

    const cells1 = new Map(snapshot1.cells.map(c => [cellKey(c), c]));
    const cells2 = new Map(snapshot2.cells.map(c => [cellKey(c), c]));

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
      version1: { id: version1.id, createdAt: version1.createdAt, name: version1.name },
      version2: { id: version2.id, createdAt: version2.createdAt, name: version2.name },
      changes,
      totalChanges: changes.length,
    };
  }
}
