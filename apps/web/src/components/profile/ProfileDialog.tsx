'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useLocalization } from '@/contexts/LocalizationContext';
import { resolveLocale } from '@/lib/i18n';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { locale, setLocale, t } = useLocalization();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState(locale);
  const [theme, setTheme] = useState('light');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const loadProfile = useCallback(async () => {
    setFetching(true);
    try {
      const data = await api.users.getProfile();
      setName(data.name || '');
      const profileLocale = resolveLocale(data.language);
      setLanguage(profileLocale);
      setLocale(profileLocale);
      setTheme(data.theme || 'light');
      setContact(data.contact || '');
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setFetching(false);
    }
  }, [setLocale]);

  useEffect(() => {
    if (isOpen) void loadProfile();
  }, [isOpen, loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.users.updateProfile({ name, language, theme, contact });
      setLocale(resolveLocale(language));
      onClose();
    } catch {
      alert(t('profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">{t('profile.title')}</h2>
        
        {fetching ? (
          <div>{t('profile.loading')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.name')}</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.contact')}</label>
              <input 
                type="text" 
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.language')}</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(resolveLocale(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ko">{t('profile.korean')}</option>
                    <option value="en">{t('profile.english')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.theme')}</label>
                  <select
                    value={theme}
                    onChange={e => setTheme(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="light">{t('profile.light')}</option>
                    <option value="dark">{t('profile.dark')}</option>
                  </select>
                </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
