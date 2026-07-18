import {
  containsMergedCell,
  findMergedRange,
  findMergedRangeAnchor,
  hasMergedRangeConflict,
  mergedRangesOverlap,
  normalizeMergedRange,
  shiftMergedRanges,
  type MergedRange,
} from './mergedRanges';

const range: MergedRange = {
  startRow: 2,
  endRow: 4,
  startCol: 3,
  endCol: 5,
};

describe('mergedRanges', () => {
  test('normalizes a backwards selection and rejects invalid coordinates', () => {
    expect(
      normalizeMergedRange({ startRow: 4, endRow: 2, startCol: 5, endCol: 3 }),
    ).toEqual(range);
    expect(() => normalizeMergedRange({ ...range, startRow: -1 })).toThrow(
      RangeError,
    );
    expect(() => normalizeMergedRange({ ...range, endCol: 1.5 })).toThrow(
      RangeError,
    );
  });

  test('detects inclusive overlap without treating adjacent ranges as conflicts', () => {
    expect(mergedRangesOverlap(range, { ...range, startRow: 4 })).toBe(true);
    expect(
      mergedRangesOverlap(range, {
        startRow: 2,
        endRow: 4,
        startCol: 6,
        endCol: 8,
      }),
    ).toBe(false);
    expect(hasMergedRangeConflict(range, [{ ...range }])).toBe(true);

    const existing = { ...range };
    expect(hasMergedRangeConflict(range, [existing], existing)).toBe(false);
  });

  test('finds membership, the original range, and its top-left anchor', () => {
    expect(containsMergedCell(range, 4, 5)).toBe(true);
    expect(containsMergedCell(range, 5, 5)).toBe(false);
    expect(findMergedRange([range], 3, 4)).toBe(range);
    expect(findMergedRangeAnchor([range], 3, 4)).toEqual({ row: 2, col: 3 });
    expect(findMergedRangeAnchor([range], 0, 0)).toBeUndefined();
  });

  test('moves ranges after an insertion and expands ranges containing it', () => {
    expect(
      shiftMergedRanges([range], { axis: 'row', type: 'insert', index: 2 }),
    ).toEqual([{ ...range, startRow: 3, endRow: 5 }]);
    expect(
      shiftMergedRanges([range], {
        axis: 'col',
        type: 'insert',
        index: 4,
        count: 2,
      }),
    ).toEqual([{ ...range, endCol: 7 }]);
    expect(
      shiftMergedRanges([range], { axis: 'row', type: 'insert', index: 8 }),
    ).toEqual([range]);
  });

  test('shrinks partially deleted ranges and moves ranges after deletion', () => {
    expect(
      shiftMergedRanges([range], { axis: 'row', type: 'delete', index: 3 }),
    ).toEqual([{ ...range, endRow: 3 }]);
    expect(
      shiftMergedRanges([range], {
        axis: 'col',
        type: 'delete',
        index: 1,
        count: 2,
      }),
    ).toEqual([{ ...range, startCol: 1, endCol: 3 }]);
    expect(
      shiftMergedRanges([range], {
        axis: 'row',
        type: 'delete',
        index: 0,
        count: 3,
      }),
    ).toEqual([{ ...range, startRow: 0, endRow: 1 }]);
  });

  test('removes fully deleted and single-cell remnants', () => {
    expect(
      shiftMergedRanges([range], {
        axis: 'row',
        type: 'delete',
        index: 1,
        count: 5,
      }),
    ).toEqual([]);
    expect(
      shiftMergedRanges(
        [{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }],
        { axis: 'col', type: 'delete', index: 2 },
      ),
    ).toEqual([]);
  });

  test('validates structural operation indices and counts', () => {
    expect(() =>
      shiftMergedRanges([range], { axis: 'row', type: 'insert', index: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      shiftMergedRanges([range], {
        axis: 'row',
        type: 'delete',
        index: 1,
        count: 0,
      }),
    ).toThrow(RangeError);
  });
});
