import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SourceSheetConfig {
    sheetId: string;
    columnMappings: Array<{
        sourceCol: number;
        targetCol: number;
    }>;
    rowFilter?: {
        column: number;
        operator: string;
        value: any;
    };
}

export interface MergedRow {
    sourceSheetId: string;
    sourceRow: number;
    data: Record<number, any>;
}

@Injectable()
export class MasterViewService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check spreadsheet access
     */
    private async checkAccess(userId: string, spreadsheetId: string, requireEdit = false): Promise<void> {
        const spreadsheet = await this.prisma.spreadsheet.findUnique({
            where: { id: spreadsheetId },
            include: { permissions: { where: { userId } } },
        });

        if (!spreadsheet) {
            throw new NotFoundException('Spreadsheet not found');
        }

        const isOwner = spreadsheet.ownerId === userId;
        const permission = spreadsheet.permissions[0];

        if (!isOwner && !permission && !spreadsheet.isPublic) {
            throw new ForbiddenException('No access');
        }

        if (requireEdit && !isOwner && (!permission || !['OWNER', 'EDITOR'].includes(permission.role))) {
            throw new ForbiddenException('No edit access');
        }
    }

    /**
     * Get all master views for a spreadsheet
     */
    async getMasterViews(userId: string, spreadsheetId: string) {
        await this.checkAccess(userId, spreadsheetId);

        return this.prisma.masterView.findMany({
            where: { spreadsheetId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a specific master view
     */
    async getMasterView(userId: string, masterViewId: string) {
        const view = await this.prisma.masterView.findUnique({
            where: { id: masterViewId },
        });

        if (!view) {
            throw new NotFoundException('Master view not found');
        }

        await this.checkAccess(userId, view.spreadsheetId);
        return view;
    }

    /**
     * Create a new master view
     */
    async createMasterView(
        userId: string,
        spreadsheetId: string,
        data: { name: string; description?: string; sourceSheets: SourceSheetConfig[] },
    ) {
        await this.checkAccess(userId, spreadsheetId, true);

        return this.prisma.masterView.create({
            data: {
                spreadsheetId,
                name: data.name,
                description: data.description,
                sourceSheets: data.sourceSheets as unknown as any,
                createdById: userId,
            },
        });
    }

    /**
     * Update a master view
     */
    async updateMasterView(
        userId: string,
        masterViewId: string,
        data: { name?: string; description?: string; sourceSheets?: SourceSheetConfig[]; syncEnabled?: boolean },
    ) {
        const view = await this.getMasterView(userId, masterViewId);
        await this.checkAccess(userId, view.spreadsheetId, true);

        return this.prisma.masterView.update({
            where: { id: masterViewId },
            data: {
                name: data.name,
                description: data.description,
                sourceSheets: data.sourceSheets as unknown as any,
                syncEnabled: data.syncEnabled,
            },
        });
    }

    /**
     * Delete a master view
     */
    async deleteMasterView(userId: string, masterViewId: string) {
        const view = await this.getMasterView(userId, masterViewId);
        await this.checkAccess(userId, view.spreadsheetId, true);

        await this.prisma.masterView.delete({
            where: { id: masterViewId },
        });

        return { success: true };
    }

    /**
     * Get merged data from all source sheets
     */
    async getMergedData(userId: string, masterViewId: string): Promise<MergedRow[]> {
        const view = await this.getMasterView(userId, masterViewId);
        const sourceConfigs = view.sourceSheets as unknown as SourceSheetConfig[];
        const mergedRows: MergedRow[] = [];

        for (const config of sourceConfigs) {
            const cells = await this.prisma.cell.findMany({
                where: { sheetId: config.sheetId },
            });

            // Group cells by row
            const rowMap = new Map<number, Record<number, any>>();
            for (const cell of cells) {
                if (!rowMap.has(cell.row)) {
                    rowMap.set(cell.row, {});
                }
                rowMap.get(cell.row)![cell.col] = cell.value;
            }

            // Apply row filter if specified
            for (const [rowNum, rowData] of rowMap) {
                if (config.rowFilter) {
                    const cellValue = rowData[config.rowFilter.column];
                    if (!this.evaluateFilter(cellValue, config.rowFilter)) {
                        continue;
                    }
                }

                // Apply column mappings
                const mappedData: Record<number, any> = {};
                for (const mapping of config.columnMappings) {
                    mappedData[mapping.targetCol] = rowData[mapping.sourceCol];
                }

                mergedRows.push({
                    sourceSheetId: config.sheetId,
                    sourceRow: rowNum,
                    data: mappedData,
                });
            }
        }

        return mergedRows;
    }

    /**
     * Evaluate a filter condition
     */
    private evaluateFilter(value: any, filter: { operator: string; value: any }): boolean {
        switch (filter.operator) {
            case 'equals':
                return value === filter.value;
            case 'notEquals':
                return value !== filter.value;
            case 'contains':
                return String(value ?? '').includes(String(filter.value));
            case 'greaterThan':
                return Number(value) > Number(filter.value);
            case 'lessThan':
                return Number(value) < Number(filter.value);
            case 'isEmpty':
                return value === null || value === undefined || value === '';
            case 'isNotEmpty':
                return value !== null && value !== undefined && value !== '';
            default:
                return true;
        }
    }

    /**
     * Sync changes back to source sheets
     */
    async syncToSource(
        userId: string,
        masterViewId: string,
        changes: Array<{ sourceSheetId: string; sourceRow: number; col: number; value: any }>,
    ) {
        const view = await this.getMasterView(userId, masterViewId);

        if (!view.syncEnabled) {
            return { success: false, reason: 'Sync is disabled for this master view' };
        }

        await this.checkAccess(userId, view.spreadsheetId, true);

        const operations = changes.map(change =>
            this.prisma.cell.upsert({
                where: {
                    sheetId_row_col: {
                        sheetId: change.sourceSheetId,
                        row: change.sourceRow,
                        col: change.col,
                    },
                },
                update: { value: change.value },
                create: {
                    sheetId: change.sourceSheetId,
                    row: change.sourceRow,
                    col: change.col,
                    value: change.value,
                },
            }),
        );

        await this.prisma.$transaction(operations);

        // Update last sync time
        await this.prisma.masterView.update({
            where: { id: masterViewId },
            data: { lastSyncAt: new Date() },
        });

        return { success: true, syncedCount: changes.length };
    }
}
