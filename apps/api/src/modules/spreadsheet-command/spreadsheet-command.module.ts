import { Module } from '@nestjs/common';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [SheetsModule],
  exports: [SheetsModule],
})
export class SpreadsheetCommandModule {}
