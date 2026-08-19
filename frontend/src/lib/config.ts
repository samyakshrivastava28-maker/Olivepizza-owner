import { Capacitor } from '@capacitor/core';

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
  
  if (import.meta.env.PROD || Capacitor.isNativePlatform()) {
    return PRODUCTION_BACKEND_URL;
  }
  
  return DEV_BACKEND_URL;
}

export function getApiUrl(endpoint: string = ''): string {
  const base = getApiBaseUrl();
  if (!endpoint) return base;
  return `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}

export const API_BASE_URL = getApiBaseUrl();

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}
