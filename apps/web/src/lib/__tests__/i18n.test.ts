import { resolveLocale, translate } from '../i18n';

describe('localization', () => {
  it('resolves supported browser and profile locales', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('ko-KR')).toBe('ko');
    expect(resolveLocale('unsupported')).toBe('ko');
  });

  it('translates common interface messages', () => {
    expect(translate('ko', 'common.save')).toBe('저장');
    expect(translate('en', 'pwa.offline')).toContain('offline');
  });
});
