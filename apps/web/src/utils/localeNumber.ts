import { getLocaleSeparators } from '@jasheets/formula-engine';

export { getLocaleSeparators, normalizeLocalizedFormula } from '@jasheets/formula-engine';
export type { LocaleSeparators } from '@jasheets/formula-engine';

export function parseLocaleNumber(input: string, locale: string): number | null {
  const { decimal, group } = getLocaleSeparators(locale);
  const normalized = input.trim().replaceAll('\u00a0', '').replaceAll(' ', '')
    .replaceAll(group, '').replace(decimal, '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
