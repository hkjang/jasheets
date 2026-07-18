import { colIndexToLetter, letterToColIndex } from '@/types/spreadsheet';
import type { ConditionalRule } from './conditionalFormatting';

export interface PersistedConditionalRule {
  id: string;
  name: string;
  priority: number;
  ranges: string[];
  conditions: unknown;
  format: unknown;
  active: boolean;
}

interface StoredCondition {
  type?: ConditionalRule['type'];
  value?: unknown;
  value2?: unknown;
  stopIfTrue?: unknown;
}

const CELL_RANGE = /^\$?([A-Z]+)\$?([1-9][0-9]*)(?::\$?([A-Z]+)\$?([1-9][0-9]*))?$/i;
const TYPES = new Set<ConditionalRule['type']>([
  'greaterThan',
  'lessThan',
  'equalTo',
  'contains',
  'between',
]);

export function serializeConditionalRule(rule: ConditionalRule) {
  const { startRow, startCol, endRow, endCol } = rule.range;
  return {
    name: `Conditional format ${rule.priority ?? 0}`,
    priority: rule.priority ?? 0,
    ranges: [
      `${colIndexToLetter(startCol)}${startRow + 1}:${colIndexToLetter(endCol)}${endRow + 1}`,
    ],
    conditions: {
      type: rule.type,
      value: rule.value,
      value2: rule.value2,
      stopIfTrue: rule.stopIfTrue ?? false,
    },
    format: rule.style,
    active: true,
  };
}

export function deserializeConditionalRule(
  stored: PersistedConditionalRule,
): ConditionalRule | null {
  if (!stored.active) return null;
  const match = stored.ranges[0]?.match(CELL_RANGE);
  if (!match) return null;
  const condition = stored.conditions as StoredCondition | null;
  if (!condition?.type || !TYPES.has(condition.type)) return null;
  const style = stored.format;
  if (!style || typeof style !== 'object' || Array.isArray(style)) return null;

  return {
    id: stored.id,
    type: condition.type,
    value: String(condition.value ?? ''),
    value2: condition.value2 === undefined ? undefined : String(condition.value2),
    style: style as ConditionalRule['style'],
    range: {
      startCol: letterToColIndex(match[1].toUpperCase()),
      startRow: Number(match[2]) - 1,
      endCol: letterToColIndex((match[3] ?? match[1]).toUpperCase()),
      endRow: Number(match[4] ?? match[2]) - 1,
    },
    priority: stored.priority,
    stopIfTrue: condition.stopIfTrue === true,
  };
}
