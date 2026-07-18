import { getHiddenRowsForFilterView, matchesFilter } from './filterViews';

describe('personal filter views', () => {
  it('evaluates text and numeric conditions', () => {
    expect(matchesFilter('Completed', { column: 0, operator: 'contains', value: 'plete' })).toBe(true);
    expect(matchesFilter(10, { column: 0, operator: 'greaterThan', value: 5 })).toBe(true);
  });

  it('evaluates inclusive numeric boundaries consistently with saved filter profiles', () => {
    expect(matchesFilter(10, { column: 0, operator: 'greaterThanOrEqual', value: 10 })).toBe(true);
    expect(matchesFilter(9, { column: 0, operator: 'greaterThanOrEqual', value: 10 })).toBe(false);
    expect(matchesFilter('10', { column: 0, operator: 'lessThanOrEqual', value: 10 })).toBe(true);
    expect(matchesFilter(11, { column: 0, operator: 'lessThanOrEqual', value: '10' })).toBe(false);
  });

  it('evaluates inclusive between ranges and rejects malformed ranges', () => {
    expect(matchesFilter(10, { column: 0, operator: 'between', value: [10, 20] })).toBe(true);
    expect(matchesFilter(20, { column: 0, operator: 'between', value: ['10', '20'] })).toBe(true);
    expect(matchesFilter(21, { column: 0, operator: 'between', value: [10, 20] })).toBe(false);
    expect(matchesFilter(15, { column: 0, operator: 'between', value: [10] })).toBe(false);
    expect(matchesFilter(15, { column: 0, operator: 'between', value: '10,20' })).toBe(false);
  });

  it('returns row indices hidden by all active conditions', () => {
    const data = {
      0: { 0: { value: 'open' }, 1: { value: 10 } },
      1: { 0: { value: 'closed' }, 1: { value: 20 } },
      2: { 0: { value: 'open' }, 1: { value: 3 } },
    };
    expect(getHiddenRowsForFilterView(data, [
      { column: 0, operator: 'equals', value: 'open' },
      { column: 1, operator: 'greaterThan', value: 5 },
    ])).toEqual([1, 2]);
  });

  it('applies between conditions when calculating hidden rows', () => {
    const data = {
      0: { 0: { value: 9 } },
      1: { 0: { value: 10 } },
      2: { 0: { value: 15 } },
      3: { 0: { value: 20 } },
      4: { 0: { value: 21 } },
    };

    expect(getHiddenRowsForFilterView(data, [
      { column: 0, operator: 'between', value: [10, 20] },
    ])).toEqual([0, 4]);
  });
});
