import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';
import { McpQueryService } from './mcp-query.service';
import { McpServerFactory } from './mcp-server.factory';

describe('McpServerFactory', () => {
  const commands = { execute: jest.fn() };
  const queries = {
    listSpreadsheets: jest.fn(),
    getSpreadsheet: jest.fn(),
    getSheetSchema: jest.fn(),
    getRange: jest.fn(),
    analyzeRange: jest.fn(),
    previewChanges: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('publishes spreadsheet tools and executes writes only through commands', async () => {
    commands.execute.mockResolvedValue({ version: 2, cells: [] });
    const factory = new McpServerFactory(
      commands as unknown as SpreadsheetCommandService,
      queries as unknown as McpQueryService,
    );
    const server = factory.create('user-1');
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'list_workbooks',
        'list_spreadsheets',
        'get_spreadsheet',
        'get_sheet_schema',
        'read_range',
        'get_range',
        'analyze_range',
        'preview_changes',
        'set_cells',
        'write_range',
        'append_rows',
        'apply_formula',
        'create_pivot',
        'create_chart',
        'insert_row',
        'delete_row',
      ]),
    );

    queries.listSpreadsheets.mockResolvedValue([{ id: 'workbook-1' }]);
    const workbooks = await client.callTool({
      name: 'list_workbooks',
      arguments: { search: 'budget' },
    });
    expect(workbooks.isError).not.toBe(true);
    expect(workbooks.structuredContent).toEqual({
      items: [{ id: 'workbook-1' }],
    });
    expect(queries.listSpreadsheets).toHaveBeenCalledWith('user-1', 'budget');

    queries.getSheetSchema.mockResolvedValue({
      sheetId: '550e8400-e29b-41d4-a716-446655440001',
      columns: [],
    });
    const schema = await client.callTool({
      name: 'get_sheet_schema',
      arguments: {
        spreadsheetId: '550e8400-e29b-41d4-a716-446655440000',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        sampleRows: 50,
      },
    });
    expect(schema.isError).not.toBe(true);
    expect(queries.getSheetSchema).toHaveBeenCalledWith(
      'user-1',
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      0,
      50,
    );

    queries.getRange.mockResolvedValue({
      sheetId: '550e8400-e29b-41d4-a716-446655440001',
      cells: [],
    });
    const range = await client.callTool({
      name: 'read_range',
      arguments: {
        spreadsheetId: '550e8400-e29b-41d4-a716-446655440000',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 2,
        startCol: 3,
        endRow: 4,
        endCol: 5,
      },
    });
    expect(range.isError).not.toBe(true);
    expect(queries.getRange).toHaveBeenCalledWith(
      'user-1',
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      2,
      3,
      4,
      5,
    );

    queries.analyzeRange.mockResolvedValue({
      sheetId: '550e8400-e29b-41d4-a716-446655440001',
      summary: { dataRows: 3, columns: 3 },
    });
    const analysis = await client.callTool({
      name: 'analyze_range',
      arguments: {
        spreadsheetId: '550e8400-e29b-41d4-a716-446655440000',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 0,
        startCol: 0,
        endRow: 3,
        endCol: 2,
      },
    });
    expect(analysis.isError).not.toBe(true);
    expect(queries.analyzeRange).toHaveBeenCalledWith(
      'user-1',
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      0,
      0,
      3,
      2,
      true,
    );

    queries.previewChanges.mockResolvedValue({
      sheetId: '550e8400-e29b-41d4-a716-446655440001',
      currentVersion: 7,
      previewHash: 'preview-hash',
      changes: [],
    });
    const preview = await client.callTool({
      name: 'preview_changes',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        updates: [{ row: 0, col: 0, value: 42 }],
        expectedVersion: 7,
      },
    });
    expect(preview.isError).not.toBe(true);
    expect(queries.previewChanges).toHaveBeenCalledWith(
      'user-1',
      '550e8400-e29b-41d4-a716-446655440001',
      [{ row: 0, col: 0, value: 42 }],
      7,
    );

    const result = await client.callTool({
      name: 'set_cells',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440000',
        updates: [{ row: 0, col: 0, value: 'hello' }],
        expectedVersion: 1,
        idempotencyKey: 'request-1',
      },
    });

    expect(result.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'SET_CELLS',
        sheetId: '550e8400-e29b-41d4-a716-446655440000',
        updates: [{ row: 0, col: 0, value: 'hello' }],
        expectedVersion: 1,
        idempotencyKey: 'request-1',
      },
    );

    commands.execute.mockResolvedValueOnce({
      version: 3,
      range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
    });
    const writtenRange = await client.callTool({
      name: 'write_range',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 0,
        startCol: 0,
        values: [
          ['Name', 'Score'],
          ['Ada', 10],
        ],
        expectedVersion: 2,
        idempotencyKey: 'range-request-1',
      },
    });
    expect(writtenRange.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenLastCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'WRITE_RANGE',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 0,
        startCol: 0,
        values: [
          ['Name', 'Score'],
          ['Ada', 10],
        ],
        expectedVersion: 2,
        idempotencyKey: 'range-request-1',
      },
    );

    commands.execute.mockResolvedValueOnce({
      version: 4,
      range: { startRow: 5, startCol: 0, endRow: 5, endCol: 1 },
    });
    const appendedRows = await client.callTool({
      name: 'append_rows',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        values: [['Grace', 20]],
        idempotencyKey: 'append-request-1',
      },
    });
    expect(appendedRows.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenLastCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'APPEND_ROWS',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startCol: 0,
        values: [['Grace', 20]],
        idempotencyKey: 'append-request-1',
      },
    );

    commands.execute.mockResolvedValueOnce({ version: 5, appliedCells: 4 });
    const formula = await client.callTool({
      name: 'apply_formula',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 1,
        startCol: 1,
        endRow: 2,
        endCol: 2,
        formula: '=A1*$A$10',
        expectedVersion: 4,
        idempotencyKey: 'formula-request-1',
      },
    });
    expect(formula.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenLastCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'APPLY_FORMULA',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        startRow: 1,
        startCol: 1,
        endRow: 2,
        endCol: 2,
        formula: '=A1*$A$10',
        expectedVersion: 4,
        idempotencyKey: 'formula-request-1',
      },
    );

    commands.execute.mockResolvedValueOnce({
      pivotTable: { id: 'pivot-1' },
      version: 6,
      replayed: false,
    });
    const pivot = await client.callTool({
      name: 'create_pivot',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Sales by region',
        sourceRange: { startRow: 0, startCol: 0, endRow: 20, endCol: 4 },
        targetCell: 'H1',
        rows: ['Region'],
        columns: [],
        values: [{ field: 'Revenue', aggregation: 'SUM' }],
        expectedVersion: 5,
        idempotencyKey: 'pivot-request-1',
      },
    });
    expect(pivot.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenLastCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'CREATE_PIVOT',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        pivot: {
          name: 'Sales by region',
          targetCell: 'H1',
          config: {
            sourceRange: {
              startRow: 0,
              startCol: 0,
              endRow: 20,
              endCol: 4,
            },
            rows: ['Region'],
            cols: [],
            values: [{ field: 'Revenue', aggregation: 'SUM' }],
            filters: undefined,
            rowGrandTotals: true,
            columnGrandTotals: true,
          },
        },
        expectedVersion: 5,
        idempotencyKey: 'pivot-request-1',
      },
    );

    commands.execute.mockResolvedValueOnce({
      chart: { id: 'chart-1' },
      version: 7,
      replayed: false,
    });
    const chart = await client.callTool({
      name: 'create_chart',
      arguments: {
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'line',
        sourceRange: { startRow: 0, startCol: 0, endRow: 20, endCol: 2 },
        title: 'Revenue trend',
        expectedVersion: 6,
        idempotencyKey: 'chart-request-1',
      },
    });
    expect(chart.isError).not.toBe(true);
    expect(commands.execute).toHaveBeenLastCalledWith(
      { userId: 'user-1', actorType: 'MCP' },
      {
        type: 'CREATE_CHART',
        sheetId: '550e8400-e29b-41d4-a716-446655440001',
        chart: {
          type: 'line',
          sourceRange: {
            startRow: 0,
            startCol: 0,
            endRow: 20,
            endCol: 2,
          },
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          options: {
            title: 'Revenue trend',
            showLegend: true,
            horizontal: false,
          },
        },
        expectedVersion: 6,
        idempotencyKey: 'chart-request-1',
      },
    );

    await client.close();
    await server.close();
  });
});
