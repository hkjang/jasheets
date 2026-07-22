import { Injectable } from '@nestjs/common';
import { SheetsService } from '../sheets/sheets.service';

@Injectable()
export class McpQueryService {
  constructor(private readonly sheetsService: SheetsService) {}

  listSpreadsheets(userId: string, search?: string) {
    return this.sheetsService.findAll(userId, undefined, search);
  }

  async getSpreadsheet(userId: string, spreadsheetId: string) {
    const workbook = await this.sheetsService.findOne(userId, spreadsheetId);
    return {
      id: workbook.id,
      name: workbook.name,
      owner: workbook.owner,
      sheets: workbook.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        index: sheet.index,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
        version: sheet.version,
      })),
    };
  }

  getSheetSchema(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    headerRow?: number,
    sampleRows?: number,
  ) {
    return this.sheetsService.describeSheetSchema(
      userId,
      spreadsheetId,
      sheetId,
      headerRow,
      sampleRows,
    );
  }

  getRange(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) {
    return this.sheetsService.readSheetRange(
      userId,
      spreadsheetId,
      sheetId,
      startRow,
      startCol,
      endRow,
      endCol,
    );
  }
}
