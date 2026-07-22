import {
  containsMergedCell,
  findMergedRange,
  findMergedRangeAnchor,
  getMergedRangeRect,
  hasMergedRangeConflict,
  mergedRangesOverlap,
  mergedRangeIntersects,
  normalizeMergedRange,
  normalizeMergedCellUpdate,
  rejectNonAnchorMergedUpdates,
  resolveMergedNavigationTarget,
  resolveMergedCell,
  sortRangeIntersectsMergedRanges,
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

  test('resolves merged hit targets and their full geometry', () => {
    expect(resolveMergedCell([range], 4, 5)).toEqual({
      position: { row: 2, col: 3 },
      range,
    });
    expect(resolveMergedCell([range], 9, 9)).toEqual({
      position: { row: 9, col: 9 },
    });
    expect(getMergedRangeRect(
      range,
      { offsets: [0, 20, 40, 60, 90, 130, 180], sizes: [20, 20, 20, 30, 40, 50] },
      { offsets: [0, 10, 25, 45, 70, 100], sizes: [10, 15, 20, 25, 30] },
      40,
      20,
    )).toEqual({ x: 100, y: 45, width: 120, height: 75 });
  });

  test('normalizes an unambiguous single-cell update to the merge anchor', () => {
    const update = { row: 4, col: 5, value: 'replacement', metadata: true };
    expect(normalizeMergedCellUpdate(update, [range])).toEqual({
      row: 2,
      col: 3,
      value: 'replacement',
      metadata: true,
    });
    expect(normalizeMergedCellUpdate(update, [])).toBe(update);
  });

  test('atomically rejects batch writes to non-anchor merged cells', () => {
    const safe = [
      { row: 2, col: 3, value: 'anchor' },
      { row: 7, col: 7, value: 'plain' },
    ];
    expect(rejectNonAnchorMergedUpdates(safe, [range])).toEqual(safe);
    expect(
      rejectNonAnchorMergedUpdates(
        [...safe, { row: 3, col: 3, value: 'hidden member' }],
        [range],
      ),
    ).toBeUndefined();
  });

  test('keyboard navigation skips the current merge and anchors the destination', () => {
    expect(
      resolveMergedNavigationTarget([range], { row: 2, col: 3 }, { row: 2, col: 4 }),
    ).toEqual({ position: { row: 2, col: 6 } });
    const destination = { startRow: 2, endRow: 3, startCol: 6, endCol: 7 };
    expect(
      resolveMergedNavigationTarget(
        [range, destination],
        { row: 2, col: 3 },
        { row: 2, col: 4 },
      ),
    ).toEqual({ position: { row: 2, col: 6 }, range: destination });
  });

  test('detects viewport intersections even when the merge anchor is offscreen', () => {
    expect(mergedRangeIntersects(range, 3, 8, 4, 8)).toBe(true);
    expect(mergedRangeIntersects(range, 5, 8, 4, 8)).toBe(false);
  });

  test('rejects sort rectangles that touch or cross a merged range', () => {
    expect(sortRangeIntersectsMergedRanges({
      start: { row: 4, col: 5 },
      end: { row: 8, col: 8 },
    }, [range])).toBe(true);
    expect(sortRangeIntersectsMergedRanges({
      start: { row: 8, col: 8 },
      end: { row: 4, col: 5 },
    }, [range])).toBe(true);
    expect(sortRangeIntersectsMergedRanges({
      start: { row: 0, col: 0 },
      end: { row: 1, col: 10 },
    }, [range])).toBe(false);
    expect(sortRangeIntersectsMergedRanges({
      start: { row: 2, col: 0 },
      end: { row: 4, col: 2 },
    }, [range])).toBe(false);
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
