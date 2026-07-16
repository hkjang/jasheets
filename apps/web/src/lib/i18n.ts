export type Locale = 'ko' | 'en';

export const messages = {
  ko: {
    'profile.title': '프로필 편집',
    'profile.loading': '불러오는 중...',
    'profile.name': '이름',
    'profile.contact': '연락처',
    'profile.language': '언어',
    'profile.theme': '테마',
    'profile.korean': '한국어',
    'profile.english': '영어',
    'profile.light': '라이트',
    'profile.dark': '다크',
    'common.cancel': '취소',
    'common.save': '저장',
    'common.saving': '저장 중...',
    'profile.saveError': '프로필을 저장하지 못했습니다.',
    'pwa.update': '새 버전이 있습니다. 눌러서 다시 불러오세요.',
    'pwa.install': '오프라인 사용을 위해 JaSheets를 설치하세요.',
    'pwa.offline': '오프라인 상태입니다. 변경 사항은 기기에 저장됩니다.',
  },
  en: {
    'profile.title': 'Edit profile',
    'profile.loading': 'Loading...',
    'profile.name': 'Name',
    'profile.contact': 'Contact',
    'profile.language': 'Language',
    'profile.theme': 'Theme',
    'profile.korean': 'Korean',
    'profile.english': 'English',
    'profile.light': 'Light',
    'profile.dark': 'Dark',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving...',
    'profile.saveError': 'Failed to update profile.',
    'pwa.update': 'A new version is available. Select to reload.',
    'pwa.install': 'Install JaSheets for offline use.',
    'pwa.offline': 'You are offline. Changes will be saved on this device.',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function resolveLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key];
}
