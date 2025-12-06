import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

interface WebhookPayload {
  event: string;
  spreadsheetId: string;
  timestamp: string;
  data: any;
}

export interface WebhookConfig {
  id: string;
  spreadsheetId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  
  // In-memory storage for demo (use DB in production)
  private webhooks: Map<string, WebhookConfig> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async registerWebhook(
    userId: string,
    spreadsheetId: string,
    url: string,
    events: string[] = ['cell.update', 'sheet.create', 'sheet.delete'],
  ): Promise<WebhookConfig> {
    // Verify ownership
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    if (spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can register webhooks');
    }

    const webhookId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook: WebhookConfig = {
      id: webhookId,
      spreadsheetId,
      url,
      events,
      secret,
      active: true,
      createdAt: new Date(),
    };

    this.webhooks.set(webhookId, webhook);

    return {
      ...webhook,
      secret: undefined as any, // Don't return on list, only on create
    };
  }

  async listWebhooks(userId: string, spreadsheetId: string): Promise<Omit<WebhookConfig, 'secret'>[]> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    if (spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return Array.from(this.webhooks.values())
      .filter(w => w.spreadsheetId === spreadsheetId)
      .map(({ secret, ...rest }) => rest);
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: webhook.spreadsheetId },
    });

    if (spreadsheet?.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.webhooks.delete(webhookId);
  }

  async toggleWebhook(userId: string, webhookId: string, active: boolean): Promise<WebhookConfig> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: webhook.spreadsheetId },
    });

    if (spreadsheet?.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    webhook.active = active;
    this.webhooks.set(webhookId, webhook);

    const { secret, ...rest } = webhook;
    return rest as WebhookConfig;
  }

  // Trigger webhooks for an event
  async triggerWebhooks(spreadsheetId: string, event: string, data: any): Promise<void> {
    const webhooks = Array.from(this.webhooks.values())
      .filter(w => w.spreadsheetId === spreadsheetId && w.active && w.events.includes(event));

    const payload: WebhookPayload = {
      event,
      spreadsheetId,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of webhooks) {
      this.sendWebhook(webhook, payload);
    }
  }

  private async sendWebhook(webhook: WebhookConfig, payload: WebhookPayload): Promise<void> {
    try {
      const body = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JaSheets-Signature': `sha256=${signature}`,
          'X-JaSheets-Event': payload.event,
        },
        body,
      });

      if (!response.ok) {
        this.logger.warn(`Webhook ${webhook.id} failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Webhook ${webhook.id} error:`, error);
    }
  }

  // Verify webhook signature (for external use)
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }
}
