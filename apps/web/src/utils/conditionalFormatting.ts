import { CellStyle, CellValue } from '@/types/spreadsheet';

export interface ConditionalRule {
  id: string;
  type: 'greaterThan' | 'lessThan' | 'equalTo' | 'contains' | 'between';
  value: string;
  value2?: string;
  style: CellStyle;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
  priority?: number;
  stopIfTrue?: boolean;
}

export function matchesConditionalRule(rule: ConditionalRule, value: CellValue): boolean {
  const numericValue = typeof value === 'number' ? value : Number.NaN;
  const first = Number(rule.value);
  const second = Number(rule.value2);
  switch (rule.type) {
    case 'greaterThan': return Number.isFinite(numericValue) && numericValue > first;
    case 'lessThan': return Number.isFinite(numericValue) && numericValue < first;
    case 'equalTo': return String(value ?? '') === rule.value;
    case 'contains': return String(value ?? '').includes(rule.value);
    case 'between': return Number.isFinite(numericValue) && numericValue >= first && numericValue <= second;
  }
}

export function resolveConditionalStyle(
  rules: ConditionalRule[],
  row: number,
  col: number,
  value: CellValue,
): CellStyle {
  const ordered = [...rules].sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
  let style: CellStyle = {};
  for (const rule of ordered) {
    const inRange = row >= Math.min(rule.range.startRow, rule.range.endRow)
      && row <= Math.max(rule.range.startRow, rule.range.endRow)
      && col >= Math.min(rule.range.startCol, rule.range.endCol)
      && col <= Math.max(rule.range.startCol, rule.range.endCol);
    if (!inRange || !matchesConditionalRule(rule, value)) continue;
    // Earlier (lower number) rules have higher priority. Lower-priority rules
    // can fill unspecified style fields but cannot overwrite them.
    style = { ...rule.style, ...style };
    if (rule.stopIfTrue) break;
  }
  return style;
}
