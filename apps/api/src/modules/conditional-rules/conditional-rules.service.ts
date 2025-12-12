import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConditionalRuleDto, UpdateConditionalRuleDto } from './dto/conditional-rule.dto';

export interface Condition {
    type: 'value' | 'text' | 'date' | 'custom';
    operator: string;
    value: any;
    value2?: any; // For 'between' operators
}

export interface CellFormat {
    backgroundColor?: string;
    textColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontSize?: number;
}

@Injectable()
export class ConditionalRulesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if user has access to the sheet
     */
    private async checkSheetAccess(userId: string, sheetId: string, requireEdit = false): Promise<void> {
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
        const permission = spreadsheet.permissions[0];

        if (!isOwner && !permission) {
            if (!spreadsheet.isPublic) {
                throw new ForbiddenException('No access to this sheet');
            }
            if (requireEdit) {
                throw new ForbiddenException('No edit access to this sheet');
            }
        }

        if (requireEdit && !isOwner && permission && !['OWNER', 'EDITOR'].includes(permission.role)) {
            throw new ForbiddenException('No edit access to this sheet');
        }
    }

    /**
     * Get all conditional rules for a sheet
     */
    async getRules(userId: string, sheetId: string) {
        await this.checkSheetAccess(userId, sheetId);

        return this.prisma.conditionalRule.findMany({
            where: { sheetId },
            orderBy: { priority: 'asc' },
        });
    }

    /**
     * Create a new conditional rule
     */
    async createRule(userId: string, sheetId: string, dto: CreateConditionalRuleDto) {
        await this.checkSheetAccess(userId, sheetId, true);

        // Get max priority
        const maxPriorityRule = await this.prisma.conditionalRule.findFirst({
            where: { sheetId },
            orderBy: { priority: 'desc' },
        });

        const priority = dto.priority ?? (maxPriorityRule ? maxPriorityRule.priority + 1 : 0);

        return this.prisma.conditionalRule.create({
            data: {
                sheetId,
                name: dto.name,
                priority,
                ranges: dto.ranges,
                conditions: dto.conditions,
                format: dto.format,
                active: dto.active ?? true,
            },
        });
    }

    /**
     * Update a conditional rule
     */
    async updateRule(userId: string, ruleId: string, dto: UpdateConditionalRuleDto) {
        const rule = await this.prisma.conditionalRule.findUnique({
            where: { id: ruleId },
        });

        if (!rule) {
            throw new NotFoundException('Rule not found');
        }

        await this.checkSheetAccess(userId, rule.sheetId, true);

        return this.prisma.conditionalRule.update({
            where: { id: ruleId },
            data: {
                name: dto.name,
                priority: dto.priority,
                ranges: dto.ranges,
                conditions: dto.conditions,
                format: dto.format,
                active: dto.active,
            },
        });
    }

    /**
     * Delete a conditional rule
     */
    async deleteRule(userId: string, ruleId: string) {
        const rule = await this.prisma.conditionalRule.findUnique({
            where: { id: ruleId },
        });

        if (!rule) {
            throw new NotFoundException('Rule not found');
        }

        await this.checkSheetAccess(userId, rule.sheetId, true);

        await this.prisma.conditionalRule.delete({
            where: { id: ruleId },
        });

        return { success: true };
    }

    /**
     * Reorder rules by priority
     */
    async reorderRules(userId: string, sheetId: string, ruleIds: string[]) {
        await this.checkSheetAccess(userId, sheetId, true);

        await this.prisma.$transaction(
            ruleIds.map((id, index) =>
                this.prisma.conditionalRule.update({
                    where: { id },
                    data: { priority: index },
                }),
            ),
        );

        return this.getRules(userId, sheetId);
    }

    /**
     * Evaluate conditions for a cell value
     */
    evaluateConditions(value: any, conditions: Condition[]): boolean {
        return conditions.every(condition => this.evaluateCondition(value, condition));
    }

    /**
     * Evaluate a single condition
     */
    private evaluateCondition(value: any, condition: Condition): boolean {
        const { type, operator, value: condValue, value2 } = condition;

        switch (type) {
            case 'value':
                return this.evaluateValueCondition(value, operator, condValue, value2);
            case 'text':
                return this.evaluateTextCondition(String(value ?? ''), operator, String(condValue));
            case 'date':
                return this.evaluateDateCondition(value, operator, condValue, value2);
            case 'custom':
                return this.evaluateCustomCondition(value, operator, condValue);
            default:
                return false;
        }
    }

    /**
     * Evaluate numeric value conditions
     */
    private evaluateValueCondition(value: any, operator: string, condValue: any, condValue2?: any): boolean {
        const numValue = parseFloat(value);
        const numCondValue = parseFloat(condValue);
        const numCondValue2 = condValue2 !== undefined ? parseFloat(condValue2) : undefined;

        if (isNaN(numValue)) return false;

        switch (operator) {
            case 'eq':
                return numValue === numCondValue;
            case 'neq':
                return numValue !== numCondValue;
            case 'gt':
                return numValue > numCondValue;
            case 'gte':
                return numValue >= numCondValue;
            case 'lt':
                return numValue < numCondValue;
            case 'lte':
                return numValue <= numCondValue;
            case 'between':
                return numCondValue2 !== undefined && numValue >= numCondValue && numValue <= numCondValue2;
            case 'notBetween':
                return numCondValue2 !== undefined && (numValue < numCondValue || numValue > numCondValue2);
            default:
                return false;
        }
    }

    /**
     * Evaluate text conditions
     */
    private evaluateTextCondition(value: string, operator: string, condValue: string): boolean {
        const lowerValue = value.toLowerCase();
        const lowerCondValue = condValue.toLowerCase();

        switch (operator) {
            case 'eq':
                return lowerValue === lowerCondValue;
            case 'neq':
                return lowerValue !== lowerCondValue;
            case 'contains':
                return lowerValue.includes(lowerCondValue);
            case 'notContains':
                return !lowerValue.includes(lowerCondValue);
            case 'startsWith':
                return lowerValue.startsWith(lowerCondValue);
            case 'endsWith':
                return lowerValue.endsWith(lowerCondValue);
            case 'isEmpty':
                return value.trim() === '';
            case 'isNotEmpty':
                return value.trim() !== '';
            default:
                return false;
        }
    }

    /**
     * Evaluate date conditions
     */
    private evaluateDateCondition(value: any, operator: string, condValue: any, condValue2?: any): boolean {
        const dateValue = new Date(value);
        const dateCondValue = new Date(condValue);

        if (isNaN(dateValue.getTime()) || isNaN(dateCondValue.getTime())) {
            return false;
        }

        switch (operator) {
            case 'eq':
                return dateValue.getTime() === dateCondValue.getTime();
            case 'before':
                return dateValue.getTime() < dateCondValue.getTime();
            case 'after':
                return dateValue.getTime() > dateCondValue.getTime();
            case 'between':
                const dateCondValue2 = new Date(condValue2);
                return dateValue >= dateCondValue && dateValue <= dateCondValue2;
            default:
                return false;
        }
    }

    /**
     * Evaluate custom formula conditions
     */
    private evaluateCustomCondition(value: any, operator: string, formula: string): boolean {
        // Custom formula evaluation would go here
        // For now, return false for unsupported custom conditions
        return false;
    }

    /**
     * Parse a range string like "A1:B10" to row/col coordinates
     */
    parseRange(rangeStr: string): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
        const match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!match) {
            // Single cell
            const singleMatch = rangeStr.match(/^([A-Z]+)(\d+)$/);
            if (singleMatch) {
                const col = this.columnLetterToIndex(singleMatch[1]);
                const row = parseInt(singleMatch[2], 10) - 1;
                return { startRow: row, endRow: row, startCol: col, endCol: col };
            }
            return null;
        }

        const startCol = this.columnLetterToIndex(match[1]);
        const startRow = parseInt(match[2], 10) - 1;
        const endCol = this.columnLetterToIndex(match[3]);
        const endRow = parseInt(match[4], 10) - 1;

        return { startRow, endRow, startCol, endCol };
    }

    /**
     * Convert column letter to index (A -> 0, B -> 1, etc.)
     */
    private columnLetterToIndex(letter: string): number {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
            result = result * 26 + (letter.charCodeAt(i) - 64);
        }
        return result - 1;
    }

    /**
     * Check if a cell is within any of the given ranges
     */
    isCellInRanges(row: number, col: number, ranges: string[]): boolean {
        return ranges.some(rangeStr => {
            const range = this.parseRange(rangeStr);
            if (!range) return false;
            return (
                row >= range.startRow &&
                row <= range.endRow &&
                col >= range.startCol &&
                col <= range.endCol
            );
        });
    }

    /**
     * Get applicable format for a cell based on all active rules
     */
    async getCellFormat(sheetId: string, row: number, col: number, value: any): Promise<CellFormat | null> {
        const rules = await this.prisma.conditionalRule.findMany({
            where: { sheetId, active: true },
            orderBy: { priority: 'asc' },
        });

        for (const rule of rules) {
            if (this.isCellInRanges(row, col, rule.ranges)) {
                const conditions = rule.conditions as unknown as Condition[];
                if (this.evaluateConditions(value, conditions)) {
                    return rule.format as CellFormat;
                }
            }
        }

        return null;
    }
}
