import { csvTextToSheetData, parseCSVRows } from './fileImport';

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
