import { forwardRef, Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { SheetsController } from './sheets.controller';
import { EventsModule } from '../events/events.module';
import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';
import { RevisionLogsModule } from '../revision-logs/revision-logs.module';

@Module({
  imports: [EventsModule, forwardRef(() => RevisionLogsModule)],
  controllers: [SheetsController],
  providers: [SheetsService, SpreadsheetCommandService],
  exports: [SheetsService, SpreadsheetCommandService],
})
export class SheetsModule {}
