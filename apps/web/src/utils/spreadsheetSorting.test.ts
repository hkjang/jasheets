import { SheetData } from '@/types/spreadsheet';
import { sortRangeData, sortRowsData } from './spreadsheetSorting';

const cell = (value: number) => ({ value, displayValue: String(value), format: 'general' });
const formulaCell = (formula: string, value: number) => ({
  value,
  displayValue: String(value),
  formula,
  format: 'general',
});

describe('spreadsheet sorting', () => {
  it('recalculates formulas outside a sorted range', () => {
    const data: SheetData = {
      0: { 0: cell(2), 1: formulaCell('=A1*10', 20) },
      1: { 0: cell(1), 1: formulaCell('=A2*10', 10) },
    };

    sortRangeData(data, { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } }, 0);

    expect(data[0][0].value).toBe(1);
    expect(data[0][1].value).toBe(10);
    expect(data[1][1].value).toBe(20);
  });

  it('recalculates moved formulas after sorting complete rows', () => {
    const data: SheetData = {
      0: { 0: cell(2), 1: formulaCell('=A1*10', 20) },
      1: { 0: cell(1), 1: formulaCell('=A1*10', 20) },
    };

    sortRowsData(data, 0);

    expect(data[0][0].value).toBe(1);
    expect(data[0][1].value).toBe(10);
    expect(data[1][1].value).toBe(10);
  });
});
