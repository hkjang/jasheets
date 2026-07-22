import { evaluateFormula, shiftFormulaReferences, tokenize, type SheetData } from '../index';

const data: SheetData = {
  0: {
    0: { value: 10 },
    1: { value: 5 },
  },
  1: {
    0: { value: 20 },
  },
};

describe('shared formula engine', () => {
  it('evaluates references, ranges, and spreadsheet precedence', () => {
    expect(evaluateFormula('=A1+B1', data)).toBe(15);
    expect(evaluateFormula('=SUM(A1:A2)', data)).toBe(30);
    expect(evaluateFormula('=2^3^2', data)).toBe(512);
    expect(evaluateFormula('=-2^2', data)).toBe(-4);
    expect(evaluateFormula('=200*10%', data)).toBe(20);
  });

  it('supports workbook references and dynamic arrays', () => {
    const workbook = { Summary: data, Revenue: { 0: { 0: { value: 40 } } } };
    expect(evaluateFormula('=Revenue!A1+2', data, {}, 'en-US', workbook)).toBe(42);
    expect(evaluateFormula('=SEQUENCE(2,2)', data)).toEqual([[1, 2], [3, 4]]);
  });

  it('uses Excel serial dates and locale-aware arguments', () => {
    expect(evaluateFormula('=DATE(2024,1,1)+1', data)).toBe(45293);
    expect(evaluateFormula('=SUM(1,5;2,5)', data, {}, 'de-DE')).toBe(4);
  });

  it('propagates errors and lazily evaluates conditional branches', () => {
    expect(evaluateFormula('=1/0', data)).toBe('#DIV/0!');
    expect(evaluateFormula('=IF(FALSE,1/0,42)', data)).toBe(42);
    expect(evaluateFormula('=IFERROR(1/0,42)', data)).toBe(42);
  });

  it('owns tokenization and reference shifting used by the editor', () => {
    expect(tokenize("=Revenue!A1+'Q1 Sales'!$A$1")).toEqual(expect.arrayContaining([
      { type: 'SHEET_REF', value: 'Revenue!A1' },
      { type: 'SHEET_REF', value: 'Q1 Sales!$A$1' },
    ]));
    expect(shiftFormulaReferences('=A1+$B$2', 2, 1)).toBe('=B3+$B$2');
  });
});
