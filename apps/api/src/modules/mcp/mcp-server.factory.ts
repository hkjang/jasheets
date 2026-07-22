import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';
import { McpQueryService } from './mcp-query.service';

const jsonResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: Array.isArray(value)
    ? { items: value }
    : typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : { value },
});

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly commands: SpreadsheetCommandService,
    private readonly queries: McpQueryService,
  ) {}

  create(userId: string) {
    const server = new McpServer({ name: 'jasheets', version: '0.1.1' });

    const registerWorkbookListTool = (
      name: 'list_workbooks' | 'list_spreadsheets',
      description: string,
    ) =>
      server.registerTool(
        name,
        {
          description,
          inputSchema: { search: z.string().max(200).optional() },
          annotations: { readOnlyHint: true, idempotentHint: true },
        },
        async ({ search }) =>
          jsonResult(await this.queries.listSpreadsheets(userId, search)),
      );

    registerWorkbookListTool(
      'list_workbooks',
      'List workbooks accessible to the authenticated user.',
    );
    registerWorkbookListTool(
      'list_spreadsheets',
      'Compatibility alias for list_workbooks.',
    );

    server.registerTool(
      'get_spreadsheet',
      {
        description:
          'Get workbook and sheet metadata without loading every cell.',
        inputSchema: { spreadsheetId: z.string().uuid() },
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ spreadsheetId }) =>
        jsonResult(await this.queries.getSpreadsheet(userId, spreadsheetId)),
    );

    server.registerTool(
      'get_sheet_schema',
      {
        description:
          'Inspect an accessible sheet schema using a bounded sample: dimensions, version, headers, inferred column types and formula presence.',
        inputSchema: {
          spreadsheetId: z.string().uuid(),
          sheetId: z.string().uuid(),
          headerRow: z.number().int().min(0).optional().default(0),
          sampleRows: z.number().int().min(1).max(1000).optional().default(100),
        },
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ spreadsheetId, sheetId, headerRow, sampleRows }) =>
        jsonResult(
          await this.queries.getSheetSchema(
            userId,
            spreadsheetId,
            sheetId,
            headerRow,
            sampleRows,
          ),
        ),
    );

    const registerRangeReadTool = (
      name: 'read_range' | 'get_range',
      description: string,
    ) =>
      server.registerTool(
        name,
        {
          description,
          inputSchema: {
            spreadsheetId: z.string().uuid(),
            sheetId: z.string().uuid(),
            startRow: z.number().int().min(0),
            startCol: z.number().int().min(0),
            endRow: z.number().int().min(0),
            endCol: z.number().int().min(0),
          },
          annotations: { readOnlyHint: true, idempotentHint: true },
        },
        async (input) =>
          jsonResult(
            await this.queries.getRange(
              userId,
              input.spreadsheetId,
              input.sheetId,
              input.startRow,
              input.startCol,
              input.endRow,
              input.endCol,
            ),
          ),
      );

    registerRangeReadTool(
      'read_range',
      'Read a bounded rectangular zero-based cell range. Empty cells are omitted.',
    );
    registerRangeReadTool('get_range', 'Compatibility alias for read_range.');

    server.registerTool(
      'analyze_range',
      {
        description:
          'Analyze a selected range for column types, missing values, distinct counts, formulas, errors and numeric statistics.',
        inputSchema: {
          spreadsheetId: z.string().uuid(),
          sheetId: z.string().uuid(),
          startRow: z.number().int().min(0),
          startCol: z.number().int().min(0),
          endRow: z.number().int().min(0),
          endCol: z.number().int().min(0),
          hasHeader: z.boolean().optional().default(true),
        },
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.queries.analyzeRange(
            userId,
            input.spreadsheetId,
            input.sheetId,
            input.startRow,
            input.startCol,
            input.endRow,
            input.endCol,
            input.hasHeader,
          ),
        ),
    );

    server.registerTool(
      'preview_changes',
      {
        description:
          'Preview cell mutations without writing: before/after values, no-ops, version conflicts and a deterministic preview hash.',
        inputSchema: {
          sheetId: z.string().uuid(),
          updates: z
            .array(
              z.object({
                row: z.number().int().min(0),
                col: z.number().int().min(0),
                value: z.unknown().optional(),
                formula: z.string().nullable().optional(),
                format: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(1000),
          expectedVersion: z.number().int().min(0).optional(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ sheetId, updates, expectedVersion }) =>
        jsonResult(
          await this.queries.previewChanges(
            userId,
            sheetId,
            updates,
            expectedVersion,
          ),
        ),
    );

    server.registerTool(
      'get_revision_history',
      {
        description:
          'Get a newest-first, cursor-paginated sheet revision history. Change payloads are omitted unless explicitly requested.',
        inputSchema: {
          sheetId: z.string().uuid(),
          limit: z.number().int().min(1).max(100).optional().default(50),
          cursor: z.string().uuid().optional(),
          action: z.string().min(1).max(64).optional(),
          includeChanges: z.boolean().optional().default(false),
        },
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async ({ sheetId, limit, cursor, action, includeChanges }) =>
        jsonResult(
          await this.queries.getRevisionHistory(userId, sheetId, {
            limit,
            cursor,
            action,
            includeChanges,
          }),
        ),
    );

    server.registerTool(
      'rollback_revision',
      {
        description:
          'Safely undo one cell revision through the shared command boundary. Refuses to overwrite cells changed after that revision.',
        inputSchema: {
          revisionId: z.string().uuid(),
          expectedVersion: z.number().int().min(0),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'ROLLBACK_REVISION', ...input },
          ),
        ),
    );

    server.registerTool(
      'set_cells',
      {
        description:
          'Set values, formulas or formats through the shared SpreadsheetCommand boundary.',
        inputSchema: {
          sheetId: z.string().uuid(),
          updates: z
            .array(
              z.object({
                row: z.number().int().min(0),
                col: z.number().int().min(0),
                value: z.unknown().optional(),
                formula: z.string().nullable().optional(),
                format: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(1000),
          expectedVersion: z.number().int().min(0).optional(),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'SET_CELLS', ...input },
          ),
        ),
    );

    server.registerTool(
      'execute_change_set',
      {
        description:
          'Apply a previously previewed cell change set only if its sheet version and deterministic preview hash still match.',
        inputSchema: {
          sheetId: z.string().uuid(),
          updates: z
            .array(
              z.object({
                row: z.number().int().min(0),
                col: z.number().int().min(0),
                value: z.unknown().optional(),
                formula: z.string().nullable().optional(),
                format: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(1000),
          expectedVersion: z.number().int().min(0),
          previewHash: z.string().regex(/^[a-f0-9]{64}$/),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'EXECUTE_CHANGE_SET', ...input },
          ),
        ),
    );

    server.registerTool(
      'write_range',
      {
        description:
          'Write a rectangular two-dimensional value matrix to a selected range through the shared SpreadsheetCommand boundary.',
        inputSchema: {
          sheetId: z.string().uuid(),
          startRow: z.number().int().min(0),
          startCol: z.number().int().min(0),
          values: z
            .array(z.array(z.unknown()).min(1).max(1000))
            .min(1)
            .max(1000),
          formulas: z
            .array(z.array(z.string().nullable()).min(1).max(1000))
            .min(1)
            .max(1000)
            .optional(),
          expectedVersion: z.number().int().min(0).optional(),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'WRITE_RANGE', ...input },
          ),
        ),
    );

    server.registerTool(
      'append_rows',
      {
        description:
          'Append rectangular rows after the last non-empty row through the shared SpreadsheetCommand boundary.',
        inputSchema: {
          sheetId: z.string().uuid(),
          startCol: z.number().int().min(0).optional().default(0),
          values: z
            .array(z.array(z.unknown()).min(1).max(1000))
            .min(1)
            .max(1000),
          formulas: z
            .array(z.array(z.string().nullable()).min(1).max(1000))
            .min(1)
            .max(1000)
            .optional(),
          expectedVersion: z.number().int().min(0).optional(),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'APPEND_ROWS', ...input },
          ),
        ),
    );

    server.registerTool(
      'apply_formula',
      {
        description:
          'Fill a selected range from a top-left formula, shifting relative A1 references while preserving absolute references.',
        inputSchema: {
          sheetId: z.string().uuid(),
          startRow: z.number().int().min(0),
          startCol: z.number().int().min(0),
          endRow: z.number().int().min(0),
          endCol: z.number().int().min(0),
          formula: z.string().min(2).max(8192).startsWith('='),
          expectedVersion: z.number().int().min(0).optional(),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            { type: 'APPLY_FORMULA', ...input },
          ),
        ),
    );

    server.registerTool(
      'create_pivot',
      {
        description:
          'Create an idempotent pivot table definition from a validated source range and target cell.',
        inputSchema: {
          sheetId: z.string().uuid(),
          name: z.string().min(1).max(200).optional(),
          sourceRange: z.object({
            startRow: z.number().int().min(0).max(999999),
            startCol: z.number().int().min(0).max(18277),
            endRow: z.number().int().min(0).max(999999),
            endCol: z.number().int().min(0).max(18277),
          }),
          targetCell: z.string().regex(/^\$?[A-Z]+\$?[1-9][0-9]*$/i),
          rows: z.array(z.string().min(1).max(256)).max(50).default([]),
          columns: z.array(z.string().min(1).max(256)).max(50).default([]),
          values: z
            .array(
              z.object({
                field: z.string().min(1).max(256),
                aggregation: z.enum(['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX']),
              }),
            )
            .min(1)
            .max(50),
          filters: z
            .array(
              z.object({
                field: z.string().min(1).max(256),
                operator: z.enum([
                  'EQUALS',
                  'NOT_EQUALS',
                  'CONTAINS',
                  'NOT_CONTAINS',
                  'GREATER_THAN',
                  'GREATER_THAN_OR_EQUAL',
                  'LESS_THAN',
                  'LESS_THAN_OR_EQUAL',
                  'BETWEEN',
                  'IN',
                  'IS_BLANK',
                  'IS_NOT_BLANK',
                ]),
                value: z.unknown().optional(),
                values: z.array(z.unknown()).max(1000).optional(),
              }),
            )
            .max(50)
            .optional(),
          rowGrandTotals: z.boolean().optional().default(true),
          columnGrandTotals: z.boolean().optional().default(true),
          expectedVersion: z.number().int().min(0),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            {
              type: 'CREATE_PIVOT',
              sheetId: input.sheetId,
              pivot: {
                name: input.name,
                targetCell: input.targetCell,
                config: {
                  sourceRange: input.sourceRange,
                  rows: input.rows,
                  cols: input.columns,
                  values: input.values,
                  filters: input.filters,
                  rowGrandTotals: input.rowGrandTotals,
                  columnGrandTotals: input.columnGrandTotals,
                },
              },
              expectedVersion: input.expectedVersion,
              idempotencyKey: input.idempotencyKey,
            },
          ),
        ),
    );

    server.registerTool(
      'create_chart',
      {
        description:
          'Create an idempotent, range-linked chart without replacing existing charts.',
        inputSchema: {
          sheetId: z.string().uuid(),
          type: z.enum(['bar', 'line', 'pie', 'doughnut', 'area']),
          sourceRange: z.object({
            startRow: z.number().int().min(0).max(999999),
            startCol: z.number().int().min(0).max(18277),
            endRow: z.number().int().min(0).max(999999),
            endCol: z.number().int().min(0).max(18277),
          }),
          x: z.number().int().min(0).max(100000).optional().default(100),
          y: z.number().int().min(0).max(100000).optional().default(100),
          width: z.number().int().min(200).max(2000).optional().default(400),
          height: z.number().int().min(150).max(1200).optional().default(300),
          title: z.string().max(200).optional(),
          showLegend: z.boolean().optional().default(true),
          horizontal: z.boolean().optional().default(false),
          expectedVersion: z.number().int().min(0),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async (input) =>
        jsonResult(
          await this.commands.execute(
            { userId, actorType: 'MCP' },
            {
              type: 'CREATE_CHART',
              sheetId: input.sheetId,
              chart: {
                type: input.type,
                sourceRange: input.sourceRange,
                x: input.x,
                y: input.y,
                width: input.width,
                height: input.height,
                options: {
                  title: input.title,
                  showLegend: input.showLegend,
                  horizontal: input.horizontal,
                },
              },
              expectedVersion: input.expectedVersion,
              idempotencyKey: input.idempotencyKey,
            },
          ),
        ),
    );

    const registerStructureTool = (
      name: 'insert_row' | 'delete_row',
      operation: 'insert' | 'delete',
    ) =>
      server.registerTool(
        name,
        {
          description: `${operation === 'insert' ? 'Insert' : 'Delete'} one row through the shared SpreadsheetCommand boundary.`,
          inputSchema: {
            sheetId: z.string().uuid(),
            index: z.number().int().min(0).max(999_999),
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: operation === 'delete',
          },
        },
        async ({ sheetId, index }) =>
          jsonResult(
            await this.commands.execute(
              { userId, actorType: 'MCP' },
              {
                type: 'CHANGE_STRUCTURE',
                sheetId,
                axis: 'row',
                operation,
                index,
              },
            ),
          ),
      );

    registerStructureTool('insert_row', 'insert');
    registerStructureTool('delete_row', 'delete');
    return server;
  }
}
