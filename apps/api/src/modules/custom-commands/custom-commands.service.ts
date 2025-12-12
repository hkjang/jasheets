import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CommandContext {
    spreadsheetId: string;
    sheetId: string;
    userId: string;
    selectedRange?: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    };
    data?: any[][];
}

export interface CommandResult {
    success: boolean;
    output?: any;
    error?: string;
    cellUpdates?: Array<{ row: number; col: number; value: any }>;
}

@Injectable()
export class CustomCommandsService {
    private readonly logger = new Logger(CustomCommandsService.name);

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
            throw new ForbiddenException('No access to this spreadsheet');
        }

        if (requireEdit && !isOwner && (!permission || !['OWNER', 'EDITOR'].includes(permission.role))) {
            throw new ForbiddenException('No edit access');
        }
    }

    /**
     * Get all custom commands for a spreadsheet
     */
    async getCommands(userId: string, spreadsheetId: string) {
        await this.checkAccess(userId, spreadsheetId);

        return this.prisma.customCommand.findMany({
            where: { spreadsheetId },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get a specific command
     */
    async getCommand(userId: string, commandId: string) {
        const command = await this.prisma.customCommand.findUnique({
            where: { id: commandId },
        });

        if (!command) {
            throw new NotFoundException('Command not found');
        }

        await this.checkAccess(userId, command.spreadsheetId);
        return command;
    }

    /**
     * Create a new custom command
     */
    async createCommand(
        userId: string,
        spreadsheetId: string,
        data: { name: string; description?: string; script: string; shortcuts?: string[] },
    ) {
        await this.checkAccess(userId, spreadsheetId, true);

        return this.prisma.customCommand.create({
            data: {
                spreadsheetId,
                name: data.name,
                description: data.description,
                script: data.script,
                shortcuts: data.shortcuts || [],
                createdById: userId,
            },
        });
    }

    /**
     * Update a custom command
     */
    async updateCommand(
        userId: string,
        commandId: string,
        data: { name?: string; description?: string; script?: string; shortcuts?: string[] },
    ) {
        const command = await this.getCommand(userId, commandId);
        await this.checkAccess(userId, command.spreadsheetId, true);

        return this.prisma.customCommand.update({
            where: { id: commandId },
            data,
        });
    }

    /**
     * Delete a custom command
     */
    async deleteCommand(userId: string, commandId: string) {
        const command = await this.getCommand(userId, commandId);
        await this.checkAccess(userId, command.spreadsheetId, true);

        await this.prisma.customCommand.delete({
            where: { id: commandId },
        });

        return { success: true };
    }

    /**
     * Execute a command by name
     */
    async executeCommand(userId: string, spreadsheetId: string, commandName: string, context: CommandContext): Promise<CommandResult> {
        await this.checkAccess(userId, spreadsheetId, true);

        const command = await this.prisma.customCommand.findUnique({
            where: { spreadsheetId_name: { spreadsheetId, name: commandName } },
        });

        if (!command) {
            throw new NotFoundException(`Command "${commandName}" not found`);
        }

        return this.runScript(command.script, context);
    }

    /**
     * Execute a command by ID
     */
    async executeCommandById(userId: string, commandId: string, context: CommandContext): Promise<CommandResult> {
        const command = await this.getCommand(userId, commandId);
        await this.checkAccess(userId, command.spreadsheetId, true);

        return this.runScript(command.script, context);
    }

    /**
     * Run a command script in a sandboxed environment
     * Note: For security, real production would use a proper sandbox like isolated-vm
     */
    private async runScript(script: string, context: CommandContext): Promise<CommandResult> {
        try {
            this.logger.log(`Executing custom command script for sheet ${context.sheetId}`);

            // Create a safe context with limited capabilities
            const cellUpdates: Array<{ row: number; col: number; value: any }> = [];
            let output: any = null;

            // Parse and execute simple commands
            // In production, use a proper JavaScript sandbox
            const lines = script.split('\n').filter(l => l.trim());

            for (const line of lines) {
                const trimmed = line.trim();

                // SET cell value: SET A1 = "value"
                const setMatch = trimmed.match(/^SET\s+([A-Z]+)(\d+)\s*=\s*(.+)$/i);
                if (setMatch) {
                    const col = this.columnLetterToIndex(setMatch[1]);
                    const row = parseInt(setMatch[2], 10) - 1;
                    let value: any = setMatch[3];

                    // Parse value
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    } else if (!isNaN(Number(value))) {
                        value = Number(value);
                    }

                    cellUpdates.push({ row, col, value });
                    continue;
                }

                // FILL range with value: FILL A1:B5 = "value"
                const fillMatch = trimmed.match(/^FILL\s+([A-Z]+)(\d+):([A-Z]+)(\d+)\s*=\s*(.+)$/i);
                if (fillMatch) {
                    const startCol = this.columnLetterToIndex(fillMatch[1]);
                    const startRow = parseInt(fillMatch[2], 10) - 1;
                    const endCol = this.columnLetterToIndex(fillMatch[3]);
                    const endRow = parseInt(fillMatch[4], 10) - 1;
                    let value: any = fillMatch[5];

                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    } else if (!isNaN(Number(value))) {
                        value = Number(value);
                    }

                    for (let r = startRow; r <= endRow; r++) {
                        for (let c = startCol; c <= endCol; c++) {
                            cellUpdates.push({ row: r, col: c, value });
                        }
                    }
                    continue;
                }

                // RETURN output: RETURN "message"
                const returnMatch = trimmed.match(/^RETURN\s+(.+)$/i);
                if (returnMatch) {
                    let value = returnMatch[1];
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    output = value;
                    continue;
                }
            }

            // Apply cell updates to database
            if (cellUpdates.length > 0) {
                await Promise.all(
                    cellUpdates.map(update =>
                        this.prisma.cell.upsert({
                            where: {
                                sheetId_row_col: {
                                    sheetId: context.sheetId,
                                    row: update.row,
                                    col: update.col,
                                },
                            },
                            update: { value: update.value },
                            create: {
                                sheetId: context.sheetId,
                                row: update.row,
                                col: update.col,
                                value: update.value,
                            },
                        }),
                    ),
                );
            }

            return {
                success: true,
                output,
                cellUpdates,
            };
        } catch (error) {
            this.logger.error('Command execution error:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Convert column letter to index
     */
    private columnLetterToIndex(letter: string): number {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
            result = result * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
        }
        return result - 1;
    }

    /**
     * Get built-in commands
     */
    getBuiltInCommands(): Array<{ name: string; description: string }> {
        return [
            { name: 'clear-selection', description: 'Clear the selected cell range' },
            { name: 'fill-down', description: 'Fill down from the first row of selection' },
            { name: 'fill-right', description: 'Fill right from the first column of selection' },
            { name: 'today', description: 'Insert today\'s date' },
            { name: 'now', description: 'Insert current date and time' },
            { name: 'uppercase', description: 'Convert selected text to uppercase' },
            { name: 'lowercase', description: 'Convert selected text to lowercase' },
            { name: 'sum', description: 'Insert SUM formula for selection' },
            { name: 'average', description: 'Insert AVERAGE formula for selection' },
        ];
    }
}
