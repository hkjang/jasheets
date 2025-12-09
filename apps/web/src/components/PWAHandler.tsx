'use client';

import { useEffect } from 'react';
import { useServiceWorker, useOfflineSync } from '@/hooks/usePWA';
import Toast from './ui/Toast';
import { useState } from 'react';

export default function PWAHandler() {
  const { hasUpdate, update, installPrompt, promptInstall } = useServiceWorker();
  const { isOnline } = useOfflineSync();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (hasUpdate) {
      setToastMsg('New version available. Click to reload.');
    } else if (installPrompt) {
        setToastMsg('Install JaSheets for offline use.');
    }
  }, [hasUpdate, installPrompt]);

  useEffect(() => {
    if (!isOnline) {
      setToastMsg('You are offline. Changes will be saved locally.');
    }
    // Note: sync logic moved to avoid infinite loops
  }, [isOnline]);

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
