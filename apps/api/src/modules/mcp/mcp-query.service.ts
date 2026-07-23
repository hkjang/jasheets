import { Injectable } from '@nestjs/common';
import { SheetsService } from '../sheets/sheets.service';
import { RevisionLogsService } from '../revision-logs/revision-logs.service';

@Injectable()
export class McpQueryService {
  constructor(
    private readonly sheetsService: SheetsService,
    private readonly revisionLogsService: RevisionLogsService,
  ) {}

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

  async analyzeRange(
    userId: string,
    spreadsheetId: string,
    sheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    hasHeader = true,
  ) {
    const range = await this.sheetsService.readSheetRange(
      userId,
      spreadsheetId,
      sheetId,
      startRow,
      startCol,
      endRow,
      endCol,
    );
    const byCoordinate = new Map(
      range.cells.map((cell) => [`${cell.row}:${cell.col}`, cell]),
    );
    const dataStartRow = hasHeader ? startRow + 1 : startRow;
    const dataRows = Math.max(0, endRow - dataStartRow + 1);
    const insights: Array<{
      severity: 'info' | 'warning';
      code: string;
      column: number;
      message: string;
    }> = [];

    let totalBlankCells = 0;
    let totalFormulaCells = 0;
    let totalErrorCells = 0;
    const columns = Array.from(
      { length: endCol - startCol + 1 },
      (_, offset) => {
        const col = startCol + offset;
        const headerCell = hasHeader
          ? byCoordinate.get(`${startRow}:${col}`)
          : undefined;
        const numericValues: number[] = [];
        const types = new Map<string, number>();
        const distinct = new Set<string>();
        let blankCount = 0;
        let formulaCount = 0;
        let errorCount = 0;
        for (let row = dataStartRow; row <= endRow; row += 1) {
          const cell = byCoordinate.get(`${row}:${col}`);
          const hasContent = Boolean(
            cell && (cell.value !== null || cell.formula),
          );
          if (!hasContent) {
            blankCount += 1;
            continue;
          }
          if (cell!.formula) formulaCount += 1;
          const value = cell!.value;
          const type = this.analysisType(value);
          types.set(type, (types.get(type) ?? 0) + 1);
          if (
            typeof value === 'string' &&
            /^#(?:REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|NULL!)$/.test(value)
          ) {
            errorCount += 1;
          }
          if (typeof value === 'number' && Number.isFinite(value)) {
            numericValues.push(value);
          }
          distinct.add(`${type}:${JSON.stringify(value)}`);
        }
        totalBlankCells += blankCount;
        totalFormulaCells += formulaCount;
        totalErrorCells += errorCount;

        const nonEmptyCount = dataRows - blankCount;
        if (dataRows > 0 && blankCount / dataRows >= 0.2) {
          insights.push({
            severity: 'warning',
            code: 'HIGH_MISSING_RATE',
            column: col,
            message: `${blankCount} of ${dataRows} values are blank.`,
          });
        }
        if (types.size > 1) {
          insights.push({
            severity: 'warning',
            code: 'MIXED_TYPES',
            column: col,
            message: `Column contains mixed value types: ${[...types.keys()].join(', ')}.`,
          });
        }
        if (errorCount > 0) {
          insights.push({
            severity: 'warning',
            code: 'FORMULA_ERRORS',
            column: col,
            message: `Column contains ${errorCount} formula error value(s).`,
          });
        }

        const numericSum = numericValues.reduce((sum, value) => sum + value, 0);
        return {
          index: col,
          label: this.columnLabel(col),
          header:
            headerCell?.value === null || headerCell?.value === undefined
              ? null
              : String(headerCell.value),
          rows: dataRows,
          nonEmptyCount,
          blankCount,
          distinctCount: distinct.size,
          formulaCount,
          errorCount,
          types: Object.fromEntries(types),
          numeric:
            numericValues.length > 0
              ? {
                  count: numericValues.length,
                  sum: numericSum,
                  average: numericSum / numericValues.length,
                  min: Math.min(...numericValues),
                  max: Math.max(...numericValues),
                }
              : null,
        };
      },
    );

    return {
      spreadsheetId,
      sheetId,
      sheetName: range.sheetName,
      version: range.version,
      range: range.range,
      hasHeader,
      summary: {
        dataRows,
        columns: columns.length,
        analyzedCells: dataRows * columns.length,
        blankCells: totalBlankCells,
        formulaCells: totalFormulaCells,
        errorCells: totalErrorCells,
      },
      columns,
      insights,
    };
  }

  previewChanges(
    userId: string,
    sheetId: string,
    updates: Array<{
      row: number;
      col: number;
      value?: unknown;
      formula?: string | null;
      format?: Record<string, unknown>;
    }>,
    expectedVersion?: number,
  ) {
    return this.sheetsService.previewCellChanges(
      userId,
      sheetId,
      updates,
      expectedVersion,
    );
  }

  getRevisionHistory(
    userId: string,
    sheetId: string,
    options: {
      limit: number;
      cursor?: string;
      action?: string;
      includeChanges?: boolean;
    },
  ) {
    return this.revisionLogsService.getRevisionHistory(
      userId,
      sheetId,
      options,
    );
  }

  searchWorkbook(
    userId: string,
    spreadsheetId: string,
    query: string,
    options: {
      mode: 'all' | 'values' | 'formulas';
      sheetId?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    return this.sheetsService.searchWorkbook(
      userId,
      spreadsheetId,
      query,
      options,
    );
  }

  private analysisType(value: unknown): string {
    if (value === null || value === undefined) return 'unknown';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    return 'object';
  }

  private columnLabel(index: number): string {
    let value = index + 1;
    let label = '';
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }
}
