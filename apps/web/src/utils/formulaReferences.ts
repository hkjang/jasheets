import { colIndexToLetter, letterToColIndex } from '@/types/spreadsheet';

export interface StructuralChange {
  axis: 'row' | 'column';
  type: 'insert' | 'delete';
  index: number;
}

interface ParsedReference {
  col: number;
  row: number;
  colAbsolute: boolean;
  rowAbsolute: boolean;
}

const REFERENCE = '(\\$?[A-Z]+\\$?[1-9][0-9]*)';
const REFERENCE_OR_RANGE = new RegExp(`(^|[^A-Z0-9_])${REFERENCE}(?::${REFERENCE})?(?![A-Z0-9_])`, 'gi');

function parseReference(value: string): ParsedReference {
  const match = value.match(/^(\$?)([A-Z]+)(\$?)([1-9][0-9]*)$/i)!;
  return {
    col: letterToColIndex(match[2].toUpperCase()),
    row: Number(match[4]) - 1,
    colAbsolute: match[1] === '$',
    rowAbsolute: match[3] === '$',
  };
}

function formatReference(ref: ParsedReference): string {
  return `${ref.colAbsolute ? '$' : ''}${colIndexToLetter(ref.col)}${ref.rowAbsolute ? '$' : ''}${ref.row + 1}`;
}

function coordinate(ref: ParsedReference, axis: StructuralChange['axis']): number {
  return axis === 'row' ? ref.row : ref.col;
}

function withCoordinate(ref: ParsedReference, axis: StructuralChange['axis'], value: number): ParsedReference {
  return axis === 'row' ? { ...ref, row: value } : { ...ref, col: value };
}

function rewriteSingle(ref: ParsedReference, change: StructuralChange): ParsedReference | null {
  const current = coordinate(ref, change.axis);
  if (change.type === 'insert') {
    return current >= change.index ? withCoordinate(ref, change.axis, current + 1) : ref;
  }
  if (current === change.index) return null;
  return current > change.index ? withCoordinate(ref, change.axis, current - 1) : ref;
}

function rewriteRange(start: ParsedReference, end: ParsedReference, change: StructuralChange): [ParsedReference, ParsedReference] | null {
  const startCoordinate = coordinate(start, change.axis);
  const endCoordinate = coordinate(end, change.axis);
  const low = Math.min(startCoordinate, endCoordinate);
  const high = Math.max(startCoordinate, endCoordinate);

  if (change.type === 'insert') {
    if (change.index <= low) {
      return [withCoordinate(start, change.axis, startCoordinate + 1), withCoordinate(end, change.axis, endCoordinate + 1)];
    }
    if (change.index <= high) {
      const expanded = endCoordinate >= startCoordinate ? endCoordinate + 1 : endCoordinate - 1;
      return [start, withCoordinate(end, change.axis, expanded)];
    }
    return [start, end];
  }

  if (change.index < low) {
    return [withCoordinate(start, change.axis, startCoordinate - 1), withCoordinate(end, change.axis, endCoordinate - 1)];
  }
  if (change.index > high) return [start, end];
  if (low === high) return null;
  const contracted = endCoordinate >= startCoordinate ? endCoordinate - 1 : endCoordinate + 1;
  return [start, withCoordinate(end, change.axis, contracted)];
}

export function rewriteFormulaForStructuralChange(formula: string, change: StructuralChange): string {
  let result = '';
  let segmentStart = 0;
  let quote: string | null = null;
  const rewriteSegment = (segment: string) => segment.replace(
    REFERENCE_OR_RANGE,
    (_match, prefix: string, startRaw: string, endRaw?: string) => {
      const start = parseReference(startRaw);
      if (endRaw) {
        const rewritten = rewriteRange(start, parseReference(endRaw), change);
        return rewritten ? `${prefix}${formatReference(rewritten[0])}:${formatReference(rewritten[1])}` : `${prefix}#REF!`;
      }
      const rewritten = rewriteSingle(start, change);
      return `${prefix}${rewritten ? formatReference(rewritten) : '#REF!'}`;
    },
  );

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (!quote && (char === '"' || char === "'")) {
      result += rewriteSegment(formula.slice(segmentStart, i));
      quote = char;
      segmentStart = i;
    } else if (quote && char === quote && formula[i - 1] !== '\\') {
      result += formula.slice(segmentStart, i + 1);
      quote = null;
      segmentStart = i + 1;
    }
  }
  const tail = formula.slice(segmentStart);
  return result + (quote ? tail : rewriteSegment(tail));
}
