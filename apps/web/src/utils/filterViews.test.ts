import { getHiddenRowsForFilterView, matchesFilter } from './filterViews';

describe('personal filter views', () => {
  it('evaluates text and numeric conditions', () => {
    expect(matchesFilter('Completed', { column: 0, operator: 'contains', value: 'plete' })).toBe(true);
    expect(matchesFilter(10, { column: 0, operator: 'greaterThan', value: 5 })).toBe(true);
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
});
