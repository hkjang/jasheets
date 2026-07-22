import { containsPivotOutput, parseTargetCell, persistThenApplyPivotOutput, replacePivotOutput } from './managedPivots';

describe('managed pivots', () => {
  it('parses strict A1 target cells', () => {
    expect(parseTargetCell('AA12')).toEqual({ row: 11, col: 26 });
    expect(parseTargetCell('A0')).toBeNull();
    expect(parseTargetCell('1A')).toBeNull();
  });

  it('clears exactly the previous output before writing a resized result', () => {
    const result = replacePivotOutput(
      { 0: { 0: { value: 'keep' } }, 4: { 4: { value: 'old' }, 5: { value: 'old' } } },
      { startRow: 4, startCol: 4, endRow: 4, endCol: 5 },
      'E5',
      { 0: { 0: { value: 'new' } } },
    );
    expect(result.data).toEqual({ 0: { 0: { value: 'keep' } }, 4: { 4: { value: 'new' } } });
    expect(result.outputRange).toEqual({ startRow: 4, startCol: 4, endRow: 4, endCol: 4 });
  });

  it('recognizes protected output cells', () => {
    expect(containsPivotOutput({ config: {
      sourceRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      rows: [], cols: [], values: [{ field: 'A', aggregation: 'COUNT' }],
      outputRange: { startRow: 5, startCol: 2, endRow: 7, endCol: 4 },
    } }, 6, 3)).toBe(true);
  });

  it('does not mutate output when definition persistence fails', async () => {
    const apply = jest.fn();
    await expect(persistThenApplyPivotOutput(
      () => Promise.reject(new Error('version conflict')),
      apply,
    )).rejects.toThrow('version conflict');
    expect(apply).not.toHaveBeenCalled();
  });
});
