import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  mandatoryUpdate: boolean;
  releaseNotes?: string;
  releaseDate?: string;
  downloadUrl?: string;
}

interface VersionState {
  isUpdateAvailable: boolean;
  updateMode: 'optional' | 'recommended' | 'required' | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  downloadUrl: string | null;
  isDismissed: boolean;
  isUpdating: boolean;
  updateProgress: string;
  setUpdateAvailable: (available: boolean, mode: 'optional' | 'recommended' | 'required', info: Partial<VersionInfo>) => void;
  dismissUpdate: () => void;
  postponeUpdate: () => void;
  setUpdating: (updating: boolean, progress?: string) => void;
}

export const useVersionStore = create<VersionState>((set, get) => ({
  isUpdateAvailable: false,
  updateMode: null,
  latestVersion: null,
  releaseNotes: null,
  releaseDate: null,
  downloadUrl: null,
  isDismissed: false,
  isUpdating: false,
  updateProgress: '',
  
  setUpdateAvailable: (available, mode, info) => {
    const latest = info.latestVersion || '';
    const isDismissedInStorage = localStorage.getItem(`dismissed_update_${latest}`) === 'true';
    
    // Mandatory updates cannot be dismissed
    const effectivelyDismissed = mode !== 'required' && isDismissedInStorage;

    set({
      isUpdateAvailable: available && !effectivelyDismissed,
      updateMode: mode,
      latestVersion: info.latestVersion || null,
      releaseNotes: info.releaseNotes || null,
      releaseDate: info.releaseDate || null,
      downloadUrl: info.downloadUrl || 'https://github.com/samyakshrivastava28-maker/Olive-Pizza/releases/latest',
      isDismissed: effectivelyDismissed,
    });
  },

  dismissUpdate: () => {
    const { latestVersion } = get();
    if (latestVersion) {
      localStorage.setItem(`dismissed_update_${latestVersion}`, 'true');
    }
    set({ isUpdateAvailable: false, isDismissed: true });
  },

  postponeUpdate: () => {
    sessionStorage.setItem('update_later_timestamp', Date.now().toString());
    set({ isUpdateAvailable: false });
  },

  setUpdating: (updating, progress) => set({ isUpdating: updating, updateProgress: progress || '' }),
}));

/**
 * Compare two semver/numeric versions.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export function initVersionManager() {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const [resource, config] = args;
    let newConfig = config;
    const urlString = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
    
    if (urlString.startsWith('/') || urlString.startsWith(window.location.origin)) {
      const headers = new Headers((config?.headers as any) || {});
      headers.set('X-App-Version', APP_VERSION);
      headers.set('X-Platform', Capacitor.isNativePlatform() ? 'android' : 'web');

      newConfig = { ...config, headers };
    }

    const response = await originalFetch(resource, newConfig);

    if (response.status === 426) {
      try {
        const data = await response.clone().json();
        useVersionStore.getState().setUpdateAvailable(true, data.updateMode || 'required', {
          currentVersion: APP_VERSION,
          latestVersion: data.latestVersion || 'Unknown',
          mandatoryUpdate: true,
          releaseNotes: data.releaseNotes,
        });
      } catch {
        useVersionStore.getState().setUpdateAvailable(true, 'required', {
          currentVersion: APP_VERSION,
          latestVersion: 'Unknown',
          mandatoryUpdate: true,
        });
      }
    }

    return response;
  };

  // Listen for trigger-pwa-update global events
  window.addEventListener('trigger-pwa-update', () => {
    performUpdate();
  });

  window.addEventListener('online', () => checkVersion(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkVersion(false);
    }
  });

  // Check every 10 minutes in background
  setInterval(() => {
    checkVersion(false);
  }, 10 * 60 * 1000);

  // Initial check
  checkVersion(false);
}

export async function checkVersion(force = false) {
  try {
    if (!force) {
      const laterTimestamp = sessionStorage.getItem('update_later_timestamp');
      if (laterTimestamp) {
        const timePassed = Date.now() - parseInt(laterTimestamp, 10);
        if (timePassed < 30 * 60 * 1000) {
          // Less than 30 minutes since user clicked 'Later', ignore non-mandatory updates
          return;
        }
      }
    }

    const res = await fetch('/api/version/settings', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const latest = data.latest_version || data.latestVersion || APP_VERSION;
      const minRequired = data.minimum_version || data.minimumVersion || APP_VERSION;
      const isMandatory = Boolean(data.mandatory_update || compareVersions(APP_VERSION, minRequired) < 0);
      const isOutdated = compareVersions(APP_VERSION, latest) < 0;

      if (isOutdated || isMandatory) {
        const mode = isMandatory ? 'required' : 'optional';
        useVersionStore.getState().setUpdateAvailable(true, mode, {
          currentVersion: APP_VERSION,
          latestVersion: latest,
          mandatoryUpdate: isMandatory,
          releaseNotes: data.release_notes || data.releaseNotes || 'Enjoy a faster experience, improved ordering, and new features.',
          releaseDate: data.release_date || data.releaseDate || new Date().toISOString(),
          downloadUrl: data.download_url || data.downloadUrl || 'https://github.com/samyakshrivastava28-maker/Olive-Pizza/releases/latest',
        });
      }
    }
  } catch (error) {
    console.warn('[VersionManager] Version check skipped:', error);
  }
}

export async function performUpdate() {
  const { downloadUrl } = useVersionStore.getState();
  const DOWNLOAD_URL = downloadUrl || 'https://github.com/samyakshrivastava28-maker/Olive-Pizza/releases/latest';

  try {
    useVersionStore.getState().setUpdating(true, 'Clearing caches & preparing update...');

    if (Capacitor.isNativePlatform()) {
      window.open(DOWNLOAD_URL, '_system');
      window.open('/api/github/download-apk', '_system');
    } else {
      // 2. Unregister service workers and clear caches for PWA
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.unregister().catch(() => {});
        }
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }

      sessionStorage.setItem('restore_path', window.location.pathname);

      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  } catch (error) {
    console.error('Update failed:', error);
    window.location.href = DOWNLOAD_URL;
  }
}
