'use client';

import { useEffect, useState } from 'react';
import { useServiceWorker, useOfflineSync } from '@/hooks/usePWA';
import Toast from './ui/Toast';

export default function PWAHandler() {
  // Skip PWA functionality entirely in development
  const isDev = process.env.NODE_ENV === 'development';
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Call hooks unconditionally to satisfy React rules
  const serviceWorker = useServiceWorker();
  const offlineSync = useOfflineSync();
  
  const { hasUpdate, update, installPrompt, promptInstall } = serviceWorker;
  const { isOnline } = offlineSync;

  useEffect(() => {
    // Skip in development
    if (isDev) return;
    
    if (hasUpdate) {
      setToastMsg('New version available. Click to reload.');
    } else if (installPrompt) {
      setToastMsg('Install JaSheets for offline use.');
    }
  }, [hasUpdate, installPrompt, isDev]);

  useEffect(() => {
    // Skip in development
    if (isDev) return;
    
    if (!isOnline) {
      setToastMsg('You are offline. Changes will be saved locally.');
    }
  }, [isOnline, isDev]);

  // Skip rendering in development
  if (isDev) {
    return null;
  }

  const handleToastClose = () => {
    setToastMsg(null);
  };

  const handleToastClick = () => {
    if (hasUpdate) {
      update();
      window.location.reload();
    } else if (installPrompt) {
      promptInstall();
      setToastMsg(null);
    }
  };

  if (!toastMsg) return null;

  return (
    <div onClick={handleToastClick} style={{ cursor: 'pointer' }}>
      <Toast message={toastMsg} onClose={handleToastClose} />
    </div>
  );
}
