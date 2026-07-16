import { describeSpreadsheetCell } from '../spreadsheetAccessibility';

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
});
