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
import { WebhooksService } from './webhooks.service';
import * as WebhookDtos from './dto/webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // =====================================================
  // Webhook CRUD
  // =====================================================

  @Post()
  createWebhook(@Request() req: any, @Body() dto: WebhookDtos.CreateWebhookDto) {
    return this.webhooksService.createWebhook(req.user.id, dto);
  }

  @Get('spreadsheet/:spreadsheetId')
  listWebhooks(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
  ) {
    return this.webhooksService.listWebhooks(req.user.id, spreadsheetId);
  }

  @Get(':webhookId')
  getWebhook(@Request() req: any, @Param('webhookId') webhookId: string) {
    return this.webhooksService.getWebhook(req.user.id, webhookId);
  }

  @Put(':webhookId')
  updateWebhook(
    @Request() req: any,
    @Param('webhookId') webhookId: string,
    @Body() dto: WebhookDtos.UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(req.user.id, webhookId, dto);
  }

  @Delete(':webhookId')
  deleteWebhook(@Request() req: any, @Param('webhookId') webhookId: string) {
    return this.webhooksService.deleteWebhook(req.user.id, webhookId);
  }

  // =====================================================
  // Execution Logs
  // =====================================================

  @Get(':webhookId/executions')
  getExecutionLogs(
    @Request() req: any,
    @Param('webhookId') webhookId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooksService.getExecutionLogs(
      req.user.id,
      webhookId,
      limit ? parseInt(limit) : 50,
    );
  }

  // =====================================================
  // Dead-letter Queue
  // =====================================================

  @Get(':webhookId/dead-letter')
  getDeadLetterQueue(
    @Request() req: any,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.getDeadLetterQueue(req.user.id, webhookId);
  }

  @Post('dead-letter/:itemId/retry')
  retryDeadLetterItem(@Request() req: any, @Param('itemId') itemId: string) {
    return this.webhooksService.retryDeadLetterItem(req.user.id, itemId);
  }

  @Delete('dead-letter/:itemId')
  deleteDeadLetterItem(@Request() req: any, @Param('itemId') itemId: string) {
    return this.webhooksService.deleteDeadLetterItem(req.user.id, itemId);
  }

  // =====================================================
  // Legacy endpoints (deprecated)
  // =====================================================

  /** @deprecated Use POST /webhooks instead */
  @Post('spreadsheet/:spreadsheetId')
  registerWebhook(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: { url: string; events?: string[] },
  ) {
    return this.webhooksService.registerWebhook(
      req.user.id,
      spreadsheetId,
      dto.url,
      dto.events || ['cell.update'],
    );
  }

  /** @deprecated Use PUT /webhooks/:webhookId instead */
  @Put(':webhookId/toggle')
  toggleWebhook(
    @Request() req: any,
    @Param('webhookId') webhookId: string,
    @Body() dto: { active: boolean },
  ) {
    return this.webhooksService.toggleWebhook(req.user.id, webhookId, dto.active);
  }
}

