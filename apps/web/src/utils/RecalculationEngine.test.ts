import { SheetData } from '@/types/spreadsheet';
import { recalculate } from './RecalculationEngine';

function formula(value: string, cached: number = 0) {
  return { formula: value, value: cached, displayValue: String(cached) };
}

describe('circular reference detection', () => {
  it('marks every cell in a direct cycle', () => {
    const data: SheetData = {
      0: {
        0: formula('=B1+1'),
        1: formula('=A1+1'),
      },
    };

    recalculate(data);

    expect(data[0][0]).toMatchObject({ value: '#CIRCULAR!', error: '#CIRCULAR!' });
    expect(data[0][1]).toMatchObject({ value: '#CIRCULAR!', error: '#CIRCULAR!' });
  });

  it('detects a self reference and invalidates dependants', () => {
    const data: SheetData = {
      0: {
        0: formula('=A1+1'),
        1: formula('=A1+1'),
      },
    };

    recalculate(data);

    expect(data[0][0].value).toBe('#CIRCULAR!');
    expect(data[0][1].value).toBe('#CIRCULAR!');
  });

  it('continues to calculate an acyclic dependency chain', () => {
    const data: SheetData = {
      0: {
        0: { value: 2 },
        1: formula('=A1+1'),
        2: formula('=B1+1'),
      },
    };

    recalculate(data);

    expect(data[0][1].value).toBe(3);
    expect(data[0][2].value).toBe(4);
  });
});

describe('incremental recalculation', () => {
  it('recalculates only formulas downstream from changed cells', () => {
    const data: SheetData = {
      0: {
        0: { value: 5 },
        1: formula('=A1+1'),
        2: formula('=B1+1'),
        3: formula('=10+1', 99),
      },
    };

    recalculate(data, {}, [{ row: 0, col: 0 }]);

    expect(data[0][1].value).toBe(6);
    expect(data[0][2].value).toBe(7);
    expect(data[0][3].value).toBe(99);
  });

  it('recalculates a changed formula and its dependants', () => {
    const data: SheetData = {
      0: {
        0: { value: 3 },
        1: formula('=A1*2'),
        2: formula('=B1+1'),
      },
    };

    recalculate(data, {}, [{ row: 0, col: 1 }]);

    expect(data[0][1].value).toBe(6);
    expect(data[0][2].value).toBe(7);
  });
});
