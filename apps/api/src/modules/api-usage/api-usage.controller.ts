import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APIUsageService } from './api-usage.service';
import type { RecordUsageDto } from './api-usage.service';


@Controller('admin/api-usage')
@UseGuards(JwtAuthGuard)
export class APIUsageController {
    constructor(private readonly apiUsageService: APIUsageService) { }

    @Post('record')
    async record(@Body() dto: RecordUsageDto) {
        return this.apiUsageService.record(dto);
    }

    @Get('stats')
    async getStats(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.apiUsageService.getStats(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
    }

    @Get('spreadsheet/:id')
    async getSpreadsheetUsage(@Param('id') spreadsheetId: string, @Query('days') days?: string) {
        return this.apiUsageService.getSpreadsheetStats(spreadsheetId, days ? parseInt(days) : 7);
    }

    @Get('user/:id')
    async getUserUsage(
        @Param('id') userId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.apiUsageService.getUsageByUser(
            userId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
    }

    @Get('timeseries')
    async getTimeSeriesData(@Query('hours') hours?: string, @Query('interval') interval?: string) {
        return this.apiUsageService.getTimeSeriesData(
            hours ? parseInt(hours) : 24,
            interval ? parseInt(interval) : 60
        );
    }

    @Post('cleanup')
    async cleanup(@Body() body: { retentionDays?: number }) {
        const count = await this.apiUsageService.cleanup(body.retentionDays);
        return { deleted: count };
    }
}

