import { Module } from '@nestjs/common';
import { SheetsModule } from '../sheets/sheets.module';
import { SpreadsheetCommandModule } from '../spreadsheet-command/spreadsheet-command.module';
import { McpController } from './mcp.controller';
import { McpQueryService } from './mcp-query.service';
import { McpServerFactory } from './mcp-server.factory';

@Module({
  imports: [SheetsModule, SpreadsheetCommandModule],
  controllers: [McpController],
  providers: [McpQueryService, McpServerFactory],
})
export class McpModule {}
