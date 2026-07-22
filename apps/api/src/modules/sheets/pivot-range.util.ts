export interface PivotCoordinateRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface PivotRangeStructuralChange {
  axis: 'row' | 'column';
  type: 'insert' | 'delete';
  index: number;
}

function rewriteInterval(
  start: number,
  end: number,
  change: PivotRangeStructuralChange,
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

export function rewritePivotRange(
  range: PivotCoordinateRange,
  change: PivotRangeStructuralChange,
): PivotCoordinateRange | null {
  const interval =
    change.axis === 'row'
      ? rewriteInterval(range.startRow, range.endRow, change)
      : rewriteInterval(range.startCol, range.endCol, change);
  if (!interval) return null;
  return change.axis === 'row'
    ? { ...range, startRow: interval[0], endRow: interval[1] }
    : { ...range, startCol: interval[0], endCol: interval[1] };
}
