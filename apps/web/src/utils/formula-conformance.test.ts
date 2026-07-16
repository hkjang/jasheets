import fixtures from './__fixtures__/formula-conformance.json';
import { NamedRanges, SheetData, letterToColIndex } from '@/types/spreadsheet';
import { evaluateFormula } from './FormulaEngine';

interface Fixture {
  name: string;
  formula: string;
  expected: unknown;
  locale?: string;
  cells?: Record<string, string | number | boolean | null>;
  namedRanges?: Record<string, string>;
}

function parseReference(reference: string) {
  const match = reference.match(/^([A-Z]+)([1-9][0-9]*)$/)!;
  return { row: Number(match[2]) - 1, col: letterToColIndex(match[1]) };
}

function createSheetData(cells: Fixture['cells'] = {}): SheetData {
  const data: SheetData = {};
  Object.entries(cells).forEach(([reference, value]) => {
    const { row, col } = parseReference(reference);
    if (!data[row]) data[row] = {};
    data[row][col] = { value };
  });
  return data;
}

function createNamedRanges(ranges: Fixture['namedRanges'] = {}): NamedRanges {
  return Object.fromEntries(Object.entries(ranges).map(([name, range]) => {
    const [start, end] = range.split(':');
    return [name, { start: parseReference(start), end: parseReference(end) }];
  }));
}

describe('formula conformance fixtures', () => {
  it.each(fixtures as Fixture[])('$name', ({ formula, expected, locale, cells, namedRanges }) => {
    const result = evaluateFormula(
      formula,
      createSheetData(cells),
      createNamedRanges(namedRanges),
      locale,
    );
    expect(result).toEqual(expected);
  });
});
