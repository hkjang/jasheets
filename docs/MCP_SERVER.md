# JaSheets MCP Server

JaSheets exposes a remote, stateless MCP Streamable HTTP endpoint at
`POST /api/mcp`. It runs in the same API process and Docker image as JaSheets;
no additional service or port is required.

## Security model

- Every request requires `Authorization: Bearer <JaSheets access token>`.
- The token user is the command actor. Spreadsheet owner/share permissions are
  checked for every query and mutation.
- MCP adapters cannot access Prisma. Mutations are dispatched through the same
  `SpreadsheetCommandService` used by the REST spreadsheet controller.
- Cell writes require an idempotency key and optionally accept the sheet's
  expected version for optimistic concurrency control.
- Range reads are limited to 10,000 cells and cell writes to 1,000 cells per
  call.

Do not put access tokens in a URL. Configure them as an HTTP `Authorization`
header in the MCP client or its secret store. In production, expose the
endpoint only through TLS-enabled Ingress.

## Available tools

| Tool | Purpose | Mutation |
| --- | --- | --- |
| `list_workbooks` | List workbooks visible to the user | No |
| `list_spreadsheets` | Compatibility alias for `list_workbooks` | No |
| `get_spreadsheet` | Read workbook and sheet metadata | No |
| `get_sheet_schema` | Infer headers, column types and formula presence from a bounded sample | No |
| `read_range` | Read a selected, bounded zero-based rectangular range | No |
| `get_range` | Compatibility alias for `read_range` | No |
| `set_cells` | Write values, formulas, or formats | Yes |
| `write_range` | Write a rectangular 2D value/formula matrix | Yes |
| `insert_row` | Insert one row at a zero-based index | Yes |
| `delete_row` | Delete one row at a zero-based index | Yes |

All mutation tools enter the shared command boundary. Agents never receive a
database connection and must not generate SQL for spreadsheet changes.

## Client connection

Use these connection values in Claude Code, Qwen Code, OpenCode, or another
MCP-compatible agent platform:

```text
Transport: Streamable HTTP
URL: https://sheets.example.com/api/mcp
Header: Authorization: Bearer <access-token>
```

The Ingress should route `/api` to container port `4000` and `/` to container
port `3000`, as described in [OFFLINE_DEPLOYMENT.md](./OFFLINE_DEPLOYMENT.md).

## Example mutation

`set_cells` uses zero-based row/column coordinates:

```json
{
  "sheetId": "550e8400-e29b-41d4-a716-446655440000",
  "updates": [
    { "row": 0, "col": 0, "value": "Revenue" },
    { "row": 1, "col": 0, "formula": "=SUM(B2:B10)" }
  ],
  "expectedVersion": 12,
  "idempotencyKey": "agent-run-20260723-001"
}
```

If another editor changes the sheet first, JaSheets returns a version conflict.
Read the current workbook/range and retry with a new idempotency key after
reconciling the change.
