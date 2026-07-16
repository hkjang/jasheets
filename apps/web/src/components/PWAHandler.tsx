'use client';

import { useState } from 'react';
import { useServiceWorker, useOfflineSync } from '@/hooks/usePWA';
import Toast from './ui/Toast';
import { useLocalization } from '@/contexts/LocalizationContext';

export default function PWAHandler() {
  // Skip PWA functionality entirely in development
  const isDev = process.env.NODE_ENV === 'development';
  
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const { t } = useLocalization();
  
  // Call hooks unconditionally to satisfy React rules
  const serviceWorker = useServiceWorker();
  const offlineSync = useOfflineSync();
  
  const { hasUpdate, update, installPrompt, promptInstall } = serviceWorker;
  const { isOnline } = offlineSync;

  const activeMessage = isDev
    ? null
    : hasUpdate
      ? t('pwa.update')
      : !isOnline
        ? t('pwa.offline')
        : installPrompt
          ? t('pwa.install')
          : null;
  const toastMsg = activeMessage === dismissedMessage ? null : activeMessage;

  // Skip rendering in development
  if (isDev) {
    return null;
  }

  const handleToastClose = () => {
    setDismissedMessage(activeMessage);
  };

  const handleToastClick = () => {
    if (hasUpdate) {
      update();
      window.location.reload();
    } else if (installPrompt) {
      promptInstall();
      setDismissedMessage(activeMessage);
    }
  };

  if (!toastMsg) return null;

  return (
    <div onClick={handleToastClick} style={{ cursor: 'pointer' }}>
      <Toast message={toastMsg} onClose={handleToastClose} />
    </div>
  );
}
