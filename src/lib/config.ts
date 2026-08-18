import { Capacitor } from '@capacitor/core';

export const PRODUCTION_BACKEND_URL = "https://olive-pizza-backend.onrender.com";

/**
 * Resilient API URL resolver:
 * - Native Android / iOS / Capacitor: points directly to backend host
 * - Web Dev: uses Vite proxy or VITE_API_BASE_URL
 */
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:'))
  ) {
    const base = import.meta.env.VITE_API_BASE_URL || PRODUCTION_BACKEND_URL;
    return `${base}${cleanEndpoint}`;
  }

  const base = import.meta.env.VITE_API_BASE_URL || '';
  if (base && !base.startsWith('http://localhost') && !base.startsWith('/')) {
    return `${base}${cleanEndpoint}`;
  }

  return cleanEndpoint;
};
