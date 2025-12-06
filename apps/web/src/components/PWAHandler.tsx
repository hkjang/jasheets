'use client';

import { useEffect } from 'react';
import { useServiceWorker, useOfflineSync } from '@/hooks/usePWA';
import { useAuth } from '@/hooks/useAuth'; // Optional: if sync depends on auth
import Toast from './ui/Toast';
import { useState } from 'react';

export default function PWAHandler() {
  const { isReady, hasUpdate, update, installPrompt, promptInstall } = useServiceWorker();
  const { isOnline, pendingChanges, syncChanges } = useOfflineSync();
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
    } else {
        // If coming back online and having pending changes
        if (pendingChanges.length > 0) {
            setToastMsg('Back online. Syncing changes...');
            syncChanges().then(() => setToastMsg('Sync complete.'));
        }
    }
  }, [isOnline, pendingChanges, syncChanges]);

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
