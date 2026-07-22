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
    getRange: jest.fn(),
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
        'get_range',
        'set_cells',
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

    await client.close();
    await server.close();
  });
});
