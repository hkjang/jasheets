import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventRuleDto, UpdateEventRuleDto, FilterConditions } from './dto/event-rule.dto';
import { EventType, TargetType } from '@prisma/client';
import * as crypto from 'crypto';

export interface CellChangeEvent {
  spreadsheetId: string;
  sheetId: string;
  row: number;
  col: number;
  previousValue: any;
  newValue: any;
  changedBy?: string;
  changeMethod?: 'manual' | 'formula' | 'api' | 'import';
}

export interface EventPayload {
  transactionId: string;
  eventType: EventType;
  spreadsheetId: string;
  sheetId: string;
  cellCoordinate: string;
  previousValue: any;
  newValue: any;
  changedBy?: string;
  changeMethod?: string;
  timestamp: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  
  // Batch event buffer
  private batchBuffer: Map<string, { events: CellChangeEvent[], timeout: NodeJS.Timeout }> = new Map();

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

    if (spreadsheet.ownerId === userId) return true;

    return spreadsheet.permissions.some(
      (p) => p.userId === userId && (p.role === 'EDITOR' || p.role === 'OWNER')
    );
  }

  // =====================================================
  // Event Rule CRUD
  // =====================================================

  async createEventRule(userId: string, dto: CreateEventRuleDto) {
    const hasAccess = await this.checkSpreadsheetAccess(userId, dto.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.eventRule.create({
      data: {
        spreadsheetId: dto.spreadsheetId,
        name: dto.name,
        description: dto.description,
        targetType: dto.targetType || TargetType.SHEET,
        sheetId: dto.sheetId,
        cellRange: dto.cellRange,
        cellCoordinates: dto.cellCoordinates as any,
        eventTypes: dto.eventTypes || [EventType.CELL_CHANGE],
        filterConditions: dto.filterConditions as any,
        batchMode: dto.batchMode || false,
        batchWindow: dto.batchWindow,
        webhookId: dto.webhookId,
        flowId: dto.flowId,
      },
    });
  }

  async updateEventRule(userId: string, ruleId: string, dto: UpdateEventRuleDto) {
    const rule = await this.prisma.eventRule.findUnique({
      where: { id: ruleId },
      include: { spreadsheet: true },
    });

    if (!rule) {
      throw new NotFoundException('Event rule not found');
    }

    if (rule.spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.eventRule.update({
      where: { id: ruleId },
      data: {
        ...dto,
        cellCoordinates: dto.cellCoordinates as any,
        filterConditions: dto.filterConditions as any,
        version: { increment: 1 },
      },
    });
  }

  async deleteEventRule(userId: string, ruleId: string) {
    const rule = await this.prisma.eventRule.findUnique({
      where: { id: ruleId },
      include: { spreadsheet: true },
    });

    if (!rule) {
      throw new NotFoundException('Event rule not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, rule.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.eventRule.delete({
      where: { id: ruleId },
    });
  }

  async listEventRules(userId: string, spreadsheetId: string) {
    const hasAccess = await this.checkSpreadsheetAccess(userId, spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.eventRule.findMany({
      where: { spreadsheetId, active: true },
      include: { webhook: true, flow: true },
    });
  }

  async getEventRule(userId: string, ruleId: string) {
    const rule = await this.prisma.eventRule.findUnique({
      where: { id: ruleId },
      include: { spreadsheet: true, webhook: true, flow: true },
    });

    if (!rule) {
      throw new NotFoundException('Event rule not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, rule.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return rule;
  }

  // =====================================================
  // Event Detection
  // =====================================================

  async detectCellChange(event: CellChangeEvent): Promise<void> {
    const transactionId = crypto.randomUUID();
    const cellCoordinate = this.toCellRef(event.row, event.col);

    // Find matching rules
    const rules = await this.findMatchingRules(event);

    for (const rule of rules) {
      // Apply filters
      if (!this.matchesFilter(event, rule.filterConditions as FilterConditions)) {
        continue;
      }

      // Handle batch mode
      if (rule.batchMode && rule.batchWindow) {
        this.addToBatch(rule.id, event, rule.batchWindow);
        continue;
      }

      // Log the event
      await this.logEvent(rule.id, event, transactionId, cellCoordinate);

      // Trigger webhook or flow
      await this.triggerActions(rule, event, transactionId);
    }
  }

  async detectMultiCellChange(events: CellChangeEvent[]): Promise<void> {
    const transactionId = crypto.randomUUID();

    if (events.length === 0) return;

    const spreadsheetId = events[0].spreadsheetId;
    const sheetId = events[0].sheetId;

    // Find rules that match MULTI_CELL_CHANGE
    const rules = await this.prisma.eventRule.findMany({
      where: {
        spreadsheetId,
        active: true,
        eventTypes: { has: EventType.MULTI_CELL_CHANGE },
      },
      include: { webhook: true, flow: true },
    });

    for (const rule of rules) {
      // Log events
      for (const event of events) {
        const cellCoordinate = this.toCellRef(event.row, event.col);
        await this.logEvent(rule.id, event, transactionId, cellCoordinate);
      }

      // Trigger actions with batch data
      await this.triggerActions(rule, events, transactionId);
    }
  }

  // =====================================================
  // Event Filtering
  // =====================================================

  private matchesFilter(event: CellChangeEvent, filter?: FilterConditions | null): boolean {
    if (!filter) return true;

    const { operator, value, dataType } = filter;

    switch (operator) {
      case 'equals':
        return event.newValue === value;
      case 'not_equals':
        return event.newValue !== value;
      case 'contains':
        return String(event.newValue).includes(String(value));
      case 'greater_than':
        return Number(event.newValue) > Number(value);
      case 'less_than':
        return Number(event.newValue) < Number(value);
      case 'changed':
        return event.previousValue !== event.newValue;
      case 'type_changed':
        return typeof event.previousValue !== typeof event.newValue;
      default:
        return true;
    }
  }

  private async findMatchingRules(event: CellChangeEvent) {
    const rules = await this.prisma.eventRule.findMany({
      where: {
        spreadsheetId: event.spreadsheetId,
        active: true,
        OR: [
          { targetType: TargetType.SPREADSHEET },
          { targetType: TargetType.SHEET, sheetId: event.sheetId },
          { targetType: TargetType.RANGE },
          { targetType: TargetType.CELL },
          { targetType: TargetType.CELL_GROUP },
        ],
      },
      include: { webhook: true, flow: true },
    });

    // Filter by cell range/coordinates
    return rules.filter(rule => {
      if (rule.targetType === TargetType.SPREADSHEET || rule.targetType === TargetType.SHEET) {
        return true;
      }

      if (rule.targetType === TargetType.RANGE && rule.cellRange) {
        return this.isInRange(event.row, event.col, rule.cellRange);
      }

      if (rule.targetType === TargetType.CELL || rule.targetType === TargetType.CELL_GROUP) {
        const coords = rule.cellCoordinates as { row: number; col: number }[] | null;
        return coords?.some(c => c.row === event.row && c.col === event.col);
      }

      return false;
    });
  }

  private isInRange(row: number, col: number, range: string): boolean {
    // Parse range like "A1:B10"
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return false;

    const startCol = this.letterToCol(match[1]);
    const startRow = parseInt(match[2]) - 1;
    const endCol = this.letterToCol(match[3]);
    const endRow = parseInt(match[4]) - 1;

    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }

  // =====================================================
  // Batch Mode Handling
  // =====================================================

  private addToBatch(ruleId: string, event: CellChangeEvent, windowMs: number): void {
    const existing = this.batchBuffer.get(ruleId);

    if (existing) {
      existing.events.push(event);
    } else {
      const timeout = setTimeout(() => this.flushBatch(ruleId), windowMs);
      this.batchBuffer.set(ruleId, { events: [event], timeout });
    }
  }

  private async flushBatch(ruleId: string): Promise<void> {
    const batch = this.batchBuffer.get(ruleId);
    if (!batch) return;

    this.batchBuffer.delete(ruleId);

    const rule = await this.prisma.eventRule.findUnique({
      where: { id: ruleId },
      include: { webhook: true, flow: true },
    });

    if (rule) {
      const transactionId = crypto.randomUUID();
      await this.triggerActions(rule, batch.events, transactionId);
    }
  }

  // =====================================================
  // Action Triggering
  // =====================================================

  private async triggerActions(rule: any, eventData: CellChangeEvent | CellChangeEvent[], transactionId: string): Promise<void> {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const payload: EventPayload[] = events.map(event => ({
      transactionId,
      eventType: events.length > 1 ? EventType.MULTI_CELL_CHANGE : EventType.CELL_CHANGE,
      spreadsheetId: event.spreadsheetId,
      sheetId: event.sheetId,
      cellCoordinate: this.toCellRef(event.row, event.col),
      previousValue: event.previousValue,
      newValue: event.newValue,
      changedBy: event.changedBy,
      changeMethod: event.changeMethod,
      timestamp: new Date().toISOString(),
    }));

    // Trigger webhook
    if (rule.webhook) {
      await this.triggerWebhook(rule.webhook, payload, transactionId);
    }

    // Trigger flow
    if (rule.flow) {
      await this.triggerFlow(rule.flow, payload, transactionId);
    }
  }

  private async triggerWebhook(webhook: any, payload: EventPayload[], transactionId: string): Promise<void> {
    // This will be implemented in WebhooksService
    this.logger.log(`Triggering webhook ${webhook.id} for transaction ${transactionId}`);
  }

  private async triggerFlow(flow: any, payload: EventPayload[], transactionId: string): Promise<void> {
    // This will be implemented in FlowEngineService
    this.logger.log(`Triggering flow ${flow.id} for transaction ${transactionId}`);
  }

  // =====================================================
  // Event Logging
  // =====================================================

  private async logEvent(
    eventRuleId: string,
    event: CellChangeEvent,
    transactionId: string,
    cellCoordinate: string,
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        eventRuleId,
        spreadsheetId: event.spreadsheetId,
        sheetId: event.sheetId,
        eventType: EventType.CELL_CHANGE,
        cellCoordinate,
        previousValue: event.previousValue,
        newValue: event.newValue,
        changedBy: event.changedBy,
        changeMethod: event.changeMethod,
        transactionId,
      },
    });
  }

  async getEventLogs(userId: string, spreadsheetId: string, limit = 100) {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
    });

    if (!spreadsheet || spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.eventLog.findMany({
      where: { spreadsheetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  private toCellRef(row: number, col: number): string {
    return `${this.colToLetter(col)}${row + 1}`;
  }

  private colToLetter(col: number): string {
    let result = '';
    let num = col + 1;
    while (num > 0) {
      const remainder = (num - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      num = Math.floor((num - 1) / 26);
    }
    return result;
  }

  private letterToCol(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
  }
}
