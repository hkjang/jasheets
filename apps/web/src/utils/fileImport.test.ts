import * as XLSX from 'xlsx';
import {
  csvTextToSheetData,
  createWorkbookImportSheets,
  parseCSVRows,
  workSheetToImportedSheet,
  workSheetToSheetData,
} from './fileImport';
import { dateToSerial } from './dateSerial';
import { createXLSXWorkbook } from './export';

describe('XLSX import', () => {
  it('creates a complete atomic import payload for every workbook tab', () => {
    const sheets = createWorkbookImportSheets({
      sheetName: 'Summary',
      sheetNames: ['Summary', 'Raw'],
      data: {},
      workbook: { sheets: [
        {
          name: 'Summary',
          data: { 2: { 3: { value: 7, formula: '=3+4', style: { fontWeight: 'bold' } } } },
          mergedRanges: [{ startRow: 4, startCol: 1, endRow: 5, endCol: 2 }],
          rows: { 6: { height: 40, hidden: true } },
          columns: { 5: { width: 180 } },
        },
        { name: 'Raw', data: { 0: { 0: { value: 'x' } } }, mergedRanges: [], rows: {}, columns: {} },
      ] },
    });

    expect(sheets).toHaveLength(2);
    expect(sheets[0]).toMatchObject({
      name: 'Summary', rowCount: 1000, colCount: 26,
      cells: [{ row: 2, col: 3, value: 7, formula: '=3+4', format: { style: { fontWeight: 'bold' } } }],
      rowMeta: [{ row: 6, height: 40, hidden: true }],
      colMeta: [{ col: 5, width: 180, hidden: false }],
      mergedRanges: [{ startRow: 4, startCol: 1, endRow: 5, endCol: 2 }],
    });
    expect(sheets[1].name).toBe('Raw');
  });

  it('converts Date cells to persisted serial values and preserves date/time formats', () => {
    const date = new Date(Date.UTC(2024, 0, 2));
    const time = new Date(Date.UTC(1899, 11, 30, 15, 30));
    const worksheet: XLSX.WorkSheet = {
      A1: { t: 'd', v: date, z: 'yyyy-mm-dd' },
      B1: { t: 'd', v: time, z: 'hh:mm' },
      C1: { t: 'd', v: date, z: 'yyyy-mm-dd hh:mm' },
      '!ref': 'A1:C1',
    };

    expect(workSheetToSheetData(worksheet)).toEqual({
      0: {
        0: { value: dateToSerial(date), format: 'date' },
        1: { value: dateToSerial(time), format: 'time' },
        2: { value: dateToSerial(date), format: 'date' },
      },
    });
  });

  it('preserves safe hyperlink metadata and rejects unsafe workbook links', () => {
    const worksheet: XLSX.WorkSheet = {
      A1: {
        t: 's',
        v: 'Documentation',
        l: { Target: '  https://example.com/docs  ' },
      },
      B1: {
        t: 's',
        v: 'Do not open',
        l: { Target: 'javascript:alert(1)' },
      },
      C1: {
        t: 's',
        v: 'Email us',
        l: { Target: 'mailto:help@example.com' },
      },
      '!ref': 'A1:C1',
    };

    expect(workSheetToSheetData(worksheet)).toEqual({
      0: {
        0: {
          value: 'Documentation',
          link: { url: 'https://example.com/docs' },
        },
        1: { value: 'Do not open' },
        2: {
          value: 'Email us',
          link: { url: 'mailto:help@example.com' },
        },
      },
    });
  });

  it('parses sparse cells without expanding a hostile !ref range', () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'only real cell' },
      '!ref': 'A1:XFD1048576',
    };

    expect(workSheetToSheetData(worksheet)).toEqual({
      0: { 0: { value: 'only real cell' } },
    });
  });

  it('imports supported styles, number formats, merges, and axis metadata', () => {
    const worksheet: XLSX.WorkSheet = {
      A1: {
        t: 'n',
        v: 1234.5,
        z: '#,##0.00',
        s: {
          font: { bold: true, italic: true, color: { rgb: 'FF112233' }, sz: 14, name: 'Arial' },
          fill: { fgColor: { rgb: 'FFAABBCC' } },
          alignment: { horizontal: 'right', vertical: 'center' },
        },
      },
      '!ref': 'A1:B2',
      '!merges': [{ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } }],
      '!rows': [{ hpx: 42, hidden: true }],
      '!cols': [{ wpx: 160, hidden: true }],
    };

    expect(workSheetToImportedSheet('Report', worksheet)).toEqual({
      name: 'Report',
      data: {
        0: {
          0: {
            value: 1234.5,
            format: '#,##0.00',
            style: {
              fontWeight: 'bold',
              fontStyle: 'italic',
              color: '#112233',
              fontSize: 14,
              fontFamily: 'Arial',
              backgroundColor: '#AABBCC',
              textAlign: 'right',
              verticalAlign: 'middle',
            },
          },
        },
      },
      mergedRanges: [{ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }],
      rows: { 0: { height: 42, hidden: true } },
      columns: { 0: { width: 160, hidden: true } },
    });
  });

  it('round-trips a real multi-sheet XLSX workbook without losing core metadata', () => {
    const source = createXLSXWorkbook([
      {
        name: 'Summary',
        data: {
          0: {
            0: { value: 3, formula: '=1+2', format: '0.00' },
            1: { value: 'Docs', link: { url: 'https://example.com/help' } },
          },
        },
        mergedRanges: [{ startRow: 2, endRow: 3, startCol: 0, endCol: 1 }],
        rows: { 0: { height: 36, hidden: true } },
        columns: { 1: { width: 180, hidden: true } },
      },
      { name: 'Raw data', data: { 4: { 2: { value: true } } } },
    ]);
    const bytes = XLSX.write(source, { type: 'array', bookType: 'xlsx', cellStyles: true });
    const parsed = XLSX.read(bytes, { type: 'array', cellStyles: true, cellDates: true });
    const summary = workSheetToImportedSheet('Summary', parsed.Sheets.Summary);
    const raw = workSheetToImportedSheet('Raw data', parsed.Sheets['Raw data']);

    expect(parsed.SheetNames).toEqual(['Summary', 'Raw data']);
    expect(summary.data[0][0]).toMatchObject({ value: 3, formula: '=1+2', format: '0.00' });
    expect(summary.data[0][1].link).toEqual({ url: 'https://example.com/help' });
    expect(summary.mergedRanges).toEqual([{ startRow: 2, endRow: 3, startCol: 0, endCol: 1 }]);
    expect(summary.rows[0]).toMatchObject({ height: 36, hidden: true });
    expect(summary.columns[1]).toMatchObject({ width: 180, hidden: true });
    expect(raw.data[4][2]).toEqual({ value: true });
  });
});

describe('CSV import', () => {
  it('preserves line breaks, commas, and escaped quotes in quoted fields', () => {
    const data = csvTextToSheetData(
      'Name,Notes\r\nAlice,"First line\r\nSecond, line with ""quotes"""\r\nBob,Done\r\n',
    );

    expect(data).toEqual({
      0: {
        0: { value: 'Name' },
        1: { value: 'Notes' },
      },
      1: {
        0: { value: 'Alice' },
        1: { value: 'First line\r\nSecond, line with "quotes"' },
      },
      2: {
        0: { value: 'Bob' },
        1: { value: 'Done' },
      },
    });
  });

  it('supports LF, CRLF, and CR record separators without adding a trailing row', () => {
    expect(parseCSVRows('a,b\nc,d\r\ne,f\rg,h\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ]);
  });

  it('rejects a truncated quoted field instead of silently corrupting rows', () => {
    expect(() => parseCSVRows('Name,Notes\nAlice,"unfinished')).toThrow(
      'Invalid CSV: unclosed quoted field',
    );
  });
});
