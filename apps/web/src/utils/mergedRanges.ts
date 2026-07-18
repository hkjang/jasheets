export interface MergedRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface MergedRangeStructureChange {
  axis: 'row' | 'col';
  type: 'insert' | 'delete';
  index: number;
  count?: number;
}

function assertGridIndex(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

/** Returns a canonical range regardless of the direction it was selected in. */
export function normalizeMergedRange(range: MergedRange): MergedRange {
  assertGridIndex(range.startRow, 'startRow');
  assertGridIndex(range.endRow, 'endRow');
  assertGridIndex(range.startCol, 'startCol');
  assertGridIndex(range.endCol, 'endCol');

  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

export function containsMergedCell(
  range: MergedRange,
  row: number,
  col: number,
): boolean {
  const normalized = normalizeMergedRange(range);
  return (
    row >= normalized.startRow &&
    row <= normalized.endRow &&
    col >= normalized.startCol &&
    col <= normalized.endCol
  );
}

export function mergedRangesOverlap(a: MergedRange, b: MergedRange): boolean {
  const first = normalizeMergedRange(a);
  const second = normalizeMergedRange(b);
  return !(
    first.endRow < second.startRow ||
    second.endRow < first.startRow ||
    first.endCol < second.startCol ||
    second.endCol < first.startCol
  );
}

export function hasMergedRangeConflict(
  candidate: MergedRange,
  ranges: readonly MergedRange[],
  ignoredRange?: MergedRange,
): boolean {
  return ranges.some(
    (range) => range !== ignoredRange && mergedRangesOverlap(candidate, range),
  );
}

export function findMergedRange(
  ranges: readonly MergedRange[],
  row: number,
  col: number,
): MergedRange | undefined {
  return ranges.find((range) => containsMergedCell(range, row, col));
}

export function findMergedRangeAnchor(
  ranges: readonly MergedRange[],
  row: number,
  col: number,
): CellPosition | undefined {
  const range = findMergedRange(ranges, row, col);
  if (!range) return undefined;
  const normalized = normalizeMergedRange(range);
  return { row: normalized.startRow, col: normalized.startCol };
}

function shiftInterval(
  start: number,
  end: number,
  change: MergedRangeStructureChange,
): [number, number] | undefined {
  const count = change.count ?? 1;
  assertGridIndex(change.index, 'index');
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('count must be a positive integer');
  }

  if (change.type === 'insert') {
    if (change.index <= start) return [start + count, end + count];
    if (change.index <= end) return [start, end + count];
    return [start, end];
  }

  const deletedEnd = change.index + count - 1;
  if (end < change.index) return [start, end];
  if (start > deletedEnd) return [start - count, end - count];

  const hasLeft = start < change.index;
  const hasRight = end > deletedEnd;
  if (!hasLeft && !hasRight) return undefined;

  return [hasLeft ? start : change.index, hasRight ? end - count : change.index - 1];
}

/**
 * Rewrites merged ranges after rows or columns are inserted/deleted. Ranges that
 * collapse to a single cell (or are fully deleted) are omitted.
 */
export function shiftMergedRanges(
  ranges: readonly MergedRange[],
  change: MergedRangeStructureChange,
): MergedRange[] {
  return ranges.flatMap((range) => {
    const normalized = normalizeMergedRange(range);
    const interval =
      change.axis === 'row'
        ? shiftInterval(normalized.startRow, normalized.endRow, change)
        : shiftInterval(normalized.startCol, normalized.endCol, change);
    if (!interval) return [];

    const shifted =
      change.axis === 'row'
        ? { ...normalized, startRow: interval[0], endRow: interval[1] }
        : { ...normalized, startCol: interval[0], endCol: interval[1] };

    if (
      shifted.startRow === shifted.endRow &&
      shifted.startCol === shifted.endCol
    ) {
      return [];
    }
    return [shifted];
  });
}
