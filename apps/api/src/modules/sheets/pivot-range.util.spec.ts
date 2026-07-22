import { rewritePivotRange } from './pivot-range.util';

describe('rewritePivotRange', () => {
  const range = { startRow: 2, startCol: 3, endRow: 5, endCol: 7 };

  it('moves a range when inserting before it', () => {
    expect(
      rewritePivotRange(range, { axis: 'row', type: 'insert', index: 1 }),
    ).toEqual({ ...range, startRow: 3, endRow: 6 });
  });

  it('expands a range when inserting inside it', () => {
    expect(
      rewritePivotRange(range, { axis: 'column', type: 'insert', index: 5 }),
    ).toEqual({ ...range, endCol: 8 });
  });

  it('shrinks a range when deleting inside it', () => {
    expect(
      rewritePivotRange(range, { axis: 'row', type: 'delete', index: 3 }),
    ).toEqual({ ...range, endRow: 4 });
  });

  it('removes a single-cell range when its coordinate is deleted', () => {
    expect(
      rewritePivotRange(
        { startRow: 4, startCol: 6, endRow: 4, endCol: 6 },
        { axis: 'column', type: 'delete', index: 6 },
      ),
    ).toBeNull();
  });
});
