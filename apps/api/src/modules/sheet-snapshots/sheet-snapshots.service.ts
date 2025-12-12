import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SnapshotData {
    cells: Array<{
        row: number;
        col: number;
        value: any;
        formula?: string;
        format?: any;
    }>;
    rowMeta?: Array<{ row: number; height?: number; hidden?: boolean }>;
    colMeta?: Array<{ col: number; width?: number; hidden?: boolean }>;
}

export interface DiffResult {
    added: Array<{ row: number; col: number; value: any }>;
    removed: Array<{ row: number; col: number; value: any }>;
    modified: Array<{ row: number; col: number; oldValue: any; newValue: any }>;
    summary: string;
}

@Injectable()
export class SheetSnapshotsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check sheet access
     */
    private async checkSheetAccess(userId: string, sheetId: string, requireEdit = false): Promise<void> {
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

        if (requireEdit && !isOwner && (!permission || !['OWNER', 'EDITOR'].includes(permission.role))) {
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
        const [cells, rowMeta, colMeta] = await Promise.all([
            this.prisma.cell.findMany({ where: { sheetId } }),
            this.prisma.rowMeta.findMany({ where: { sheetId } }),
            this.prisma.colMeta.findMany({ where: { sheetId } }),
        ]);

        const data: SnapshotData = {
            cells: cells.map(c => ({
                row: c.row,
                col: c.col,
                value: c.value,
                formula: c.formula ?? undefined,
                format: c.format ?? undefined,
            })),
            rowMeta: rowMeta.map(rm => ({
                row: rm.row,
                height: rm.height ?? undefined,
                hidden: rm.hidden,
            })),
            colMeta: colMeta.map(cm => ({
                col: cm.col,
                width: cm.width ?? undefined,
                hidden: cm.hidden,
            })),
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

        const data = snapshot.data as unknown as SnapshotData;

        // Create a backup snapshot before restoring
        await this.createSnapshot(
            userId,
            snapshot.sheetId,
            `Backup before restore to "${snapshot.name}"`,
            `Automatic backup created before restoring to snapshot: ${snapshot.name}`,
        );

        // Delete current cells and metadata
        await this.prisma.$transaction([
            this.prisma.cell.deleteMany({ where: { sheetId: snapshot.sheetId } }),
            this.prisma.rowMeta.deleteMany({ where: { sheetId: snapshot.sheetId } }),
            this.prisma.colMeta.deleteMany({ where: { sheetId: snapshot.sheetId } }),
        ]);

        // Restore cells
        if (data.cells && data.cells.length > 0) {
            await this.prisma.cell.createMany({
                data: data.cells.map(c => ({
                    sheetId: snapshot.sheetId,
                    row: c.row,
                    col: c.col,
                    value: c.value,
                    formula: c.formula,
                    format: c.format,
                })),
            });
        }

        // Restore row metadata
        if (data.rowMeta && data.rowMeta.length > 0) {
            await this.prisma.rowMeta.createMany({
                data: data.rowMeta.map(rm => ({
                    sheetId: snapshot.sheetId,
                    row: rm.row,
                    height: rm.height,
                    hidden: rm.hidden || false,
                })),
            });
        }

        // Restore column metadata
        if (data.colMeta && data.colMeta.length > 0) {
            await this.prisma.colMeta.createMany({
                data: data.colMeta.map(cm => ({
                    sheetId: snapshot.sheetId,
                    col: cm.col,
                    width: cm.width,
                    hidden: cm.hidden || false,
                })),
            });
        }

        return { success: true, cellsRestored: data.cells?.length || 0 };
    }

    /**
     * Compare two snapshots and return diff
     */
    async compareSnapshots(userId: string, snapshotId1: string, snapshotId2: string): Promise<DiffResult> {
        const [snapshot1, snapshot2] = await Promise.all([
            this.getSnapshot(userId, snapshotId1),
            this.getSnapshot(userId, snapshotId2),
        ]);

        const data1 = snapshot1.data as unknown as SnapshotData;
        const data2 = snapshot2.data as unknown as SnapshotData;

        const cellMap1 = new Map<string, any>();
        const cellMap2 = new Map<string, any>();

        (data1.cells || []).forEach(c => cellMap1.set(`${c.row}:${c.col}`, c.value));
        (data2.cells || []).forEach(c => cellMap2.set(`${c.row}:${c.col}`, c.value));

        const added: DiffResult['added'] = [];
        const removed: DiffResult['removed'] = [];
        const modified: DiffResult['modified'] = [];

        // Find added and modified cells
        cellMap2.forEach((value, key) => {
            const [row, col] = key.split(':').map(Number);
            if (!cellMap1.has(key)) {
                added.push({ row, col, value });
            } else if (JSON.stringify(cellMap1.get(key)) !== JSON.stringify(value)) {
                modified.push({ row, col, oldValue: cellMap1.get(key), newValue: value });
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
