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

  it('returns a name error for an unknown name', () => {
    expect(evaluateFormula('=UNKNOWN+5', data, namedRanges)).toBe('#NAME?');
  });
});

describe('array formulas', () => {
  it('creates two-dimensional SEQUENCE results', () => {
    expect(evaluateFormula('=SEQUENCE(2,3,10,2)', data)).toEqual([
      [10, 12, 14],
      [16, 18, 20],
    ]);
  });

  it('parses numeric array constants', () => {
    expect(evaluateFormula('={1,2;3,4}', data)).toEqual([[1, 2], [3, 4]]);
  });

  it('limits invalid or excessively large arrays', () => {
    expect(evaluateFormula('=SEQUENCE(0)', data)).toBe('#NUM!');
    expect(evaluateFormula('={1,NOPE}', data)).toBe('#VALUE!');
  });
});

describe('lookup formulas', () => {
  const lookupData: SheetData = {
    0: { 0: { value: 'A' }, 1: { value: 10 }, 2: { value: 20 } },
    1: { 0: { value: 'B' }, 1: { value: 30 }, 2: { value: 40 } },
    2: { 0: { value: 'C' }, 1: { value: 50 }, 2: { value: 60 } },
  };

  it('supports vertical and horizontal lookup', () => {
    expect(evaluateFormula('=VLOOKUP("B",A1:C3,3,FALSE)', lookupData)).toBe(40);
    expect(evaluateFormula('=HLOOKUP(20,A1:C3,2,FALSE)', lookupData)).toBe(40);
  });

  it('supports INDEX and MATCH', () => {
    expect(evaluateFormula('=INDEX(B1:C3,3,2)', lookupData)).toBe(60);
    expect(evaluateFormula('=MATCH("C",A1:A3,0)', lookupData)).toBe(3);
  });

  it('supports XLOOKUP and custom missing values', () => {
    expect(evaluateFormula('=XLOOKUP("B",A1:A3,C1:C3)', lookupData)).toBe(40);
    expect(evaluateFormula('=XLOOKUP("D",A1:A3,C1:C3,"missing")', lookupData)).toBe('missing');
  });

  it('returns spreadsheet errors for invalid lookups', () => {
    expect(evaluateFormula('=VLOOKUP("D",A1:C3,2,FALSE)', lookupData)).toBe('#N/A');
    expect(evaluateFormula('=INDEX(A1:C3,1,4)', lookupData)).toBe('#REF!');
  });
});

describe('conditional aggregate formulas', () => {
  const aggregateData: SheetData = {
    0: { 0: { value: 'East' }, 1: { value: 'Paid' }, 2: { value: 120 } },
    1: { 0: { value: 'West' }, 1: { value: 'Draft' }, 2: { value: 80 } },
    2: { 0: { value: 'East' }, 1: { value: 'Paid' }, 2: { value: 200 } },
    3: { 0: { value: 'Eastern' }, 1: { value: 'Paid' }, 2: { value: 50 } },
  };

  it('supports single-condition sum, count, and average aggregates', () => {
    expect(evaluateFormula('=SUMIF(A1:A4,"East",C1:C4)', aggregateData)).toBe(320);
    expect(evaluateFormula('=COUNTIF(C1:C4,">=100")', aggregateData)).toBe(2);
    expect(evaluateFormula('=AVERAGEIF(B1:B4,"Paid",C1:C4)', aggregateData)).toBeCloseTo(123.333333);
  });

  it('coerces numeric text criteria and treats empty cells as blanks', () => {
    const mixedData: SheetData = {
      0: { 0: { value: '100' } },
      1: { 0: { value: 100 } },
      2: {},
      3: { 0: { value: '' } },
    };
    expect(evaluateFormula('=COUNTIF(A1:A4,100)', mixedData)).toBe(2);
    expect(evaluateFormula('=COUNTIF(A1:A4,"")', mixedData)).toBe(2);
    expect(evaluateFormula('=COUNTIF(A1:A4,"<>")', mixedData)).toBe(2);
  });

  it('supports multiple criteria and cell-based criteria', () => {
    const withCriterion: SheetData = {
      ...aggregateData,
      4: { 0: { value: 'East' } },
    };
    expect(evaluateFormula('=SUMIFS(C1:C4,A1:A4,A5,B1:B4,"Paid")', withCriterion)).toBe(320);
    expect(evaluateFormula('=COUNTIFS(A1:A4,"East",C1:C4,">100")', aggregateData)).toBe(2);
    expect(evaluateFormula('=AVERAGEIFS(C1:C4,A1:A4,"<>West",B1:B4,"Paid")', aggregateData)).toBeCloseTo(123.333333);
  });

  it('matches case-insensitive wildcards and escaped wildcard characters', () => {
    const wildcardData: SheetData = {
      0: { 0: { value: 'North' } },
      1: { 0: { value: 'northeast' } },
      2: { 0: { value: 'North*' } },
    };
    expect(evaluateFormula('=COUNTIF(A1:A3,"north*")', wildcardData)).toBe(3);
    expect(evaluateFormula('=COUNTIF(A1:A3,"North~*")', wildcardData)).toBe(1);
  });

  it('supports cross-sheet criteria ranges and reports invalid shapes', () => {
    const workbook = { Summary: {}, Sales: aggregateData };
    expect(evaluateFormula('=SUMIFS(Sales!C1:C4,Sales!A1:A4,"East")', {}, {}, 'en-US', workbook)).toBe(320);
    expect(evaluateFormula('=COUNTIFS(A1:A2,"East",B1:B3,"Paid")', aggregateData)).toBe('#VALUE!');
    expect(evaluateFormula('=AVERAGEIF(A1:A4,"Missing",C1:C4)', aggregateData)).toBe('#DIV/0!');
    expect(evaluateFormula('=COUNTIF(A1:A4,"East",C1:C4,"Paid")', aggregateData)).toBe('#VALUE!');
  });
});

describe('formula error propagation', () => {
  it('propagates errors from referenced cells through arithmetic', () => {
    const errorData: SheetData = {
      0: { 0: { value: '#REF!' }, 1: { value: '#N/A' } },
    };
    expect(evaluateFormula('=A1+10', errorData)).toBe('#REF!');
    expect(evaluateFormula('=B1*2', errorData)).toBe('#N/A');
  });

  it('returns standard arithmetic and name errors', () => {
    expect(evaluateFormula('=10/0', {})).toBe('#DIV/0!');
    expect(evaluateFormula('=UNKNOWN_NAME+1', {})).toBe('#NAME?');
  });

  it('recovers errors with IFERROR and only missing values with IFNA', () => {
    expect(evaluateFormula('=IFERROR(10/0,99)', {})).toBe(99);
    expect(evaluateFormula('=IFNA(XLOOKUP("Z",A1:A1,B1:B1),"missing")', {})).toBe('missing');
    expect(evaluateFormula('=IFNA(10/0,99)', {})).toBe('#DIV/0!');
  });

  it('lazily evaluates fallback formulas and references', () => {
    const fallbackData: SheetData = {
      0: { 0: { value: 7 }, 1: { value: 'recovered' } },
    };

    expect(evaluateFormula('=IFERROR(1/0,A1+5)', fallbackData)).toBe(12);
    expect(evaluateFormula('=IFERROR(1/0,B1)', fallbackData)).toBe('recovered');
    expect(evaluateFormula('=IFERROR(10,1/0)', fallbackData)).toBe(10);
  });
});

describe('comparisons and conditional formulas', () => {
  const conditionalData: SheetData = {
    0: {
      0: { value: 10 },
      1: { value: 'Paid' },
      2: { value: '#REF!' },
    },
  };

  it('evaluates numeric, text, and equality comparisons', () => {
    expect(evaluateFormula('=A1>5', conditionalData)).toBe(true);
    expect(evaluateFormula('=A1<=10', conditionalData)).toBe(true);
    expect(evaluateFormula('=B1="paid"', conditionalData)).toBe(true);
    expect(evaluateFormula('=B1<>"draft"', conditionalData)).toBe(true);
    expect(evaluateFormula('=1+2=3', conditionalData)).toBe(true);
  });

  it('evaluates only the selected IF branch', () => {
    expect(evaluateFormula('=IF(A1>=10,"ready","waiting")', conditionalData)).toBe('ready');
    expect(evaluateFormula('=IF(FALSE,C1,42)', conditionalData)).toBe(42);
    expect(evaluateFormula('=IF(TRUE,1+2,1/0)', conditionalData)).toBe(3);
    expect(evaluateFormula('=IF(FALSE,1)', conditionalData)).toBe(false);
  });

  it('propagates an error used as the IF condition', () => {
    expect(evaluateFormula('=IF(C1,"yes","no")', conditionalData)).toBe('#REF!');
  });
});

describe('spreadsheet operator precedence', () => {
  it('supports unary signs and right-associative powers', () => {
    expect(evaluateFormula('=-2^2', {})).toBe(-4);
    expect(evaluateFormula('=2^-2', {})).toBe(0.25);
    expect(evaluateFormula('=2^3^2', {})).toBe(512);
    expect(evaluateFormula('=-(1+2)*3', {})).toBe(-9);
  });

  it('treats percent signs as postfix percentage operators', () => {
    expect(evaluateFormula('=50%', {})).toBe(0.5);
    expect(evaluateFormula('=200*10%', {})).toBe(20);
    expect(evaluateFormula('=50%^2', {})).toBe(0.25);
  });
});

describe('text and scalar formulas', () => {
  const textData: SheetData = {
    0: {
      0: { value: 'JaSheets' },
      1: { value: 2026 },
      2: { value: true },
      3: { value: '#REF!' },
    },
  };

  it('preserves direct string, boolean, and text-cell values', () => {
    expect(evaluateFormula('="ready"', textData)).toBe('ready');
    expect(evaluateFormula('="He said ""yes"""', textData)).toBe('He said "yes"');
    expect(evaluateFormula('=TRUE', textData)).toBe(true);
    expect(evaluateFormula('=A1', textData)).toBe('JaSheets');
    expect(evaluateFormula('=C1', textData)).toBe(true);
  });

  it('concatenates expressions using spreadsheet coercion', () => {
    expect(evaluateFormula('=A1&" "&B1', textData)).toBe('JaSheets 2026');
    expect(evaluateFormula('="total="&(B1+1)', textData)).toBe('total=2027');
    expect(evaluateFormula('=IF(TRUE,A1&"!","no")', textData)).toBe('JaSheets!');
  });

  it('does not split ampersands inside strings and propagates errors', () => {
    expect(evaluateFormula('="R&D"&" team"', textData)).toBe('R&D team');
    expect(evaluateFormula('=A1&D1', textData)).toBe('#REF!');
    expect(evaluateFormula('=A1&', textData)).toBe('#VALUE!');
  });
});

describe('cross-sheet formulas', () => {
  const workbook = {
    Summary: {},
    Revenue: {
      0: {
        0: { value: 10 },
        1: { value: 20 },
        2: { value: 'paid' },
      },
      1: {
        0: { value: 30 },
        1: { value: 40 },
      },
    },
    'Q1 Sales': {
      0: { 0: { value: 7 } },
    },
  };

  it('tokenizes quoted and unquoted sheet references and ranges', () => {
    expect(tokenize("=Revenue!A1+'Q1 Sales'!$A$1+SUM(Revenue!A1:B2)")).toEqual(
      expect.arrayContaining([
        { type: 'SHEET_REF', value: 'Revenue!A1' },
        { type: 'SHEET_REF', value: 'Q1 Sales!$A$1' },
        { type: 'SHEET_RANGE', value: 'Revenue!A1:B2' },
      ]),
    );
  });

  it('evaluates scalar, arithmetic, range, lookup, and quoted-name references', () => {
    expect(evaluateFormula('=Revenue!A1', {}, {}, 'en-US', workbook)).toBe(10);
    expect(evaluateFormula("=Revenue!A1+'Q1 Sales'!A1", {}, {}, 'en-US', workbook)).toBe(17);
    expect(evaluateFormula('=SUM(Revenue!A1:B2)', {}, {}, 'en-US', workbook)).toBe(100);
    expect(evaluateFormula('=VLOOKUP(30,Revenue!A1:B2,2,FALSE)', {}, {}, 'en-US', workbook)).toBe(40);
  });

  it('returns a reference error for a missing sheet', () => {
    expect(evaluateFormula('=Missing!A1+1', {}, {}, 'en-US', workbook)).toBe('#REF!');
  });
});
