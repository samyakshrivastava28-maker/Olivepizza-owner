import { auth } from './firebase';
import { getApiUrl, PRODUCTION_BACKEND_URL } from './config';

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
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token && !headers.has('Authorization')) {
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

/**
 * Install global fetch interceptor so any raw fetch('/api/...') across all
 * components automatically points to the Render backend and includes the auth token.
 */
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (typeof url === 'string' && url.startsWith('/api/')) {
      const primaryUrl = getApiUrl(url);
      const headers = new Headers(init?.headers || {});

      try {
        const currentUser = auth.currentUser;
        if (currentUser && !headers.has('Authorization')) {
          const token = await currentUser.getIdToken();
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        }
      } catch {}

      const newInit: RequestInit = {
        ...init,
        headers,
      };

      try {
        const res = await originalFetch(primaryUrl, newInit);
        if (res.ok || !primaryUrl.startsWith('/')) return res;
        const directUrl = `${PRODUCTION_BACKEND_URL}${url.startsWith('/') ? url : `/${url}`}`;
        return await originalFetch(directUrl, newInit);
      } catch (err) {
        if (primaryUrl.startsWith('/')) {
          const directUrl = `${PRODUCTION_BACKEND_URL}${url.startsWith('/') ? url : `/${url}`}`;
          return await originalFetch(directUrl, newInit);
        }
        throw err;
      }
    }

    return originalFetch(input, init);
  };
}
