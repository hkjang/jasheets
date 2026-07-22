import { evaluateFormula } from '@jasheets/formula-engine';
import { parseInput } from './inputParser';
import { getLocaleSeparators, normalizeLocalizedFormula, parseLocaleNumber } from './localeNumber';

describe('locale-aware number and formula parsing', () => {
  it('discovers separators', () => {
    expect(getLocaleSeparators('en-US')).toEqual({ decimal: '.', group: ',', argument: ',' });
    expect(getLocaleSeparators('de-DE')).toEqual({ decimal: ',', group: '.', argument: ';' });
  });

  it('parses localized numbers', () => {
    expect(parseLocaleNumber('1,234.5', 'en-US')).toBe(1234.5);
    expect(parseLocaleNumber('1.234,5', 'de-DE')).toBe(1234.5);
    expect(parseInput('12,5%', 'de-DE')).toEqual({ value: 0.125, format: 'percent' });
    expect(parseInput('1.234,50', 'de-DE')).toEqual({ value: 1234.5, format: 'number' });
  });

  it('normalizes formula separators outside strings', () => {
    expect(normalizeLocalizedFormula('=SUM(1,5;2,5)', 'de-DE')).toBe('=SUM(1.5,2.5)');
    expect(normalizeLocalizedFormula('=IFERROR(1;"1,5")', 'de-DE')).toBe('=IFERROR(1,"1,5")');
  });

  it('evaluates localized formulas', () => {
    expect(evaluateFormula('=SUM(1,5;2,5)', {}, {}, 'de-DE')).toBe(4);
    expect(evaluateFormula('=DATE(2024;1;1)+1', {}, {}, 'de-DE')).toBe(45293);
  });
});
