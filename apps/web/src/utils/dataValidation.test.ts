import { validateCellInput } from './dataValidation';

describe('cell data validation', () => {
  it('validates allowed lists exactly', () => {
    const rule = { type: 'list' as const, values: ['대기', '완료'] };
    expect(validateCellInput('완료', rule)).toEqual({ valid: true });
    expect(validateCellInput('취소', rule)).toMatchObject({ valid: false });
  });

  it('validates localized numbers and boundaries', () => {
    const rule = { type: 'number' as const, min: 1, max: 10 };
    expect(validateCellInput('1,5', rule, 'de-DE')).toEqual({ valid: true });
    expect(validateCellInput('11', rule)).toMatchObject({ valid: false });
    expect(validateCellInput('text', rule)).toMatchObject({ valid: false });
  });

  it('validates percentages by their underlying numeric value', () => {
    const rule = { type: 'number' as const, min: 0.1, max: 0.5 };
    expect(validateCellInput('50%', rule)).toEqual({ valid: true });
    expect(validateCellInput('12,5%', rule, 'de-DE')).toEqual({ valid: true });
    expect(validateCellInput('51%', rule)).toMatchObject({ valid: false });
    expect(validateCellInput('not-a-number%', rule)).toMatchObject({ valid: false });
  });

  it('validates text length and required values', () => {
    expect(validateCellInput('abc', { type: 'textLength', min: 2, max: 4 })).toEqual({ valid: true });
    expect(validateCellInput('abcde', { type: 'textLength', max: 4 })).toMatchObject({ valid: false });
    expect(validateCellInput('', { type: 'list', values: ['A'], allowBlank: false })).toMatchObject({ valid: false });
  });
});
