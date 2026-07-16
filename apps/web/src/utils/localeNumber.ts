export interface LocaleSeparators {
  decimal: string;
  group: string;
  argument: ',' | ';';
}

export function getLocaleSeparators(locale: string): LocaleSeparators {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  return { decimal, group, argument: decimal === ',' ? ';' : ',' };
}

export function parseLocaleNumber(input: string, locale: string): number | null {
  const { decimal, group } = getLocaleSeparators(locale);
  const normalized = input.trim().replaceAll('\u00a0', '').replaceAll(' ', '')
    .replaceAll(group, '').replace(decimal, '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function normalizeLocalizedFormula(formula: string, locale: string): string {
  const { decimal, argument } = getLocaleSeparators(locale);
  if (decimal === '.' && argument === ',') return formula;
  let result = '';
  let quote: string | null = null;
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (quote) {
      result += char;
      if (char === quote && formula[i - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      result += char;
    } else if (char === decimal && /\d/.test(formula[i - 1] ?? '') && /\d/.test(formula[i + 1] ?? '')) {
      result += '.';
    } else {
      result += char === argument ? ',' : char;
    }
  }
  return result;
}
