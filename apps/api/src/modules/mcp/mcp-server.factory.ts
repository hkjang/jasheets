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
