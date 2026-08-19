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
const DEV_BACKEND_URL = "http://localhost:5175";

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  if (
    import.meta.env.PROD ||
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window.location.hostname === 'localhost' && window.location.port === '')
    ))
  ) {
    return PRODUCTION_BACKEND_URL;
  }
  
  return DEV_BACKEND_URL;
}

export function getApiUrl(endpoint: string = ''): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window === 'undefined') return `${PRODUCTION_BACKEND_URL}${cleanEndpoint}`;

  // On Native Capacitor Android/iOS or production Web
  if (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
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
    const currentUser = auth.currentUser;
    if (currentUser && !headers.has('Authorization')) {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
  } catch (err) {
    console.warn('[fetchApi] Could not attach bearer token:', err);
  }

  const config: RequestInit = {
    ...init,
    headers,
  };

  try {
    const res = await fetch(primaryUrl, config);
    if (res.ok || !primaryUrl.startsWith('/')) return res;

    // Fallback directly to production host if relative route proxy failed
    const directUrl = `${PRODUCTION_BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return await fetch(directUrl, config);
  } catch (err) {
    if (primaryUrl.startsWith('/')) {
      const directUrl = `${PRODUCTION_BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      return await fetch(directUrl, config);
    }
    throw err;
  }
};
