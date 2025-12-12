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
import { SheetAutomationService } from './sheet-automation.service';
import { CreateSheetAutomationDto, UpdateSheetAutomationDto } from './dto/sheet-automation.dto';

@Controller('sheets/:sheetId/automations')
@UseGuards(JwtAuthGuard)
export class SheetAutomationController {
    constructor(private readonly sheetAutomationService: SheetAutomationService) { }

    @Get()
    async getAutomations(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.sheetAutomationService.getAutomations(req.user.id, sheetId);
    }

    @Get(':automationId')
    async getAutomation(
        @Request() req: any,
        @Param('automationId') automationId: string,
    ) {
        return this.sheetAutomationService.getAutomation(req.user.id, automationId);
    }

    @Post()
    async createAutomation(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateSheetAutomationDto,
    ) {
        return this.sheetAutomationService.createAutomation(req.user.id, sheetId, dto);
    }

    @Put(':automationId')
    async updateAutomation(
        @Request() req: any,
        @Param('automationId') automationId: string,
        @Body() dto: UpdateSheetAutomationDto,
    ) {
        return this.sheetAutomationService.updateAutomation(req.user.id, automationId, dto);
    }

    @Delete(':automationId')
    async deleteAutomation(
        @Request() req: any,
        @Param('automationId') automationId: string,
    ) {
        return this.sheetAutomationService.deleteAutomation(req.user.id, automationId);
    }

    @Post(':automationId/toggle')
    async toggleAutomation(
        @Request() req: any,
        @Param('automationId') automationId: string,
    ) {
        return this.sheetAutomationService.toggleAutomation(req.user.id, automationId);
    }
}
