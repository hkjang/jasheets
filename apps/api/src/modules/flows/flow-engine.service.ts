import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionStatus } from '@prisma/client';
import { FlowNode, FlowEdge, NodeExecutionContext } from './flows.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import * as crypto from 'crypto';

// =====================================================
// Flow Engine Service - Node-RED style execution
// =====================================================

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
  ) {}

  // =====================================================
  // Flow Execution
  // =====================================================

  async executeFlow(flowId: string, triggerData: any): Promise<string> {
    const transactionId = crypto.randomUUID();

    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
    });

    if (!flow || !flow.active) {
      this.logger.warn(`Flow ${flowId} not found or inactive`);
      return transactionId;
    }

    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];

    // Create flow execution record
    const execution = await this.prisma.flowExecution.create({
      data: {
        flowId,
        transactionId,
        status: ExecutionStatus.RUNNING,
        triggerData,
      },
    });

    // Execute flow asynchronously
    this.runFlow(execution.id, nodes, edges, triggerData, transactionId)
      .catch(error => {
        this.logger.error(`Flow execution ${execution.id} failed:`, error);
      });

    return transactionId;
  }

  private async runFlow(
    executionId: string,
    nodes: FlowNode[],
    edges: FlowEdge[],
    triggerData: any,
    transactionId: string,
  ): Promise<void> {
    const context: NodeExecutionContext = {
      transactionId,
      flowExecutionId: executionId,
      inputData: triggerData,
      variables: new Map(),
    };

    try {
      // Find trigger node (entry point)
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (!triggerNode) {
        throw new Error('No trigger node found in flow');
      }

      // Build adjacency list for traversal
      const adjacencyList = this.buildAdjacencyList(edges);

      // Execute starting from trigger node using BFS
      await this.executeNode(triggerNode, context, nodes, adjacencyList);

      // Mark execution as completed
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Flow execution ${executionId} completed successfully`);
    } catch (error: any) {
      // Mark execution as failed
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          error: error.message,
        },
      });

      this.logger.error(`Flow execution ${executionId} failed: ${error.message}`);
    }
  }

  private buildAdjacencyList(edges: FlowEdge[]): Map<string, { targetId: string; condition?: string }[]> {
    const adjacencyList = new Map<string, { targetId: string; condition?: string }[]>();

    for (const edge of edges) {
      const existing = adjacencyList.get(edge.source) || [];
      existing.push({ targetId: edge.target, condition: edge.condition });
      adjacencyList.set(edge.source, existing);
    }

    return adjacencyList;
  }

  // =====================================================
  // Node Execution
  // =====================================================

  private async executeNode(
    node: FlowNode,
    context: NodeExecutionContext,
    allNodes: FlowNode[],
    adjacencyList: Map<string, { targetId: string; condition?: string }[]>,
  ): Promise<any> {
    // Log node execution start
    const nodeExecution = await this.prisma.nodeExecution.create({
      data: {
        flowExecutionId: context.flowExecutionId,
        nodeId: node.id,
        nodeType: node.type,
        inputData: context.inputData,
        status: ExecutionStatus.RUNNING,
      },
    });

    try {
      let outputData: any;

      // Execute based on node type
      switch (node.type) {
        case 'trigger':
          outputData = await this.executeTriggerNode(node, context);
          break;
        case 'condition':
          outputData = await this.executeConditionNode(node, context);
          break;
        case 'transform':
          outputData = await this.executeTransformNode(node, context);
          break;
        case 'http_request':
          outputData = await this.executeHttpRequestNode(node, context);
          break;
        case 'notification':
          outputData = await this.executeNotificationNode(node, context);
          break;
        case 'db_write':
          outputData = await this.executeDbWriteNode(node, context);
          break;
        case 'end':
          outputData = { finished: true, data: context.inputData };
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Log node execution success
      await this.prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          outputData,
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Find and execute next nodes
      const nextConnections = adjacencyList.get(node.id) || [];

      for (const connection of nextConnections) {
        // Check edge condition if exists
        if (connection.condition && !this.evaluateCondition(connection.condition, outputData)) {
          continue;
        }

        const nextNode = allNodes.find(n => n.id === connection.targetId);
        if (nextNode) {
          // Pass output as input to next node
          const nextContext: NodeExecutionContext = {
            ...context,
            inputData: outputData,
          };
          await this.executeNode(nextNode, nextContext, allNodes, adjacencyList);
        }
      }

      return outputData;
    } catch (error: any) {
      // Log node execution failure
      await this.prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          error: error.message,
        },
      });

      throw error;
    }
  }

  // =====================================================
  // Node Type Handlers
  // =====================================================

  private async executeTriggerNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    // Trigger node simply passes through the trigger data
    return context.inputData;
  }

  private async executeConditionNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    const { operator, field, value } = node.data;
    const inputValue = field ? this.getNestedValue(context.inputData, field) : context.inputData;

    let result = false;

    switch (operator) {
      case 'equals':
        result = inputValue === value;
        break;
      case 'not_equals':
        result = inputValue !== value;
        break;
      case 'contains':
        result = String(inputValue).includes(String(value));
        break;
      case 'greater_than':
        result = Number(inputValue) > Number(value);
        break;
      case 'less_than':
        result = Number(inputValue) < Number(value);
        break;
      case 'is_empty':
        result = !inputValue || inputValue === '' || inputValue === null;
        break;
      case 'is_not_empty':
        result = !!inputValue && inputValue !== '' && inputValue !== null;
        break;
      default:
        result = true;
    }

    return {
      ...context.inputData,
      __conditionResult: result,
    };
  }

  private async executeTransformNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    const { transformType, mapping, expression } = node.data;

    switch (transformType) {
      case 'map':
        // Apply field mapping
        const mappedResult: Record<string, any> = {};
        for (const [targetField, sourceField] of Object.entries(mapping || {})) {
          mappedResult[targetField] = this.getNestedValue(context.inputData, sourceField as string);
        }
        return mappedResult;

      case 'filter':
        // Filter array data
        if (Array.isArray(context.inputData)) {
          return context.inputData.filter(item => this.evaluateCondition(expression, item));
        }
        return context.inputData;

      case 'extract':
        // Extract specific field
        return this.getNestedValue(context.inputData, node.data.field);

      default:
        return context.inputData;
    }
  }

  private async executeHttpRequestNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    const { url, method, headers, body, bodyTemplate } = node.data;

    // Template substitution for URL and body
    const finalUrl = this.templateString(url, context.inputData);
    const finalBody = bodyTemplate 
      ? this.templateString(bodyTemplate, context.inputData)
      : body || context.inputData;

    try {
      const response = await fetch(finalUrl, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify(finalBody) : undefined,
      });

      const responseData = await response.text();
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(responseData);
      } catch {
        parsedResponse = responseData;
      }

      return {
        statusCode: response.status,
        success: response.ok,
        data: parsedResponse,
      };
    } catch (error: any) {
      return {
        statusCode: 0,
        success: false,
        error: error.message,
      };
    }
  }

  private async executeNotificationNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    const { channel, recipient, subject, message, messageTemplate } = node.data;

    const finalMessage = messageTemplate
      ? this.templateString(messageTemplate, context.inputData)
      : message;

    switch (channel) {
      case 'email':
        // TODO: Integrate with email service (SendGrid, etc.)
        this.logger.log(`[MOCK] Sending email to ${recipient}: ${subject}`);
        return { sent: true, channel: 'email', recipient };

      case 'slack':
        // TODO: Integrate with Slack API
        this.logger.log(`[MOCK] Sending Slack message to ${recipient}: ${finalMessage}`);
        return { sent: true, channel: 'slack', recipient };

      case 'webhook':
        // Use existing webhook functionality
        await this.webhooksService.triggerWebhooksForSpreadsheet(
          context.inputData.spreadsheetId,
          context.transactionId,
          context.inputData,
          'notification',
        );
        return { sent: true, channel: 'webhook' };

      default:
        return { sent: false, error: `Unknown channel: ${channel}` };
    }
  }

  private async executeDbWriteNode(node: FlowNode, context: NodeExecutionContext): Promise<any> {
    const { table, operation, data, where } = node.data;

    // For now, only support Cell updates
    if (table === 'cell') {
      const { sheetId, row, col, value } = data || context.inputData;

      if (operation === 'update' || operation === 'upsert') {
        await this.prisma.cell.upsert({
          where: { sheetId_row_col: { sheetId, row, col } },
          update: { value },
          create: { sheetId, row, col, value },
        });

        return { success: true, operation, table, sheetId, row, col };
      }
    }

    return { success: false, error: 'Unsupported DB operation' };
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(condition: string, data: any): boolean {
    try {
      // Simple condition evaluation (in production, use a safer expression evaluator)
      const conditionResult = data?.__conditionResult;
      if (typeof conditionResult === 'boolean') {
        return conditionResult;
      }

      // Check if condition matches "true" or "yes"
      return condition === 'true' || condition === 'yes';
    } catch {
      return false;
    }
  }

  private templateString(template: string, data: any): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : '';
    });
  }
}
