import { Capacitor } from '@capacitor/core';
export { fetchApi } from './api';

export const RESTAURANT_LOCATION = {
  address: "Dongargaon Rd, near Saraswati school, Gokul Nagar, Rajnandgaon, Chhattisgarh 491441",
  lat: 21.0810244,
  lng: 81.0123793,
};

export const MAX_DELIVERY_RADIUS_KM = 15;
export const OPENING_HOUR = 12; // 12 PM (noon)
export const CLOSING_HOUR = 24; // 12 AM (midnight)

export const PRODUCTION_BACKEND_URL = "https://olive-pizza.onrender.com";

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
