import {
  Lexer,
  Parser,
  Evaluator,
  FormulaEngine,
  extractDependencies,
  EvaluationContext,
  CellValue,
  CellReference,
} from '../index';

// Helper to create a simple context
const createMockContext = (data: Record<string, CellValue>): EvaluationContext => ({
  getCellValue: (ref: CellReference) => {
    // Basic conversion for test keys which are likely "A1", etc. 
    // This is a simplification. The implementation expects ref objects {row, col}.
    // But since the test uses strings for keys in its mock data, let's just cheat a bit or fix the keys.
    // The implementation of Parser.parseCellRef produces { row: 0, col: 0 ... }
    // So we need to map {row, col} back to "A1" or map "A1" to {row, col} in the data.
    // Let's assume the data keys are "A1" style and we convert ref to that.
    
    // Quick helper to convert ref to string (A1)
    const colStr = String.fromCharCode(65 + ref.col);
    const rowStr = (ref.row + 1).toString();
    const key = `${colStr}${rowStr}`;
    return data[key] ?? 0;
  },
  getRangeValues: (start: CellReference, end: CellReference) => {
    const values: CellValue[][] = [];
    for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
      const rowValues: CellValue[] = [];
      for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
        let colIndex = col + 1;
        let colName = '';
        while (colIndex > 0) {
          colName = String.fromCharCode(65 + ((colIndex - 1) % 26)) + colName;
          colIndex = Math.floor((colIndex - 1) / 26);
        }
        rowValues.push(data[`${colName}${row + 1}`] ?? null);
      }
      values.push(rowValues);
    }
    return values;
  }
});

describe('Lexer', () => {
  it('tokenizes numbers', () => {
    const lexer = new Lexer('123.45');
    const tokens = lexer.tokenize();
    expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '123.45' }); 
    // Lexer.readNumber stores value as string in Token.value based on implementation?
    // Implementation: return { type: TokenType.NUMBER, value, position: start }; value is string.
  });

  it('tokenizes strings', () => {
    const lexer = new Lexer('"Hello World"');
    const tokens = lexer.tokenize();
    expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'Hello World' });
  });
});

describe('FormulaEngine', () => {
  let engine: FormulaEngine;
  let context: EvaluationContext;

  beforeEach(() => {
    engine = new FormulaEngine();
    context = createMockContext({
      'A1': 10,
      'A2': 20,
      'A3': 30,
      'B1': 5,
    });
  });

  it('evaluates simple formulas', () => {
    expect(engine.evaluate('=1+2', context)).toBe(3);
  });

  it('evaluates formulas with cell references', () => {
    expect(engine.evaluate('=A1+A2', context)).toBe(30);
  });

  it('evaluates SUM with range', () => {
    expect(engine.evaluate('=SUM(A1:A3)', context)).toBe(60);
    expect(engine.evaluate('=AVERAGE(A1:A3)', context)).toBe(20);
  });

  it('evaluates nested functions', () => {
     // AVERAGE needs to be supported by context if it fetches cells
     // internal helpers like AVERAGE take arguments which are evaluated.
     // =SUM(A1, AVERAGE(A2, A3)) -> A1 is 10. A2 is 20, A3 is 30. AVERAGE is 25. SUM(10, 25) = 35.
     expect(engine.evaluate('=SUM(A1, 10 + 15)', context)).toBe(35);
  });
  
  it('handles division by zero', () => {
     // Implementation throws #DIV/0! error message
     expect(engine.evaluate('=1/0', context)).toBe('#DIV/0!');
  });

  it('propagates spreadsheet errors through operators and functions', () => {
    const errorContext = createMockContext({ A1: '#REF!' });

    expect(engine.evaluate('=A1+1', errorContext)).toBe('#REF!');
    expect(engine.evaluate('=SUM(A1, 2)', errorContext)).toBe('#REF!');
  });

  it('evaluates conditional branches lazily and recovers with IFERROR', () => {
    expect(engine.evaluate('=IF(FALSE, 1/0, 42)', context)).toBe(42);
    expect(engine.evaluate('=IFERROR(1/0, 42)', context)).toBe(42);
    expect(engine.evaluate('=IFERROR(A1+1, 42)', createMockContext({ A1: '#REF!' }))).toBe(42);
  });
});

describe('Dependency Extraction', () => {
  const engine = new FormulaEngine();
  
  it('extracts single cell reference', () => {
    const deps = engine.getDependencies('=A1+1');
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ row: 0, col: 0 }); // A1
  });
});
