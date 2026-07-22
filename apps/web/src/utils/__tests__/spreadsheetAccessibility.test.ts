import {
  describeSpreadsheetCell,
  getAccessibleCellHyperlink,
} from '../spreadsheetAccessibility';

describe('spreadsheet accessibility descriptions', () => {
  it('announces a blank cell by reference', () => {
    expect(describeSpreadsheetCell({}, { row: 1, col: 2 }, null)).toBe('C2, blank');
  });

  it('announces formulas with their computed value', () => {
    const data = { 0: { 1: { formula: '=A1+1', value: 3, displayValue: '3' } } };
    expect(describeSpreadsheetCell(data, { row: 0, col: 1 }, null)).toBe('B1, formula =A1+1, value 3');
  });

  it('prioritizes errors and describes selected ranges', () => {
    const data = { 2: { 0: { value: '#DIV/0!', error: '#DIV/0!' } } };
    const selection = { start: { row: 2, col: 0 }, end: { row: 4, col: 1 } };
    expect(describeSpreadsheetCell(data, { row: 2, col: 0 }, selection)).toBe(
      'A3, error #DIV/0!, selected range A3 through B5',
    );
  });

  it('announces a merged cell from every position using the anchor content', () => {
    const data = { 1: { 1: { value: 'Quarterly revenue' } } };
    const context = {
      mergedRanges: [{ startRow: 1, startCol: 1, endRow: 2, endCol: 3 }],
    };

    expect(describeSpreadsheetCell(data, { row: 2, col: 3 }, null, context)).toBe(
      'B2, Quarterly revenue, merged cell B2 through D3',
    );
  });

  it('announces only safe links and exposes their normalized target', () => {
    const safeData = { 0: { 0: { value: 'Open docs', link: { url: ' https://example.com/docs ' } } } };
    const unsafeData = { 0: { 0: { value: 'Run', link: { url: 'javascript:alert(1)' } } } };

    expect(describeSpreadsheetCell(safeData, { row: 0, col: 0 }, null)).toBe(
      'A1, Open docs, link https://example.com/docs, press Alt+Enter to open',
    );
    expect(getAccessibleCellHyperlink(safeData, { row: 0, col: 0 })).toBe('https://example.com/docs');
    expect(describeSpreadsheetCell(unsafeData, { row: 0, col: 0 }, null)).toBe('A1, Run');
    expect(getAccessibleCellHyperlink(unsafeData, { row: 0, col: 0 })).toBeNull();
  });

  it('resolves a merged cell link from its anchor', () => {
    const data = { 0: { 0: { value: 'Mail', link: { url: 'mailto:user@example.com' } } } };
    const context = {
      mergedRanges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }],
    };

    expect(getAccessibleCellHyperlink(data, { row: 0, col: 1 }, context)).toBe(
      'mailto:user@example.com',
    );
  });
});
