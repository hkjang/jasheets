import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Webhook } from '@prisma/client';
import * as crypto from 'crypto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

// Re-export for backwards compatibility
export { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

// =====================================================
// Types & Interfaces
// =====================================================

export interface WebhookPayload {
  event: string;
  transactionId: string;
  spreadsheetId: string;
  sheetId?: string;
  timestamp: string;
  data: CellChangeData | CellChangeData[];
}

export interface CellChangeData {
  cellCoordinate: string;
  previousValue: any;
  newValue: any;
  changedBy?: string;
  changeMethod?: string;
}

// =====================================================
// Service
// =====================================================

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // Permission Check Helper
  // =====================================================

  private async checkSpreadsheetAccess(userId: string, spreadsheetId: string): Promise<boolean> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: { permissions: true },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    // Owner has access
    if (spreadsheet.ownerId === userId) {
      return true;
    }

    // Users with EDITOR or OWNER permissions have access
    const hasPermission = spreadsheet.permissions.some(
      (p) => p.userId === userId && (p.role === 'EDITOR' || p.role === 'OWNER')
    );

    return hasPermission;
  }

  // =====================================================
  // Webhook CRUD (DB-based)
  // =====================================================

  async createWebhook(userId: string, dto: CreateWebhookDto): Promise<Webhook> {
    const hasAccess = await this.checkSpreadsheetAccess(userId, dto.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const secret = crypto.randomBytes(32).toString('hex');

    return this.prisma.webhook.create({
      data: {
        spreadsheetId: dto.spreadsheetId,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events || ['cell.update', 'sheet.create', 'sheet.delete'],
        maxRetries: dto.maxRetries ?? 3,
        retryBackoff: dto.retryBackoff ?? 'exponential',
        active: true,
      },
    });
  }

  async listWebhooks(userId: string, spreadsheetId: string) {
    const hasAccess = await this.checkSpreadsheetAccess(userId, spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.webhook.findMany({
      where: { spreadsheetId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        maxRetries: true,
        retryBackoff: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getWebhook(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { spreadsheet: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return webhook;
  }

  async updateWebhook(userId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { spreadsheet: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.webhook.update({
      where: { id: webhookId },
      data: dto,
    });
  }

  async deleteWebhook(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { spreadsheet: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.webhook.delete({
      where: { id: webhookId },
    });
  }

  // =====================================================
  // Webhook Triggering
  // =====================================================

  async triggerWebhook(
    webhookId: string,
    transactionId: string,
    eventData: CellChangeData | CellChangeData[],
    eventType: string,
  ) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.active) {
      return;
    }

    if (!webhook.events.includes(eventType)) {
      return;
    }

    const payload: WebhookPayload = {
      event: eventType,
      transactionId,
      spreadsheetId: webhook.spreadsheetId,
      timestamp: new Date().toISOString(),
      data: eventData,
    };

    await this.executeWithRetry(webhook, payload, transactionId);
  }

  async triggerWebhooksForSpreadsheet(
    spreadsheetId: string,
    transactionId: string,
    eventData: CellChangeData | CellChangeData[],
    eventType: string,
  ) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        spreadsheetId,
        active: true,
        events: { has: eventType },
      },
    });

    for (const webhook of webhooks) {
      const payload: WebhookPayload = {
        event: eventType,
        transactionId,
        spreadsheetId,
        timestamp: new Date().toISOString(),
        data: eventData,
      };

      await this.executeWithRetry(webhook, payload, transactionId);
    }
  }

  // =====================================================
  // Retry Logic
  // =====================================================

  private async executeWithRetry(
    webhook: Webhook,
    payload: WebhookPayload,
    transactionId: string,
  ) {
    const maxRetries = webhook.maxRetries || 3;
    let lastError: string | null = null;
    let lastStatusCode: number | null = null;
    let response: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Webhook ${webhook.id} attempt ${attempt}`);

        response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.generateSignature(JSON.stringify(payload), webhook.secret),
            'X-Transaction-Id': transactionId,
          },
          body: JSON.stringify(payload),
        });

        lastStatusCode = response.status;

        if (response.ok) {
          await this.logExecution(webhook.id, transactionId, payload, {
            success: true,
            statusCode: lastStatusCode,
            response: await response.text(),
            attempts: attempt,
          });
          return;
        }

        this.logger.warn(`Webhook ${webhook.id} failed with status ${response.status}`);
      } catch (error: any) {
        lastError = error.message;
        this.logger.error(`Webhook ${webhook.id} attempt ${attempt} error: ${lastError}`);
      }

      if (attempt < maxRetries) {
        const backoffMs = this.calculateBackoff(webhook.retryBackoff, attempt);
        await this.sleep(backoffMs);
      }
    }

    // All retries failed
    await this.logExecution(webhook.id, transactionId, payload, {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      attempts: maxRetries,
    });

    // Add to dead letter queue
    await this.addToDeadLetterQueue(webhook.id, payload, lastError || 'Max retries exceeded');
  }

  private async logExecution(
    webhookId: string,
    transactionId: string,
    payload: WebhookPayload,
    result: { success: boolean; statusCode?: number | null; response?: any; error?: string | null; attempts: number },
  ) {
    await this.prisma.webhookExecution.create({
      data: {
        webhookId,
        transactionId,
        success: result.success,
        statusCode: result.statusCode,
        response: result.response,
        retryCount: result.attempts,
        payload: payload as any,
      },
    });
  }

  async getExecutionLogs(userId: string, webhookId: string, limit = 50) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { spreadsheet: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.webhookExecution.findMany({
      where: { webhookId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  // =====================================================
  // Dead Letter Queue
  // =====================================================

  private async addToDeadLetterQueue(
    webhookId: string,
    payload: WebhookPayload,
    error: string,
  ) {
    await this.prisma.deadLetterItem.create({
      data: {
        webhookId,
        payload: payload as any,
        error,
      },
    });
  }

  async getDeadLetterQueue(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { spreadsheet: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.deadLetterItem.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retryDeadLetterItem(userId: string, itemId: string) {
    const item = await this.prisma.deadLetterItem.findUnique({
      where: { id: itemId },
      include: { webhook: { include: { spreadsheet: true } } },
    });

    if (!item) {
      throw new NotFoundException('Dead letter item not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, item.webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const payload = item.payload as unknown as WebhookPayload;
    await this.executeWithRetry(item.webhook, payload, payload.transactionId);

    return this.prisma.deadLetterItem.delete({
      where: { id: itemId },
    });
  }

  async deleteDeadLetterItem(userId: string, itemId: string) {
    const item = await this.prisma.deadLetterItem.findUnique({
      where: { id: itemId },
      include: { webhook: { include: { spreadsheet: true } } },
    });

    if (!item) {
      throw new NotFoundException('Dead letter item not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, item.webhook.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.deadLetterItem.delete({
      where: { id: itemId },
    });
  }

  // =====================================================
  // Utilities
  // =====================================================

  private generateSignature(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  verifySignature(body: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(body, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private calculateBackoff(strategy: string, attempt: number): number {
    const baseDelay = 1000;

    if (strategy === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    }

    // Linear
    return baseDelay * attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =====================================================
  // Legacy API compatibility
  // =====================================================

  async registerWebhook(
    userId: string,
    spreadsheetId: string,
    url: string,
    events: string[],
  ) {
    return this.createWebhook(userId, {
      spreadsheetId,
      name: 'Auto-registered webhook',
      url,
      events,
    });
  }

  async triggerWebhooks(spreadsheetId: string, event: string, data: any) {
    const transactionId = crypto.randomUUID();
    await this.triggerWebhooksForSpreadsheet(spreadsheetId, transactionId, data, event);
  }

  async toggleWebhook(userId: string, webhookId: string, active: boolean) {
    return this.updateWebhook(userId, webhookId, { active });
  }
}
