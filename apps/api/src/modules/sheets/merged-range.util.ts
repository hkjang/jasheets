export interface StoredMergedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface MergedRangeStructuralChange {
  axis: 'row' | 'column';
  type: 'insert' | 'delete';
  index: number;
}

function rewriteInterval(
  start: number,
  end: number,
  change: MergedRangeStructuralChange,
): [number, number] | null {
  if (change.type === 'insert') {
    if (change.index <= start) return [start + 1, end + 1];
    if (change.index <= end) return [start, end + 1];
    return [start, end];
  }

  if (change.index < start) return [start - 1, end - 1];
  if (change.index > end) return [start, end];
  if (start === end) return null;
  return [start, end - 1];
}

/**
 * Rewrites a canonical, inclusive merged-cell range after one structural edit.
 * A range is removed when the edit deletes it or leaves only its anchor cell.
 */
export function rewriteMergedRange(
  range: StoredMergedRange,
  change: MergedRangeStructuralChange,
): StoredMergedRange | null {
  const interval =
    change.axis === 'row'
      ? rewriteInterval(range.startRow, range.endRow, change)
      : rewriteInterval(range.startCol, range.endCol, change);
  if (!interval) return null;

  const rewritten =
    change.axis === 'row'
      ? { ...range, startRow: interval[0], endRow: interval[1] }
      : { ...range, startCol: interval[0], endCol: interval[1] };
  return rewritten.startRow === rewritten.endRow &&
    rewritten.startCol === rewritten.endCol
    ? null
    : rewritten;
}
