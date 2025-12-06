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
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

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
      dto.events,
    );
  }

  @Get('spreadsheet/:spreadsheetId')
  listWebhooks(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
  ) {
    return this.webhooksService.listWebhooks(req.user.id, spreadsheetId);
  }

  @Delete(':webhookId')
  deleteWebhook(@Request() req: any, @Param('webhookId') webhookId: string) {
    return this.webhooksService.deleteWebhook(req.user.id, webhookId);
  }

  @Put(':webhookId/toggle')
  toggleWebhook(
    @Request() req: any,
    @Param('webhookId') webhookId: string,
    @Body() dto: { active: boolean },
  ) {
    return this.webhooksService.toggleWebhook(req.user.id, webhookId, dto.active);
  }
}
