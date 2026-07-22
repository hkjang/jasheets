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

export interface CellRangeLike {
  start: CellPosition;
  end: CellPosition;
}

export interface MergedCellUpdate extends CellPosition {
  value: string;
}

export interface GridAxisGeometry {
  offsets: readonly number[];
  sizes: readonly number[];
}

export interface MergedCellResolution {
  position: CellPosition;
  range?: MergedRange;
}

export interface MergedRangeRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

/** Resolves any cell inside a merge to its top-left, editable anchor. */
export function resolveMergedCell(
  ranges: readonly MergedRange[],
  row: number,
  col: number,
): MergedCellResolution {
  const range = findMergedRange(ranges, row, col);
  if (!range) return { position: { row, col } };
  const normalized = normalizeMergedRange(range);
  return {
    position: { row: normalized.startRow, col: normalized.startCol },
    range: normalized,
  };
}

/**
 * Normalizes a single-cell edit to the editable anchor of a merged range.
 * This is intended for direct edits whose target is unambiguous (for example,
 * typing after clicking any part of a merged cell).
 */
export function normalizeMergedCellUpdate<T extends MergedCellUpdate>(
  update: T,
  ranges: readonly MergedRange[],
): T {
  const { position } = resolveMergedCell(ranges, update.row, update.col);
  return position.row === update.row && position.col === update.col
    ? update
    : { ...update, ...position };
}

/**
 * Rejects a rectangular/batch write when it would address a non-anchor cell.
 * Silently collapsing those writes onto an anchor can overwrite earlier values
 * in the same paste or fill operation, so callers must treat undefined as an
 * atomic rejection of the whole operation.
 */
export function rejectNonAnchorMergedUpdates<T extends CellPosition>(
  updates: readonly T[],
  ranges: readonly MergedRange[],
): T[] | undefined {
  for (const update of updates) {
    const anchor = findMergedRangeAnchor(ranges, update.row, update.col);
    if (anchor && (anchor.row !== update.row || anchor.col !== update.col)) {
      return undefined;
    }
  }
  return [...updates];
}

/** Skips across the current merge, then anchors a merge at the destination. */
export function resolveMergedNavigationTarget(
  ranges: readonly MergedRange[],
  current: CellPosition,
  requested: CellPosition,
): MergedCellResolution {
  const currentRange = findMergedRange(ranges, current.row, current.col);
  let target = requested;
  if (currentRange && containsMergedCell(currentRange, requested.row, requested.col)) {
    const normalized = normalizeMergedRange(currentRange);
    const rowDelta = requested.row - current.row;
    const colDelta = requested.col - current.col;
    if (rowDelta > 0) target = { row: normalized.endRow + 1, col: current.col };
    else if (rowDelta < 0) target = { row: normalized.startRow - 1, col: current.col };
    else if (colDelta > 0) target = { row: current.row, col: normalized.endCol + 1 };
    else if (colDelta < 0) target = { row: current.row, col: normalized.startCol - 1 };
  }
  return resolveMergedCell(ranges, target.row, target.col);
}

/** Returns the full pixel rectangle, including a merge whose anchor is offscreen. */
export function getMergedRangeRect(
  range: MergedRange,
  columns: GridAxisGeometry,
  rows: GridAxisGeometry,
  originX = 0,
  originY = 0,
): MergedRangeRect {
  const normalized = normalizeMergedRange(range);
  const left = columns.offsets[normalized.startCol];
  const right = columns.offsets[normalized.endCol + 1];
  const top = rows.offsets[normalized.startRow];
  const bottom = rows.offsets[normalized.endRow + 1];
  return {
    x: originX + left,
    y: originY + top,
    width: right - left,
    height: bottom - top,
  };
}

export function mergedRangeIntersects(
  range: MergedRange,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): boolean {
  const normalized = normalizeMergedRange(range);
  return !(
    normalized.endRow < startRow ||
    normalized.startRow > endRow ||
    normalized.endCol < startCol ||
    normalized.startCol > endCol
  );
}

/**
 * Sorting moves cells independently from persisted merge geometry. Until merge
 * geometry can be moved atomically with the sorted rows, reject every sort
 * rectangle that touches a merge (including a merge that only crosses an edge).
 */
export function sortRangeIntersectsMergedRanges(
  sortRange: CellRangeLike,
  ranges: readonly MergedRange[],
): boolean {
  const startRow = Math.min(sortRange.start.row, sortRange.end.row);
  const endRow = Math.max(sortRange.start.row, sortRange.end.row);
  const startCol = Math.min(sortRange.start.col, sortRange.end.col);
  const endCol = Math.max(sortRange.start.col, sortRange.end.col);

  assertGridIndex(startRow, 'sortRange.startRow');
  assertGridIndex(endRow, 'sortRange.endRow');
  assertGridIndex(startCol, 'sortRange.startCol');
  assertGridIndex(endCol, 'sortRange.endCol');

  return ranges.some((range) =>
    mergedRangeIntersects(range, startRow, endRow, startCol, endCol),
  );
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
