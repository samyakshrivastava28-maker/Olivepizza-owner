import { useEffect } from 'react';

export function useVersionCheck() {
  useEffect(() => {
    // Only run the version check on production/deployed environments
    // or when explicitly testing it, to avoid infinite reloads in dev.
    if (import.meta.env.DEV) return;

    const checkVersion = async () => {
      try {
        const response = await fetch('/api/version/status', {
          // ensure we get the latest status, bypassing network cache
          cache: 'no-store' 
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const currentCommit = data.git_commit;
        
        if (!currentCommit || currentCommit === 'unknown') return;

        const lastKnownCommit = localStorage.getItem('olive_last_known_commit');

        if (lastKnownCommit && lastKnownCommit !== currentCommit) {
          console.warn(`[VersionCheck] App version changed (${lastKnownCommit} -> ${currentCommit}). Clearing cache and reloading...`);
          
          localStorage.setItem('olive_last_known_commit', currentCommit);
          
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              await reg.unregister();
            }
          }
          
          if (typeof window !== 'undefined' && 'caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          
          window.location.href = window.location.pathname + '?v=' + new Date().getTime();
        } else if (!lastKnownCommit) {
          localStorage.setItem('olive_last_known_commit', currentCommit);
        }
      } catch (err) {
        console.error('[VersionCheck] Failed to verify app version:', err);
      }
    };

    // Check version on initial launch
    checkVersion();

    // Optionally check periodically every 15 minutes when app is left open
    const interval = setInterval(checkVersion, 15 * 60 * 1000);
    
    // Check when returning to the app from background
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
