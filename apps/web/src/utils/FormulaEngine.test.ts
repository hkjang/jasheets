import { evaluateFormula, shiftFormulaReferences, tokenize } from './FormulaEngine';
import { SheetData } from '@/types/spreadsheet';

const data: SheetData = {
  0: {
    0: { value: 10, displayValue: '10' },
    1: { value: 5, displayValue: '5' },
  },
  1: {
    0: { value: 20, displayValue: '20' },
  },
};

describe('absolute and mixed formula references', () => {
  it('tokenizes and evaluates anchored cell references and ranges', () => {
    expect(tokenize('=$A$1+$B1+A$2')).toEqual(expect.arrayContaining([
      { type: 'REF', value: '$A$1' },
      { type: 'REF', value: '$B1' },
      { type: 'REF', value: 'A$2' },
    ]));
    expect(evaluateFormula('=$A$1+$B1+A$2', data)).toBe(35);
    expect(evaluateFormula('=SUM($A$1:$A$2)', data)).toBe(30);
  });

  it('moves only relative reference components when copied', () => {
    expect(shiftFormulaReferences('=A1+$B2+C$3+$D$4', 2, 1))
      .toBe('=B3+$B4+D$3+$D$4');
    expect(shiftFormulaReferences('=SUM(A1:$B$2)', 1, 2))
      .toBe('=SUM(C2:$B$2)');
  });

  it('does not rewrite references inside strings and reports invalid shifts', () => {
    expect(shiftFormulaReferences('="A1"&A1', 1, 1)).toBe('="A1"&B2');
    expect(shiftFormulaReferences('=A1', -1, 0)).toBe('=#REF!');
  });
});

describe('named ranges', () => {
  const namedRanges = {
    SALES: { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } },
  };

  it('evaluates a named range as a scalar or function range', () => {
    expect(tokenize('=SUM(SALES)')).toContainEqual({ type: 'NAME', value: 'SALES' });
    expect(evaluateFormula('=SALES+5', data, namedRanges)).toBe(15);
    expect(evaluateFormula('=SUM(SALES)', data, namedRanges)).toBe(30);
  });

  it('treats an unknown name as an empty value', () => {
    expect(evaluateFormula('=UNKNOWN+5', data, namedRanges)).toBe(5);
  });
});
