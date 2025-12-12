import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReferenceInfo {
    sourceSheetId: string;
    sourceCell: string;
    targetSheetId: string;
    targetCell: string;
    formula: string;
}

export interface DependencyNode {
    sheetId: string;
    cell: string;
    dependsOn: DependencyNode[];
    dependedBy: DependencyNode[];
}

@Injectable()
export class CrossSheetReferenceService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if user has access to the spreadsheet
     */
    private async checkSpreadsheetAccess(userId: string, spreadsheetId: string): Promise<void> {
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

        const isOwner = spreadsheet.ownerId === userId;
        const hasPermission = spreadsheet.permissions.length > 0;
        const isPublic = spreadsheet.isPublic;

        if (!isOwner && !hasPermission && !isPublic) {
            throw new ForbiddenException('No access to this spreadsheet');
        }
    }

    /**
     * Parse a cross-sheet reference formula like ='Sheet2'!A1 or =Sheet2!A1
     */
    parseCrossSheetReference(formula: string): { sheetName: string; cell: string } | null {
        // Pattern for 'SheetName'!CellRef or SheetName!CellRef
        const pattern = /^=(?:'([^']+)'|([A-Za-z0-9_]+))!([A-Z]+\d+)$/;
        const match = formula.match(pattern);

        if (!match) {
            return null;
        }

        return {
            sheetName: match[1] || match[2],
            cell: match[3],
        };
    }

    /**
     * Create a cross-sheet reference
     */
    async createReference(
        userId: string,
        sourceSheetId: string,
        sourceCell: string,
        targetSheetName: string,
        targetCell: string,
        formula: string,
    ) {
        // Get source sheet's spreadsheet
        const sourceSheet = await this.prisma.sheet.findUnique({
            where: { id: sourceSheetId },
            include: { spreadsheet: true },
        });

        if (!sourceSheet) {
            throw new NotFoundException('Source sheet not found');
        }

        await this.checkSpreadsheetAccess(userId, sourceSheet.spreadsheetId);

        // Find target sheet by name in the same spreadsheet
        const targetSheet = await this.prisma.sheet.findFirst({
            where: {
                spreadsheetId: sourceSheet.spreadsheetId,
                name: targetSheetName,
            },
        });

        if (!targetSheet) {
            throw new NotFoundException(`Sheet "${targetSheetName}" not found`);
        }

        // Check for circular references
        const hasCircular = await this.detectCircularReference(
            targetSheet.id,
            targetCell,
            sourceSheetId,
            sourceCell,
        );

        if (hasCircular) {
            throw new BadRequestException('Circular reference detected');
        }

        // Create or update the reference
        const existingRef = await this.prisma.crossSheetReference.findFirst({
            where: {
                sourceSheetId,
                sourceCell,
            },
        });

        if (existingRef) {
            return this.prisma.crossSheetReference.update({
                where: { id: existingRef.id },
                data: {
                    targetSheetId: targetSheet.id,
                    targetCell,
                    formula,
                },
            });
        }

        return this.prisma.crossSheetReference.create({
            data: {
                sourceSheetId,
                sourceCell,
                targetSheetId: targetSheet.id,
                targetCell,
                formula,
            },
        });
    }

    /**
     * Delete a cross-sheet reference
     */
    async deleteReference(userId: string, referenceId: string) {
        const reference = await this.prisma.crossSheetReference.findUnique({
            where: { id: referenceId },
            include: {
                sourceSheet: {
                    include: { spreadsheet: true },
                },
            },
        });

        if (!reference) {
            throw new NotFoundException('Reference not found');
        }

        await this.checkSpreadsheetAccess(userId, reference.sourceSheet.spreadsheetId);

        await this.prisma.crossSheetReference.delete({
            where: { id: referenceId },
        });

        return { success: true };
    }

    /**
     * Get all references for a sheet (both outgoing and incoming)
     */
    async getSheetReferences(userId: string, sheetId: string) {
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: { spreadsheet: true },
        });

        if (!sheet) {
            throw new NotFoundException('Sheet not found');
        }

        await this.checkSpreadsheetAccess(userId, sheet.spreadsheetId);

        const [outgoing, incoming] = await Promise.all([
            this.prisma.crossSheetReference.findMany({
                where: { sourceSheetId: sheetId },
                include: {
                    targetSheet: {
                        select: { id: true, name: true },
                    },
                },
            }),
            this.prisma.crossSheetReference.findMany({
                where: { targetSheetId: sheetId },
                include: {
                    sourceSheet: {
                        select: { id: true, name: true },
                    },
                },
            }),
        ]);

        return { outgoing, incoming };
    }

    /**
     * Get the dependency graph for a sheet
     */
    async getDependencyGraph(userId: string, sheetId: string) {
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: { spreadsheet: true },
        });

        if (!sheet) {
            throw new NotFoundException('Sheet not found');
        }

        await this.checkSpreadsheetAccess(userId, sheet.spreadsheetId);

        // Get all sheets in the spreadsheet
        const sheets = await this.prisma.sheet.findMany({
            where: { spreadsheetId: sheet.spreadsheetId },
            select: { id: true, name: true },
        });

        // Get all references within the spreadsheet
        const sheetIds = sheets.map(s => s.id);
        const references = await this.prisma.crossSheetReference.findMany({
            where: {
                OR: [
                    { sourceSheetId: { in: sheetIds } },
                    { targetSheetId: { in: sheetIds } },
                ],
            },
            include: {
                sourceSheet: { select: { id: true, name: true } },
                targetSheet: { select: { id: true, name: true } },
            },
        });

        // Build adjacency list
        const graph: Record<string, { name: string; dependsOn: string[]; dependedBy: string[] }> = {};

        for (const s of sheets) {
            graph[s.id] = { name: s.name, dependsOn: [], dependedBy: [] };
        }

        for (const ref of references) {
            if (graph[ref.sourceSheetId] && graph[ref.targetSheetId]) {
                graph[ref.sourceSheetId].dependsOn.push(ref.targetSheetId);
                graph[ref.targetSheetId].dependedBy.push(ref.sourceSheetId);
            }
        }

        // Deduplicate
        for (const id of Object.keys(graph)) {
            graph[id].dependsOn = [...new Set(graph[id].dependsOn)];
            graph[id].dependedBy = [...new Set(graph[id].dependedBy)];
        }

        return {
            sheets: Object.entries(graph).map(([id, data]) => ({
                id,
                ...data,
            })),
            references: references.map(r => ({
                id: r.id,
                from: { sheetId: r.sourceSheetId, sheetName: r.sourceSheet.name, cell: r.sourceCell },
                to: { sheetId: r.targetSheetId, sheetName: r.targetSheet.name, cell: r.targetCell },
                formula: r.formula,
            })),
        };
    }

    /**
     * Detect circular reference
     */
    private async detectCircularReference(
        startSheetId: string,
        startCell: string,
        endSheetId: string,
        endCell: string,
        visited: Set<string> = new Set(),
    ): Promise<boolean> {
        const key = `${startSheetId}:${startCell}`;

        if (startSheetId === endSheetId && startCell === endCell) {
            return true;
        }

        if (visited.has(key)) {
            return false;
        }

        visited.add(key);

        // Get all references FROM the target cell
        const references = await this.prisma.crossSheetReference.findMany({
            where: {
                sourceSheetId: startSheetId,
                sourceCell: startCell,
            },
        });

        for (const ref of references) {
            const hasCircular = await this.detectCircularReference(
                ref.targetSheetId,
                ref.targetCell,
                endSheetId,
                endCell,
                visited,
            );
            if (hasCircular) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolve a cross-sheet reference to get the actual value
     */
    async resolveReference(userId: string, referenceId: string) {
        const reference = await this.prisma.crossSheetReference.findUnique({
            where: { id: referenceId },
            include: {
                targetSheet: true,
                sourceSheet: { include: { spreadsheet: true } },
            },
        });

        if (!reference) {
            throw new NotFoundException('Reference not found');
        }

        await this.checkSpreadsheetAccess(userId, reference.sourceSheet.spreadsheetId);

        // Parse target cell
        const cellMatch = reference.targetCell.match(/^([A-Z]+)(\d+)$/);
        if (!cellMatch) {
            return { value: null, error: 'Invalid cell reference' };
        }

        const col = this.columnLetterToIndex(cellMatch[1]);
        const row = parseInt(cellMatch[2], 10) - 1;

        // Get target cell value
        const cell = await this.prisma.cell.findUnique({
            where: {
                sheetId_row_col: {
                    sheetId: reference.targetSheetId,
                    row,
                    col,
                },
            },
        });

        return {
            value: cell?.value ?? null,
            formula: cell?.formula,
            targetSheet: reference.targetSheet.name,
            targetCell: reference.targetCell,
        };
    }

    /**
     * Convert column letter to index
     */
    private columnLetterToIndex(letter: string): number {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
            result = result * 26 + (letter.charCodeAt(i) - 64);
        }
        return result - 1;
    }

    /**
     * Get all cells that need to be updated when a target cell changes
     */
    async getCellsDependingOn(sheetId: string, cell: string): Promise<Array<{ sheetId: string; cell: string }>> {
        const references = await this.prisma.crossSheetReference.findMany({
            where: {
                targetSheetId: sheetId,
                targetCell: cell,
            },
        });

        return references.map(r => ({
            sheetId: r.sourceSheetId,
            cell: r.sourceCell,
        }));
    }
}
