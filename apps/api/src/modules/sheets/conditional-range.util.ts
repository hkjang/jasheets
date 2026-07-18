export interface RangeStructuralChange {
  axis: 'row' | 'column';
  type: 'insert' | 'delete';
  index: number;
}

interface Coordinate {
  row: number;
  col: number;
  rowAbsolute: boolean;
  colAbsolute: boolean;
}

const A1_RANGE = /^(\$?)([A-Z]+)(\$?)([1-9][0-9]*)(?::(\$?)([A-Z]+)(\$?)([1-9][0-9]*))?$/i;

function columnToIndex(value: string): number {
  let index = 0;
  for (const char of value.toUpperCase()) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function indexToColumn(index: number): string {
  let value = '';
  for (let current = index + 1; current > 0; current = Math.floor((current - 1) / 26)) {
    value = String.fromCharCode(((current - 1) % 26) + 65) + value;
  }
  return value;
}

function formatCoordinate(value: Coordinate): string {
  return `${value.colAbsolute ? '$' : ''}${indexToColumn(value.col)}${value.rowAbsolute ? '$' : ''}${value.row + 1}`;
}

function axisValue(value: Coordinate, axis: RangeStructuralChange['axis']): number {
  return axis === 'row' ? value.row : value.col;
}

function withAxis(
  value: Coordinate,
  axis: RangeStructuralChange['axis'],
  coordinate: number,
): Coordinate {
  return axis === 'row' ? { ...value, row: coordinate } : { ...value, col: coordinate };
}

export function rewriteConditionalRange(
  range: string,
  change: RangeStructuralChange,
): string | null {
  const match = range.match(A1_RANGE);
  if (!match) return range;
  const start: Coordinate = {
    colAbsolute: match[1] === '$',
    col: columnToIndex(match[2]),
    rowAbsolute: match[3] === '$',
    row: Number(match[4]) - 1,
  };
  const end: Coordinate = match[6]
    ? {
        colAbsolute: match[5] === '$',
        col: columnToIndex(match[6]),
        rowAbsolute: match[7] === '$',
        row: Number(match[8]) - 1,
      }
    : start;
  const startValue = axisValue(start, change.axis);
  const endValue = axisValue(end, change.axis);
  const low = Math.min(startValue, endValue);
  const high = Math.max(startValue, endValue);
  let rewrittenStart = start;
  let rewrittenEnd = end;

  if (change.type === 'insert') {
    if (change.index <= low) {
      rewrittenStart = withAxis(start, change.axis, startValue + 1);
      rewrittenEnd = withAxis(end, change.axis, endValue + 1);
    } else if (change.index <= high) {
      rewrittenEnd = withAxis(
        end,
        change.axis,
        endValue >= startValue ? endValue + 1 : endValue - 1,
      );
    }
  } else if (change.index < low) {
    rewrittenStart = withAxis(start, change.axis, startValue - 1);
    rewrittenEnd = withAxis(end, change.axis, endValue - 1);
  } else if (change.index <= high) {
    if (low === high) return null;
    rewrittenEnd = withAxis(
      end,
      change.axis,
      endValue >= startValue ? endValue - 1 : endValue + 1,
    );
  }

  const formattedStart = formatCoordinate(rewrittenStart);
  const formattedEnd = formatCoordinate(rewrittenEnd);
  return match[6] || formattedStart !== formattedEnd
    ? `${formattedStart}:${formattedEnd}`
    : formattedStart;
}

export function rewriteConditionalRanges(
  ranges: string[],
  change: RangeStructuralChange,
): string[] {
  return ranges
    .map((range) => rewriteConditionalRange(range, change))
    .filter((range): range is string => range !== null);
}

