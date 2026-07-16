'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  IndexedDbChangeStore,
  OfflineChange,
  OfflineChangeQueue,
} from '@/utils/offlineChangeQueue';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useServiceWorker() {
  const [isReady, setIsReady] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Capture the install prompt
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      // In development, unregister any existing service workers to avoid caching issues
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
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

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const update = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
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
    installPrompt: deferredPrompt,
    promptInstall,
  };
}

export function useOfflineSync<T = unknown>(sendChange?: (change: T) => Promise<void>) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState<OfflineChange<T>[]>([]);
  const queueRef = useRef<OfflineChangeQueue<T> | null>(null);

  const getQueue = useCallback(() => {
    if (!queueRef.current) {
      queueRef.current = new OfflineChangeQueue(new IndexedDbChangeStore<T>());
    }
    return queueRef.current;
  }, []);

  const refreshChanges = useCallback(async () => {
    if (typeof indexedDB === 'undefined') return;
    setPendingChanges(await getQueue().list());
  }, [getQueue]);

  const syncChanges = useCallback(async () => {
    if (!isOnline || typeof indexedDB === 'undefined') return;
    try {
      const queued = await getQueue().list();
      setPendingChanges(queued);
      if (queued.length === 0) return;
      if (sendChange) {
        setPendingChanges(await getQueue().drain(sendChange));
        return;
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistration & {
          sync?: { register(tag: string): Promise<void> };
        };
        await registration.sync?.register('sync-spreadsheet');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      await refreshChanges();
    }
  }, [getQueue, isOnline, refreshChanges, sendChange]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void refreshChanges();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshChanges]);

  useEffect(() => {
    if (isOnline) void syncChanges();
  }, [isOnline, syncChanges]);

  const addPendingChange = useCallback(async (change: T) => {
    if (typeof indexedDB === 'undefined') return;
    await getQueue().enqueue(change);
    await refreshChanges();
    if (isOnline) await syncChanges();
  }, [getQueue, isOnline, refreshChanges, syncChanges]);

  const retryConflict = useCallback(async (id: string) => {
    await getQueue().retryConflict(id);
    await refreshChanges();
    if (isOnline) await syncChanges();
  }, [getQueue, isOnline, refreshChanges, syncChanges]);

  const discardChange = useCallback(async (id: string) => {
    await getQueue().discard(id);
    await refreshChanges();
  }, [getQueue, refreshChanges]);

  return {
    isOnline,
    pendingChanges,
    addPendingChange,
    syncChanges,
    retryConflict,
    discardChange,
  };
}
