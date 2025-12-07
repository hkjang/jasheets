import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventRuleDto, UpdateEventRuleDto } from './dto/event-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // =====================================================
  // Event Rules
  // =====================================================

  @Post('rules')
  async createEventRule(@Request() req: any, @Body() dto: CreateEventRuleDto) {
    return this.eventsService.createEventRule(req.user.id, dto);
  }

  @Get('rules')
  async listEventRules(
    @Request() req: any,
    @Query('spreadsheetId') spreadsheetId: string,
  ) {
    return this.eventsService.listEventRules(req.user.id, spreadsheetId);
  }

  @Get('rules/:id')
  async getEventRule(@Request() req: any, @Param('id') id: string) {
    return this.eventsService.getEventRule(req.user.id, id);
  }

  @Put('rules/:id')
  async updateEventRule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEventRuleDto,
  ) {
    return this.eventsService.updateEventRule(req.user.id, id, dto);
  }

  @Delete('rules/:id')
  async deleteEventRule(@Request() req: any, @Param('id') id: string) {
    return this.eventsService.deleteEventRule(req.user.id, id);
  }

  // =====================================================
  // Event Logs
  // =====================================================

  @Get('logs')
  async getEventLogs(
    @Request() req: any,
    @Query('spreadsheetId') spreadsheetId: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.getEventLogs(
      req.user.id,
      spreadsheetId,
      limit ? parseInt(limit) : 100,
    );
  }
}
