import { resolveConditionalStyle } from './conditionalFormatting';

const range = { startRow: 0, startCol: 0, endRow: 5, endCol: 5 };

describe('conditional formatting priority', () => {
  it('lets higher-priority rules win overlapping style properties', () => {
    const style = resolveConditionalStyle([
      { id: 'low', type: 'greaterThan', value: '0', style: { backgroundColor: 'blue', color: 'white' }, range, priority: 2 },
      { id: 'high', type: 'greaterThan', value: '5', style: { backgroundColor: 'red' }, range, priority: 1 },
    ], 0, 0, 10);
    expect(style).toEqual({ backgroundColor: 'red', color: 'white' });
  });

  it('stops evaluating lower-priority rules when requested', () => {
    const style = resolveConditionalStyle([
      { id: 'high', type: 'greaterThan', value: '5', style: { backgroundColor: 'red' }, range, priority: 1, stopIfTrue: true },
      { id: 'low', type: 'greaterThan', value: '0', style: { color: 'white' }, range, priority: 2 },
    ], 0, 0, 10);
    expect(style).toEqual({ backgroundColor: 'red' });
  });

  it('ignores unmatched and out-of-range rules', () => {
    const rule = { id: 'rule', type: 'contains' as const, value: 'yes', style: { fontWeight: 'bold' as const }, range, priority: 1 };
    expect(resolveConditionalStyle([rule], 0, 0, 'no')).toEqual({});
    expect(resolveConditionalStyle([rule], 10, 10, 'yes')).toEqual({});
  });
});
