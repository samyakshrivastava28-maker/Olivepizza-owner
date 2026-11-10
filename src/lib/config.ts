import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

export const RESTAURANT_LOCATION = {
  address: "Dongargaon Rd, near Saraswati school, Gokul Nagar, Rajnandgaon, Chhattisgarh 491441",
  lat: 21.0810244,
  lng: 81.0123793
};

export const MAX_DELIVERY_RADIUS_KM = 15;
export const OPENING_HOUR = 12; // 12 PM (noon)
export const CLOSING_HOUR = 24; // 12 AM (midnight)

// In production, the client queries the dedicated Owner backend API on Render.
export const PRODUCTION_BACKEND_URL = "https://olivepizza-owner.onrender.com";

// Development fallback
const DEV_BACKEND_URL = "http://localhost:5000";

export function getApiBaseUrl(): string {
  if (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      navigator.userAgent.includes('Electron')
    ))
  ) {
    return PRODUCTION_BACKEND_URL;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  if (import.meta.env.PROD) {
    return PRODUCTION_BACKEND_URL;
  }
  
  return DEV_BACKEND_URL;
}

export function getApiUrl(endpoint: string = ''): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window === 'undefined') return `${PRODUCTION_BACKEND_URL}${cleanEndpoint}`;

  // On Native Capacitor Android/iOS, Electron Desktop, or production Web
  if (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    navigator.userAgent.includes('Electron') ||
    (window.location.hostname === 'localhost' && window.location.port === '') ||
    import.meta.env.PROD
  ) {
    return `${PRODUCTION_BACKEND_URL}${cleanEndpoint}`;
  }

  return cleanEndpoint;
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Authenticated fetch helper for the Owner platform.
 * Automatically injects the Firebase ID token in Authorization header
 * and ensures routing to the live Owner Render backend on Android APK.
 */
export const fetchApi = async (endpoint: string, init?: RequestInit): Promise<Response> => {
  const primaryUrl = getApiUrl(endpoint);
  const headers = new Headers(init?.headers || {});

  try {
    if (auth && (auth as any).authStateReady) {
      await (auth as any).authStateReady();
    }
    const currentUser = auth.currentUser;
    if (currentUser && !headers.has('Authorization')) {
      const token = await currentUser.getIdToken(false);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
  } catch (authErr) {
    console.warn('[fetchApi] Auth state ready notice:', authErr);
  }

  if (!headers.has('X-Device-Id')) {
    const ownerDeviceId = localStorage.getItem('owner_device_id') || 'dev_owner_console';
    headers.set('X-Device-Id', ownerDeviceId);
  }

  const isNativeOrProd =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      navigator.userAgent.includes('Electron')
    )) ||
    import.meta.env.PROD;

  const method = (init?.method || 'GET').toUpperCase();
  const isIdempotent = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  const controller = new AbortController();
  const timeoutMs = 20000; // 20s bounded timeout accommodates Render cold starts
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link caller signal if provided
  if (init?.signal) {
    init.signal.addEventListener('abort', () => controller.abort());
  }

  const config: RequestInit = {
    ...init,
    headers,
    signal: controller.signal,
  };

  try {
    const res = await fetch(primaryUrl, config);
    clearTimeout(timeoutId);

    // If request succeeded or status is an expected client auth/validation response (400, 401, 403, 429), preserve it directly
    if (res.ok || res.status === 401 || res.status === 403 || res.status === 400 || res.status === 422) {
      return res;
    }

    // In local dev with relative URL and idempotent methods, fallback to local backend if proxy encountered 502/503/404
    if (!isNativeOrProd && primaryUrl.startsWith('/') && isIdempotent && (res.status >= 500 || res.status === 404)) {
      try {
        const directDevUrl = `http://localhost:5000${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        const devRes = await fetch(directDevUrl, { ...config, signal: undefined });
        if (devRes.ok) return devRes;
      } catch {}
    }

    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (!isNativeOrProd && primaryUrl.startsWith('/') && isIdempotent) {
      try {
        const directDevUrl = `http://localhost:5000${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        return await fetch(directDevUrl, { ...config, signal: undefined });
      } catch {}
    }
    throw err;
  }
};
