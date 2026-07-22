import {
  createPasteUpdates,
  createRichPasteUpdates,
  parseRichClipboard,
  parseTsv,
  serializeRangeToRichClipboard,
  serializeRangeToTsv,
} from './clipboard';

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

  it('removes an external TSV byte-order mark from only the first cell', () => {
    expect(parseTsv('\uFEFF=SUM(A1:A2)\tA\uFEFFB')).toEqual([['=SUM(A1:A2)', 'A\uFEFFB']]);
    expect(createPasteUpdates('\uFEFF=SUM(A1:A2)', { row: 1, col: 2 })).toEqual([
      { row: 1, col: 2, value: '=SUM(A1:A2)' },
    ]);
  });

  it('creates cell updates relative to the paste origin', () => {
    expect(createPasteUpdates('A\tB\nC\tD', { row: 2, col: 3 })).toEqual([
      { row: 2, col: 3, value: 'A' }, { row: 2, col: 4, value: 'B' },
      { row: 3, col: 3, value: 'C' }, { row: 3, col: 4, value: 'D' },
    ]);
  });

  it('round-trips rich cell content with a versioned payload', () => {
    const data = {
      2: {
        3: {
          value: 3,
          formula: '=A1+2',
          style: { fontWeight: 'bold' as const, color: '#123456' },
          format: 'currency',
          validation: { type: 'number' as const, min: 0, allowBlank: true },
          link: { url: '  https://example.com/report  ' },
          displayValue: '$3.00',
          error: 'not transported',
        },
      },
    };
    const json = serializeRangeToRichClipboard(data, {
      start: { row: 2, col: 3 }, end: { row: 2, col: 4 },
    });

    expect(json).not.toBeNull();
    expect(parseRichClipboard(json!)).toEqual({
      version: 1,
      rows: 1,
      cols: 2,
      source: { row: 2, col: 3 },
      cells: [[{
        value: 3,
        formula: '=A1+2',
        style: { fontWeight: 'bold', color: '#123456' },
        format: 'currency',
        validation: { type: 'number', min: 0, allowBlank: true },
        link: { url: 'https://example.com/report' },
      }, null]],
    });
    expect(createRichPasteUpdates(json!, { row: 10, col: 5 })).toEqual([
      {
        row: 10,
        col: 5,
        cell: expect.objectContaining({ value: 3, formula: '=C9+2', format: 'currency' }),
      },
      { row: 10, col: 6, cell: { value: null } },
    ]);
  });

  it('rejects unsafe links and malformed or unsupported payloads', () => {
    const base = {
      version: 1,
      rows: 1,
      cols: 1,
      source: { row: 0, col: 0 },
      cells: [[{ value: 'x' }]],
    };
    expect(parseRichClipboard(JSON.stringify({ ...base, version: 2 }))).toBeNull();
    expect(parseRichClipboard(JSON.stringify({ ...base, rows: 2 }))).toBeNull();
    expect(parseRichClipboard(JSON.stringify({
      ...base,
      cells: [[{ value: 'x', link: { url: 'javascript:alert(1)' } }]],
    }))).toBeNull();
    expect(parseRichClipboard(JSON.stringify({
      ...base,
      cells: [[{ value: 'x', prototypePollution: true }]],
    }))).toBeNull();
  });

  it('limits rich clipboard dimensions, cell counts, and byte size', () => {
    expect(parseRichClipboard(JSON.stringify({
      version: 1, rows: 101, cols: 100, source: { row: 0, col: 0 }, cells: [],
    }))).toBeNull();
    const oversized = JSON.stringify({
      version: 1, rows: 1, cols: 1, source: { row: 0, col: 0 }, cells: [[{ value: 'x'.repeat(1_000_001) }]],
    });
    expect(parseRichClipboard(oversized)).toBeNull();
    expect(serializeRangeToRichClipboard({}, {
      start: { row: 0, col: 0 }, end: { row: 100, col: 99 },
    })).toBeNull();
  });
});
