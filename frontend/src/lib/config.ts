import { Capacitor } from '@capacitor/core';

// In production, the client should query the dedicated Owner backend API on Render.
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

export const API_BASE_URL = getApiBaseUrl();

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
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
