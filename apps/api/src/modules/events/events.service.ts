import { Injectable, NotFoundException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventRuleDto, UpdateEventRuleDto, FilterConditions } from './dto/event-rule.dto';
import { EventType, TargetType } from '@prisma/client';
import * as crypto from 'crypto';
import { FlowEngineService } from '../flows/flow-engine.service';

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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FlowEngineService))
    private readonly flowEngineService: FlowEngineService,
  ) { }

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

    this.logger.log(`[Trigger] Cell change detected: ${cellCoordinate} in sheet ${event.sheetId}`);
    this.logger.debug(`[Trigger] Event details: ${JSON.stringify({ ...event, transactionId })}`);

    // Find matching rules
    const rules = await this.findMatchingRules(event);
    this.logger.log(`[Trigger] Found ${rules.length} matching rule(s) for cell ${cellCoordinate}`);

    if (rules.length === 0) {
      this.logger.debug(`[Trigger] No rules matched for spreadsheet ${event.spreadsheetId}`);
      return;
    }

    for (const rule of rules) {
      this.logger.log(`[Trigger] Processing rule: ${rule.name} (${rule.id})`);

      // Apply filters
      if (!this.matchesFilter(event, rule.filterConditions as FilterConditions)) {
        this.logger.debug(`[Trigger] Rule ${rule.name} filtered out by conditions`);
        continue;
      }

      // Handle batch mode
      if (rule.batchMode && rule.batchWindow) {
        this.logger.debug(`[Trigger] Rule ${rule.name} added to batch queue`);
        this.addToBatch(rule.id, event, rule.batchWindow);
        continue;
      }

      // Log the event
      await this.logEvent(rule.id, event, transactionId, cellCoordinate);

      // Trigger webhook or flow
      this.logger.log(`[Trigger] Triggering actions for rule: ${rule.name}`);
      await this.triggerActions(rule, event, transactionId);
    }
  }

  async detectMultiCellChange(events: CellChangeEvent[]): Promise<void> {
    if (events.length === 0) return;

    const transactionId = crypto.randomUUID();
    const spreadsheetId = events[0].spreadsheetId;
    const sheetId = events[0].sheetId;

    this.logger.log(`[detectMultiCellChange] Processing ${events.length} cell change events as batch`);

    // Find all active rules for this spreadsheet (CELL_CHANGE or MULTI_CELL_CHANGE)
    const rules = await this.prisma.eventRule.findMany({
      where: {
        spreadsheetId,
        active: true,
        OR: [
          { targetType: TargetType.SPREADSHEET },
          { targetType: TargetType.SHEET, sheetId },
          { targetType: TargetType.RANGE },
          { targetType: TargetType.CELL },
          { targetType: TargetType.CELL_GROUP },
        ],
      },
      include: { webhook: true, flow: true },
    });

    this.logger.log(`[detectMultiCellChange] Found ${rules.length} candidate rules`);

    // Group matched events by rule
    for (const rule of rules) {
      // Check eventTypes - must include CELL_CHANGE or MULTI_CELL_CHANGE
      const hasMatchingEventType = rule.eventTypes.some(
        (et: string) => et === 'CELL_CHANGE' || et === 'MULTI_CELL_CHANGE'
      );
      if (!hasMatchingEventType) {
        this.logger.debug(`[detectMultiCellChange] Rule ${rule.name} skipped: no matching eventType`);
        continue;
      }

      // Filter events that match this rule's target
      const matchedEvents = events.filter(event => {
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

      if (matchedEvents.length === 0) {
        this.logger.debug(`[detectMultiCellChange] Rule ${rule.name}: no matching events`);
        continue;
      }

      this.logger.log(`[detectMultiCellChange] Rule ${rule.name}: ${matchedEvents.length} matched events`);

      // Log all events for this rule
      for (const event of matchedEvents) {
        const cellCoordinate = this.toCellRef(event.row, event.col);
        await this.logEvent(rule.id, event, transactionId, cellCoordinate);
      }

      // Trigger actions ONCE with all matched events as batch
      this.logger.log(`[detectMultiCellChange] Triggering batch action for rule: ${rule.name}`);
      await this.triggerActions(rule, matchedEvents, transactionId);
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
    this.logger.debug(`[findMatchingRules] Looking for rules: spreadsheetId=${event.spreadsheetId}, sheetId=${event.sheetId}, row=${event.row}, col=${event.col}`);

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

    this.logger.debug(`[findMatchingRules] Found ${rules.length} candidate rules before filtering`);

    // Filter by cell range/coordinates AND eventTypes
    const matchedRules = rules.filter(rule => {
      // Check eventTypes first - must include CELL_CHANGE or MULTI_CELL_CHANGE
      const hasMatchingEventType = rule.eventTypes.some(
        (et: string) => et === 'CELL_CHANGE' || et === 'MULTI_CELL_CHANGE'
      );
      if (!hasMatchingEventType) {
        this.logger.debug(`[findMatchingRules] Rule ${rule.name} filtered out: no matching eventType (has: ${rule.eventTypes.join(', ')})`);
        return false;
      }

      // Then filter by target
      if (rule.targetType === TargetType.SPREADSHEET || rule.targetType === TargetType.SHEET) {
        this.logger.debug(`[findMatchingRules] Rule ${rule.name} matched: targetType=${rule.targetType}`);
        return true;
      }

      if (rule.targetType === TargetType.RANGE && rule.cellRange) {
        const inRange = this.isInRange(event.row, event.col, rule.cellRange);
        this.logger.debug(`[findMatchingRules] Rule ${rule.name} range check: ${rule.cellRange}, inRange=${inRange}`);
        return inRange;
      }

      if (rule.targetType === TargetType.CELL || rule.targetType === TargetType.CELL_GROUP) {
        const coords = rule.cellCoordinates as { row: number; col: number }[] | null;
        const matched = coords?.some(c => c.row === event.row && c.col === event.col);
        this.logger.debug(`[findMatchingRules] Rule ${rule.name} cell check: matched=${matched}`);
        return matched;
      }

      return false;
    });

    this.logger.debug(`[findMatchingRules] Final matched rules count: ${matchedRules.length}`);
    return matchedRules;
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
    this.logger.log(`Triggering flow ${flow.id} for transaction ${transactionId}`);
    try {
      // Execute the flow with the event payload as trigger data
      await this.flowEngineService.executeFlow(flow.id, {
        transactionId,
        events: payload,
        triggeredAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to execute flow ${flow.id}:`, error);
    }
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
