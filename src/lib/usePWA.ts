import { useState, useEffect } from 'react';

/**
 * usePWA — Legacy hook maintained for compatibility.
 * PWA install prompt feature has been removed.
 * Retains isOffline detection which is still used across the app.
 */
export function usePWA() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOffline,
    offlineReady: false,
    needRefresh: false,
    updateApp: () => {},
    deferredPrompt: null,
    installApp: async () => {},
    canInstall: false,
    isStandalone: false,
    hasInstalled: false,
  };
}
