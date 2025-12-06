'use client';

import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [isReady, setIsReady] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        
        setRegistration(reg);
        setIsReady(true);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setHasUpdate(true);
            }
          });
        });
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    // Listen for controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const update = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  return {
    isReady,
    hasUpdate,
    update,
    registration,
    requestNotificationPermission,
  };
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addPendingChange = (change: any) => {
    setPendingChanges((prev) => [...prev, change]);
    // Also store in IndexedDB for persistence
    storeChange(change);
  };

  const syncChanges = async () => {
    if (pendingChanges.length === 0) return;

    try {
      // Request background sync
      if ('serviceWorker' in navigator && 'sync' in (window as any).SyncManager) {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('sync-spreadsheet');
      } else {
        // Fallback: sync immediately
        // await Promise.all(pendingChanges.map(sendChange));
        setPendingChanges([]);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const storeChange = async (change: any) => {
    // Store in IndexedDB
    // TODO: Implement IndexedDB storage
    console.log('Storing change:', change);
  };

  return {
    isOnline,
    pendingChanges,
    addPendingChange,
    syncChanges,
  };
}
