import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomCommandsService, CommandContext } from './custom-commands.service';

class CreateCommandDto {
    name: string;
    description?: string;
    script: string;
    shortcuts?: string[];
}

class ExecuteCommandDto {
    sheetId: string;
    selectedRange?: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    };
}

@Controller('spreadsheets/:spreadsheetId/commands')
@UseGuards(JwtAuthGuard)
export class CustomCommandsController {
    constructor(private readonly customCommandsService: CustomCommandsService) { }

    @Get()
    async getCommands(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
    ) {
        return this.customCommandsService.getCommands(req.user.id, spreadsheetId);
    }

    @Get('built-in')
    getBuiltInCommands() {
        return this.customCommandsService.getBuiltInCommands();
    }

    @Get(':commandId')
    async getCommand(
        @Request() req: any,
        @Param('commandId') commandId: string,
    ) {
        return this.customCommandsService.getCommand(req.user.id, commandId);
    }

    @Post()
    async createCommand(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
        @Body() dto: CreateCommandDto,
    ) {
        return this.customCommandsService.createCommand(req.user.id, spreadsheetId, dto);
    }

    @Put(':commandId')
    async updateCommand(
        @Request() req: any,
        @Param('commandId') commandId: string,
        @Body() dto: Partial<CreateCommandDto>,
    ) {
        return this.customCommandsService.updateCommand(req.user.id, commandId, dto);
    }

    @Delete(':commandId')
    async deleteCommand(
        @Request() req: any,
        @Param('commandId') commandId: string,
    ) {
        return this.customCommandsService.deleteCommand(req.user.id, commandId);
    }

    @Post('execute/:commandName')
    async executeCommand(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('commandName') commandName: string,
        @Body() dto: ExecuteCommandDto,
    ) {
        const context: CommandContext = {
            spreadsheetId,
            sheetId: dto.sheetId,
            userId: req.user.id,
            selectedRange: dto.selectedRange,
        };
        return this.customCommandsService.executeCommand(req.user.id, spreadsheetId, commandName, context);
    }

    @Post(':commandId/execute')
    async executeCommandById(
        @Request() req: any,
        @Param('commandId') commandId: string,
        @Body() dto: ExecuteCommandDto,
    ) {
        const context: CommandContext = {
            spreadsheetId: '',
            sheetId: dto.sheetId,
            userId: req.user.id,
            selectedRange: dto.selectedRange,
        };
        return this.customCommandsService.executeCommandById(req.user.id, commandId, context);
    }
}

