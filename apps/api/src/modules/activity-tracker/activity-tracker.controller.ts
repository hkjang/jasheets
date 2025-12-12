import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityTrackerService } from './activity-tracker.service';
import type { StartSessionDto } from './activity-tracker.service';


@Controller('admin/activity')
@UseGuards(JwtAuthGuard)
export class ActivityTrackerController {
    constructor(private readonly activityTrackerService: ActivityTrackerService) { }

    @Post('session/start')
    async startSession(@Request() req: any, @Body() dto: StartSessionDto) {
        return this.activityTrackerService.startSession(req.user.id, dto);
    }


    @Put('session/:id/activity')
    async updateActivity(@Param('id') id: string) {
        return this.activityTrackerService.updateActivity(id);
    }

    @Put('session/:id/edit')
    async recordEdit(@Param('id') id: string) {
        return this.activityTrackerService.recordEdit(id);
    }

    @Put('session/:id/view')
    async recordView(@Param('id') id: string) {
        return this.activityTrackerService.recordView(id);
    }

    @Put('session/:id/end')
    async endSession(@Param('id') id: string) {
        return this.activityTrackerService.endSession(id);
    }

    @Get('sessions/active')
    async getActiveSessions(@Query('spreadsheetId') spreadsheetId?: string) {
        return this.activityTrackerService.getActiveSessionsWithUsers(spreadsheetId);
    }

    @Get('spreadsheet/:id')
    async getSpreadsheetActivity(@Param('id') spreadsheetId: string) {
        return this.activityTrackerService.getSpreadsheetActivity(spreadsheetId);
    }

    @Get('all')
    async getAllSpreadsheetActivity() {
        return this.activityTrackerService.getAllSpreadsheetActivity();
    }

    @Get('user/:userId')
    async getUserActivity(@Param('userId') userId: string, @Query('days') days?: string) {
        return this.activityTrackerService.getUserActivity(userId, days ? parseInt(days) : 7);
    }

    @Post('cleanup')
    async cleanupStaleSessions() {
        const count = await this.activityTrackerService.cleanupStaleSessions();
        return { cleaned: count };
    }
}

