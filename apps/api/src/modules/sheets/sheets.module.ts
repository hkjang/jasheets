import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { SheetsController } from './sheets.controller';
import { EventsModule } from '../events/events.module';
import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';

@Module({
  imports: [EventsModule],
  controllers: [SheetsController],
  providers: [SheetsService, SpreadsheetCommandService],
  exports: [SheetsService, SpreadsheetCommandService],
})
export class SheetsModule {}
