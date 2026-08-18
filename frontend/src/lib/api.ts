import { auth } from './firebase';
import { getApiUrl, PRODUCTION_BACKEND_URL } from './config';

/**
 * Authenticated fetch helper for the Owner platform.
 * Automatically injects the Firebase ID token in Authorization header.
 */
export const fetchApi = async (endpoint: string, init?: RequestInit): Promise<Response> => {
  const primaryUrl = getApiUrl(endpoint);
  const headers = new Headers(init?.headers || {});

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
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

    // Fallback directly to production host if proxy failed
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
