import * as XLSX from 'xlsx';
import { csvTextToSheetData, parseCSVRows, workSheetToSheetData } from './fileImport';
import { dateToSerial } from './dateSerial';

describe('XLSX import', () => {
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
