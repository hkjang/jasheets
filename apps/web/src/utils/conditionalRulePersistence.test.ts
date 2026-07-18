import {
  deserializeConditionalRule,
  serializeConditionalRule,
} from './conditionalRulePersistence';

describe('conditional rule persistence', () => {
  it('round-trips editor rules through the API representation', () => {
    const serialized = serializeConditionalRule({
      id: 'local',
      type: 'between',
      value: '10',
      value2: '20',
      style: { backgroundColor: '#ffeeaa', fontWeight: 'bold' },
      range: { startRow: 1, startCol: 2, endRow: 4, endCol: 3 },
      priority: 2,
      stopIfTrue: true,
    });

    expect(serialized.ranges).toEqual(['C2:D5']);
    expect(deserializeConditionalRule({ id: 'saved', ...serialized })).toEqual({
      id: 'saved',
      type: 'between',
      value: '10',
      value2: '20',
      style: { backgroundColor: '#ffeeaa', fontWeight: 'bold' },
      range: { startRow: 1, startCol: 2, endRow: 4, endCol: 3 },
      priority: 2,
      stopIfTrue: true,
    });
  });

  it('ignores inactive or malformed persisted rules', () => {
    const base = {
      id: 'bad',
      name: 'bad',
      priority: 0,
      ranges: ['not-a-range'],
      conditions: { type: 'greaterThan', value: '1' },
      format: {},
      active: true,
    };
    expect(deserializeConditionalRule(base)).toBeNull();
    expect(deserializeConditionalRule({ ...base, ranges: ['A1'], active: false })).toBeNull();
  });
});
