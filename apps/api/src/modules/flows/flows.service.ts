import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import type { FlowNode, FlowEdge, NodeExecutionContext } from './dto/flow.dto';
import { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

// Re-export for backwards compatibility
export type { FlowNode, FlowEdge, NodeExecutionContext } from './dto/flow.dto';
export { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

// =====================================================
// Flow CRUD Service
// =====================================================

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(private readonly prisma: PrismaService) { }

  // =====================================================
  // Permission Check Helper
  // =====================================================

  private async checkSpreadsheetAccess(userId: string, spreadsheetId: string): Promise<boolean> {
    this.logger.log(`Checking access for userId: ${userId}, spreadsheetId: ${spreadsheetId}`);

    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: { permissions: true },
    });

    if (!spreadsheet) {
      this.logger.warn(`Spreadsheet not found: ${spreadsheetId}`);
      throw new NotFoundException('Spreadsheet not found');
    }

    this.logger.log(`Spreadsheet owner: ${spreadsheet.ownerId}, Current user: ${userId}`);

    if (spreadsheet.ownerId === userId) {
      this.logger.log('User is owner, access granted');
      return true;
    }

    const hasPermission = spreadsheet.permissions.some(
      (p) => p.userId === userId && p.role !== 'VIEWER'
    );

    this.logger.log(`Permissions check: ${hasPermission}, Permissions count: ${spreadsheet.permissions.length}`);

    return hasPermission;
  }

  async createFlow(userId: string, dto: CreateFlowDto) {
    const hasAccess = await this.checkSpreadsheetAccess(userId, dto.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const flow = await this.prisma.flow.create({
      data: {
        spreadsheetId: dto.spreadsheetId,
        name: dto.name,
        description: dto.description,
        nodes: (dto.nodes || []) as any,
        edges: (dto.edges || []) as any,
        createdById: userId,
      },
    });

    // Create initial version
    await this.createFlowVersion(flow.id, userId);

    // Auto-create Event Rule based on trigger node configuration
    await this.syncEventRuleFromFlow(flow.id, dto.spreadsheetId, dto.nodes || []);

    return flow;
  }

  async updateFlow(userId: string, flowId: string, dto: UpdateFlowDto) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, flow.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.flow.update({
      where: { id: flowId },
      data: {
        name: dto.name,
        description: dto.description,
        nodes: dto.nodes as any,
        edges: dto.edges as any,
        active: dto.active,
        version: { increment: 1 },
      },
    });

    // Save new version
    if (dto.nodes || dto.edges) {
      await this.createFlowVersion(flowId, userId);
    }

    // Sync Event Rule when nodes are updated
    if (dto.nodes) {
      await this.syncEventRuleFromFlow(flowId, flow.spreadsheetId, dto.nodes);
    }

    return updated;
  }

  async deleteFlow(userId: string, flowId: string): Promise<void> {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, flow.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.flow.delete({ where: { id: flowId } });
  }

  async getFlow(userId: string, flowId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true, eventRules: true },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }

    const hasAccess = await this.checkSpreadsheetAccess(userId, flow.spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return flow;
  }

  async listFlows(userId: string, spreadsheetId: string) {
    const hasAccess = await this.checkSpreadsheetAccess(userId, spreadsheetId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.flow.findMany({
      where: { spreadsheetId },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // =====================================================
  // Version Management
  // =====================================================

  private async createFlowVersion(flowId: string, userId: string): Promise<void> {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
    });

    if (!flow) return;

    await this.prisma.flowVersion.create({
      data: {
        flowId,
        version: flow.version,
        nodes: flow.nodes as any,
        edges: flow.edges as any,
        snapshot: flow as any,
        createdById: userId,
      },
    });
  }

  async listFlowVersions(userId: string, flowId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true },
    });

    if (!flow || flow.spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.flowVersion.findMany({
      where: { flowId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        createdById: true,
      },
    });
  }

  async rollbackToVersion(userId: string, flowId: string, versionId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true },
    });

    if (!flow || flow.spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const version = await this.prisma.flowVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.flowId !== flowId) {
      throw new NotFoundException('Version not found');
    }

    return this.prisma.flow.update({
      where: { id: flowId },
      data: {
        nodes: version.nodes as any,
        edges: version.edges as any,
        version: { increment: 1 },
      },
    });
  }

  // =====================================================
  // Execution Logs
  // =====================================================

  async getFlowExecutions(userId: string, flowId: string, limit = 50) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { spreadsheet: true },
    });

    if (!flow || flow.spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.flowExecution.findMany({
      where: { flowId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        nodeExecutions: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  async getFlowExecution(userId: string, executionId: string) {
    const execution = await this.prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: {
        flow: { include: { spreadsheet: true } },
        nodeExecutions: { orderBy: { startedAt: 'asc' } },
      },
    });

    if (!execution || execution.flow.spreadsheet.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return execution;
  }

  // =====================================================
  // Event Rule Synchronization
  // =====================================================

  /**
   * Sync Event Rule based on trigger node configuration in the flow.
   * This ensures that cell changes matching the trigger's cellRange will execute the flow.
   */
  private async syncEventRuleFromFlow(flowId: string, spreadsheetId: string, nodes: FlowNode[]): Promise<void> {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      this.logger.log(`No trigger node found in flow ${flowId}, skipping event rule sync`);
      return;
    }

    const { cellRange, eventType } = triggerNode.data || {};

    // Map flow trigger eventType to Prisma EventType enum
    const eventTypeMap: Record<string, string> = {
      'cell_change': 'CELL_CHANGE',
      'row_insert': 'ROW_INSERT',
      'row_delete': 'ROW_DELETE',
    };

    const prismaEventType = eventTypeMap[eventType] || 'CELL_CHANGE';

    // Determine target type based on cellRange
    let targetType: 'SPREADSHEET' | 'SHEET' | 'RANGE' = 'SPREADSHEET';
    if (cellRange && cellRange.trim()) {
      targetType = 'RANGE';
    }

    try {
      // Check if an event rule already exists for this flow
      const existingRule = await this.prisma.eventRule.findFirst({
        where: { flowId },
      });

      if (existingRule) {
        // Update existing rule
        await this.prisma.eventRule.update({
          where: { id: existingRule.id },
          data: {
            cellRange: cellRange || null,
            eventTypes: [prismaEventType] as any,
            targetType,
            version: { increment: 1 },
          },
        });
        this.logger.log(`Updated event rule ${existingRule.id} for flow ${flowId}`);
      } else {
        // Create new rule
        const flow = await this.prisma.flow.findUnique({ where: { id: flowId } });
        const ruleName = flow ? `Auto: ${flow.name}` : `Auto: Flow ${flowId}`;

        await this.prisma.eventRule.create({
          data: {
            spreadsheetId,
            name: ruleName,
            description: 'Auto-generated event rule for flow trigger',
            targetType,
            cellRange: cellRange || null,
            eventTypes: [prismaEventType] as any,
            flowId,
            active: true,
          },
        });
        this.logger.log(`Created event rule for flow ${flowId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync event rule for flow ${flowId}:`, error);
      // Don't throw - this is a non-critical operation
    }
  }
}
