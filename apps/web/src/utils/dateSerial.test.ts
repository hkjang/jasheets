import { evaluateFormula } from './FormulaEngine';
import { formatValue } from './formatting';
import { parseInput } from './inputParser';

describe('spreadsheet date and time semantics', () => {
  afterEach(() => jest.useRealTimers());

  it('uses day-based serial values for date arithmetic', () => {
    expect(evaluateFormula('=DATE(2024,1,1)+1', {})).toBe(45293);
    expect(evaluateFormula('=DAY(DATE(2024,2,29))', {})).toBe(29);
    expect(evaluateFormula('=MONTH(DATE(2024,2,29))', {})).toBe(2);
    expect(evaluateFormula('=YEAR(DATE(2024,2,29))', {})).toBe(2024);
  });

  it('represents time as a fraction of one day', () => {
    expect(evaluateFormula('=TIME(12,30,0)', {})).toBeCloseTo(0.5208333333);
    expect(evaluateFormula('=HOUR(TIME(12,30,45))', {})).toBe(12);
    expect(evaluateFormula('=MINUTE(TIME(12,30,45))', {})).toBe(30);
    expect(evaluateFormula('=SECOND(TIME(12,30,45))', {})).toBe(45);
  });

  it('parses and formats date/time serials while accepting legacy timestamps', () => {
    expect(parseInput('2024-01-01')).toEqual({ value: 45292, format: 'date' });
    expect(parseInput('12:00 PM')).toEqual({ value: 0.5, format: 'time' });
    expect(formatValue(45292, 'date')).toBeTruthy();
    expect(formatValue(Date.UTC(2024, 0, 1), 'date')).toBeTruthy();
  });

  it('makes TODAY and NOW deterministic under a fixed clock', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
    expect(evaluateFormula('=TODAY()', {})).toBe(45292);
    expect(evaluateFormula('=NOW()', {})).toBe(45292.5);
  });
});
