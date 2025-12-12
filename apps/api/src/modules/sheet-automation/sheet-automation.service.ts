import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSheetAutomationDto, UpdateSheetAutomationDto } from './dto/sheet-automation.dto';
import { EventType } from '@prisma/client';

export interface AutomationTrigger {
    eventType: string;
    conditions?: Array<{
        field: string;
        operator: string;
        value: any;
    }>;
}

export interface AutomationAction {
    type: string;
    config: Record<string, any>;
}

export interface TriggerContext {
    sheetId: string;
    spreadsheetId: string;
    userId: string;
    eventType: EventType;
    cell?: { row: number; col: number };
    previousValue?: any;
    newValue?: any;
    affectedRange?: string;
}

@Injectable()
export class SheetAutomationService {
    private readonly logger = new Logger(SheetAutomationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check sheet access
     */
    private async checkSheetAccess(userId: string, sheetId: string, requireEdit = false): Promise<void> {
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: {
                spreadsheet: {
                    include: {
                        permissions: { where: { userId } },
                    },
                },
            },
        });

        if (!sheet) {
            throw new NotFoundException('Sheet not found');
        }

        const isOwner = sheet.spreadsheet.ownerId === userId;
        const permission = sheet.spreadsheet.permissions[0];

        if (!isOwner && !permission) {
            throw new ForbiddenException('No access to this sheet');
        }

        if (requireEdit && !isOwner && (!permission || !['OWNER', 'EDITOR'].includes(permission.role))) {
            throw new ForbiddenException('No edit access to this sheet');
        }
    }

    /**
     * Get all automations for a sheet
     */
    async getAutomations(userId: string, sheetId: string) {
        await this.checkSheetAccess(userId, sheetId);

        return this.prisma.sheetAutomation.findMany({
            where: { sheetId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a specific automation
     */
    async getAutomation(userId: string, automationId: string) {
        const automation = await this.prisma.sheetAutomation.findUnique({
            where: { id: automationId },
        });

        if (!automation) {
            throw new NotFoundException('Automation not found');
        }

        await this.checkSheetAccess(userId, automation.sheetId);
        return automation;
    }

    /**
     * Create a new automation rule
     */
    async createAutomation(userId: string, sheetId: string, dto: CreateSheetAutomationDto) {
        await this.checkSheetAccess(userId, sheetId, true);

        return this.prisma.sheetAutomation.create({
            data: {
                sheetId,
                name: dto.name,
                description: dto.description,
                trigger: dto.trigger,
                actions: dto.actions,
                active: dto.active ?? true,
                createdById: userId,
            },
        });
    }

    /**
     * Update an automation rule
     */
    async updateAutomation(userId: string, automationId: string, dto: UpdateSheetAutomationDto) {
        const automation = await this.getAutomation(userId, automationId);
        await this.checkSheetAccess(userId, automation.sheetId, true);

        return this.prisma.sheetAutomation.update({
            where: { id: automationId },
            data: {
                name: dto.name,
                description: dto.description,
                trigger: dto.trigger,
                actions: dto.actions,
                active: dto.active,
            },
        });
    }

    /**
     * Delete an automation rule
     */
    async deleteAutomation(userId: string, automationId: string) {
        const automation = await this.getAutomation(userId, automationId);
        await this.checkSheetAccess(userId, automation.sheetId, true);

        await this.prisma.sheetAutomation.delete({
            where: { id: automationId },
        });

        return { success: true };
    }

    /**
     * Toggle automation active state
     */
    async toggleAutomation(userId: string, automationId: string) {
        const automation = await this.getAutomation(userId, automationId);
        await this.checkSheetAccess(userId, automation.sheetId, true);

        return this.prisma.sheetAutomation.update({
            where: { id: automationId },
            data: { active: !automation.active },
        });
    }

    /**
     * Get automations that should trigger for an event
     */
    async getTriggeredAutomations(sheetId: string, eventType: string) {
        const automations = await this.prisma.sheetAutomation.findMany({
            where: {
                sheetId,
                active: true,
            },
        });

        return automations.filter(automation => {
            const trigger = automation.trigger as unknown as AutomationTrigger;
            return trigger.eventType === eventType;
        });
    }

    /**
     * Evaluate if trigger conditions are met
     */
    evaluateTriggerConditions(trigger: AutomationTrigger, context: TriggerContext): boolean {
        if (!trigger.conditions || trigger.conditions.length === 0) {
            return true;
        }

        return trigger.conditions.every(condition => {
            const value = this.getContextValue(context, condition.field);
            return this.evaluateCondition(value, condition.operator, condition.value);
        });
    }

    /**
     * Get value from context by field path
     */
    private getContextValue(context: TriggerContext, field: string): any {
        const parts = field.split('.');
        let value: any = context;

        for (const part of parts) {
            if (value === undefined || value === null) return undefined;
            value = value[part];
        }

        return value;
    }

    /**
     * Evaluate a single condition
     */
    private evaluateCondition(value: any, operator: string, targetValue: any): boolean {
        switch (operator) {
            case 'equals':
                return value === targetValue;
            case 'notEquals':
                return value !== targetValue;
            case 'contains':
                return String(value).includes(String(targetValue));
            case 'startsWith':
                return String(value).startsWith(String(targetValue));
            case 'endsWith':
                return String(value).endsWith(String(targetValue));
            case 'greaterThan':
                return Number(value) > Number(targetValue);
            case 'lessThan':
                return Number(value) < Number(targetValue);
            case 'isEmpty':
                return value === null || value === undefined || value === '';
            case 'isNotEmpty':
                return value !== null && value !== undefined && value !== '';
            case 'changed':
                return true; // Always true if we're in an event context
            default:
                return false;
        }
    }

    /**
     * Execute automation actions
     */
    async executeActions(
        automationId: string,
        actions: AutomationAction[],
        context: TriggerContext,
    ): Promise<{ success: boolean; results: any[] }> {
        const results: any[] = [];

        for (const action of actions) {
            try {
                const result = await this.executeAction(action, context);
                results.push({ action: action.type, success: true, result });
            } catch (error) {
                this.logger.error(`Failed to execute action ${action.type}:`, error);
                results.push({ action: action.type, success: false, error: error.message });
            }
        }

        // Update run count and last run time
        await this.prisma.sheetAutomation.update({
            where: { id: automationId },
            data: {
                runCount: { increment: 1 },
                lastRunAt: new Date(),
            },
        });

        return {
            success: results.every(r => r.success),
            results,
        };
    }

    /**
     * Execute a single action
     */
    private async executeAction(action: AutomationAction, context: TriggerContext): Promise<any> {
        switch (action.type) {
            case 'SET_VALUE':
                return this.executeSetValue(action.config, context);
            case 'SEND_NOTIFICATION':
                return this.executeSendNotification(action.config, context);
            case 'LOG':
                return this.executeLog(action.config, context);
            case 'COPY_VALUE':
                return this.executeCopyValue(action.config, context);
            default:
                this.logger.warn(`Unknown action type: ${action.type}`);
                return { skipped: true, reason: `Unknown action type: ${action.type}` };
        }
    }

    /**
     * SET_VALUE action: Set a cell value
     */
    private async executeSetValue(config: Record<string, any>, context: TriggerContext) {
        const { targetCell, value } = config;
        const [col, row] = this.parseCell(targetCell);

        if (row === null || col === null) {
            throw new Error(`Invalid target cell: ${targetCell}`);
        }

        // Replace placeholders in value
        const resolvedValue = this.resolvePlaceholders(value, context);

        await this.prisma.cell.upsert({
            where: {
                sheetId_row_col: {
                    sheetId: context.sheetId,
                    row,
                    col,
                },
            },
            update: { value: resolvedValue },
            create: {
                sheetId: context.sheetId,
                row,
                col,
                value: resolvedValue,
            },
        });

        return { targetCell, value: resolvedValue };
    }

    /**
     * SEND_NOTIFICATION action: Create a notification
     */
    private async executeSendNotification(config: Record<string, any>, context: TriggerContext) {
        const { message, type = 'info' } = config;
        const resolvedMessage = this.resolvePlaceholders(message, context);

        // Log the notification (in a real system, this would send to notification service)
        this.logger.log(`Notification: [${type}] ${resolvedMessage}`);

        return { message: resolvedMessage, type };
    }

    /**
     * LOG action: Log a message
     */
    private async executeLog(config: Record<string, any>, context: TriggerContext) {
        const { message } = config;
        const resolvedMessage = this.resolvePlaceholders(message, context);

        this.logger.log(`Automation Log: ${resolvedMessage}`);

        return { logged: resolvedMessage };
    }

    /**
     * COPY_VALUE action: Copy value from one cell to another
     */
    private async executeCopyValue(config: Record<string, any>, context: TriggerContext) {
        const { sourceCell, targetCell } = config;

        const [sourceCol, sourceRow] = this.parseCell(sourceCell);
        const [targetCol, targetRow] = this.parseCell(targetCell);

        if (sourceRow === null || sourceCol === null || targetRow === null || targetCol === null) {
            throw new Error('Invalid source or target cell');
        }

        const source = await this.prisma.cell.findUnique({
            where: {
                sheetId_row_col: {
                    sheetId: context.sheetId,
                    row: sourceRow,
                    col: sourceCol,
                },
            },
        });

        const value = source?.value ?? '';

        await this.prisma.cell.upsert({
            where: {
                sheetId_row_col: {
                    sheetId: context.sheetId,
                    row: targetRow,
                    col: targetCol,
                },
            },
            update: { value },
            create: {
                sheetId: context.sheetId,
                row: targetRow,
                col: targetCol,
                value,
            },
        });

        return { sourceCell, targetCell, value };
    }

    /**
     * Parse cell reference like "A1" to [col, row]
     */
    private parseCell(cellRef: string): [number | null, number | null] {
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (!match) return [null, null];

        const colLetter = match[1];
        const row = parseInt(match[2], 10) - 1;

        let col = 0;
        for (let i = 0; i < colLetter.length; i++) {
            col = col * 26 + (colLetter.charCodeAt(i) - 64);
        }
        col -= 1;

        return [col, row];
    }

    /**
     * Replace placeholders in string with context values
     */
    private resolvePlaceholders(template: string, context: TriggerContext): string {
        if (typeof template !== 'string') return template;

        return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
            const value = this.getContextValue(context, path);
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Process an event and run matching automations
     */
    async processEvent(context: TriggerContext) {
        const automations = await this.getTriggeredAutomations(context.sheetId, context.eventType);
        const results: any[] = [];

        for (const automation of automations) {
            const trigger = automation.trigger as unknown as AutomationTrigger;

            if (this.evaluateTriggerConditions(trigger, context)) {
                const actions = automation.actions as unknown as AutomationAction[];
                const result = await this.executeActions(automation.id, actions, context);
                results.push({
                    automationId: automation.id,
                    automationName: automation.name,
                    ...result,
                });
            }
        }

        return results;
    }
}
