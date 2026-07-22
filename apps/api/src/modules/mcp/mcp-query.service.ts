import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async getRange(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) {
    if (endRow < startRow || endCol < startCol) {
      throw new BadRequestException('Range end must not precede range start');
    }
    const cellCount = (endRow - startRow + 1) * (endCol - startCol + 1);
    if (cellCount > 10_000) {
      throw new BadRequestException(
        'MCP range reads are limited to 10,000 cells',
      );
    }

    const workbook = await this.sheetsService.findOne(userId, spreadsheetId);
    const sheet = workbook.sheets.find((candidate) => candidate.id === sheetId);
    if (!sheet) throw new NotFoundException('Sheet not found in spreadsheet');
    if (endRow >= sheet.rowCount || endCol >= sheet.colCount) {
      throw new BadRequestException('Range exceeds sheet bounds');
    }

    const cells = sheet.cells
      .filter(
        (cell) =>
          cell.row >= startRow &&
          cell.row <= endRow &&
          cell.col >= startCol &&
          cell.col <= endCol,
      )
      .map(({ row, col, value, formula, format }) => ({
        row,
        col,
        value,
        formula,
        format,
      }));

    return {
      spreadsheetId,
      sheetId,
      version: sheet.version,
      range: { startRow, startCol, endRow, endCol },
      cells,
    };
  }
}
