import { rewriteMergedRange } from './merged-range.util';

describe('merged range structural changes', () => {
  const range = { startRow: 2, startCol: 3, endRow: 4, endCol: 5 };

  it('moves a range when a row or column is inserted before it', () => {
    expect(
      rewriteMergedRange(range, { axis: 'row', type: 'insert', index: 2 }),
    ).toEqual({ ...range, startRow: 3, endRow: 5 });
    expect(
      rewriteMergedRange(range, { axis: 'column', type: 'insert', index: 1 }),
    ).toEqual({ ...range, startCol: 4, endCol: 6 });
  });

  it('expands a range when insertion occurs inside it', () => {
    expect(
      rewriteMergedRange(range, { axis: 'row', type: 'insert', index: 3 }),
    ).toEqual({ ...range, endRow: 5 });
    expect(
      rewriteMergedRange(range, { axis: 'column', type: 'insert', index: 5 }),
    ).toEqual({ ...range, endCol: 6 });
  });

  it('moves or shrinks ranges when rows and columns are deleted', () => {
    expect(
      rewriteMergedRange(range, { axis: 'row', type: 'delete', index: 1 }),
    ).toEqual({ ...range, startRow: 1, endRow: 3 });
    expect(
      rewriteMergedRange(range, { axis: 'column', type: 'delete', index: 4 }),
    ).toEqual({ ...range, endCol: 4 });
  });

  it('removes fully deleted and single-cell remnants', () => {
    expect(
      rewriteMergedRange(
        { startRow: 1, endRow: 1, startCol: 1, endCol: 2 },
        { axis: 'column', type: 'delete', index: 2 },
      ),
    ).toBeNull();
    expect(
      rewriteMergedRange(
        { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
        { axis: 'row', type: 'delete', index: 1 },
      ),
    ).toBeNull();
  });

  it('leaves a range unchanged when the edit follows it', () => {
    expect(
      rewriteMergedRange(range, { axis: 'row', type: 'delete', index: 9 }),
    ).toEqual(range);
  });
});
