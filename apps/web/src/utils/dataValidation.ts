import { DataValidationRule } from '@/types/spreadsheet';
import { parseLocaleNumber } from './localeNumber';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateCellInput(
  input: string,
  rule: DataValidationRule,
  locale: string = 'en-US',
): ValidationResult {
  if (input.trim() === '') {
    return rule.allowBlank === false
      ? { valid: false, message: '빈 값은 허용되지 않습니다.' }
      : { valid: true };
  }

  if (rule.type === 'list') {
    const valid = rule.values.some((value) => value === input);
    return valid
      ? { valid: true }
      : { valid: false, message: `허용된 값: ${rule.values.join(', ')}` };
  }

  if (rule.type === 'number') {
    const trimmed = input.trim();
    const isPercentage = trimmed.endsWith('%');
    const parsed = parseLocaleNumber(
      isPercentage ? trimmed.slice(0, -1) : trimmed,
      locale,
    );
    const value = parsed !== null && isPercentage ? parsed / 100 : parsed;
    if (value === null) return { valid: false, message: '숫자를 입력해주세요.' };
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, message: `${rule.min} 이상의 값을 입력해주세요.` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, message: `${rule.max} 이하의 값을 입력해주세요.` };
    }
    return { valid: true };
  }

  if (rule.min !== undefined && input.length < rule.min) {
    return { valid: false, message: `${rule.min}자 이상 입력해주세요.` };
  }
  if (rule.max !== undefined && input.length > rule.max) {
    return { valid: false, message: `${rule.max}자 이하로 입력해주세요.` };
  }
  return { valid: true };
}
