import { createPasteUpdates, parseTsv, serializeRangeToTsv } from './clipboard';

describe('spreadsheet clipboard', () => {
  it('copies formulas instead of cached values', () => {
    const data = { 0: { 0: { value: 3, formula: '=A2+1' }, 1: { value: 'text' } } };
    expect(serializeRangeToTsv(data, { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } }))
      .toBe('=A2+1\ttext');
  });

  it('quotes and parses tabs, newlines, and quotes losslessly', () => {
    const data = { 0: { 0: { value: 'a\tb' }, 1: { value: 'line1\nline2' }, 2: { value: 'say "yes"' } } };
    const text = serializeRangeToTsv(data, { start: { row: 0, col: 0 }, end: { row: 0, col: 2 } });
    expect(parseTsv(text)).toEqual([['a\tb', 'line1\nline2', 'say "yes"']]);
  });

  it('supports CRLF input and ignores one trailing empty row', () => {
    expect(parseTsv('A\tB\r\nC\tD\r\n')).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('creates cell updates relative to the paste origin', () => {
    expect(createPasteUpdates('A\tB\nC\tD', { row: 2, col: 3 })).toEqual([
      { row: 2, col: 3, value: 'A' }, { row: 2, col: 4, value: 'B' },
      { row: 3, col: 3, value: 'C' }, { row: 3, col: 4, value: 'D' },
    ]);
  });
});
