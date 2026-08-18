import { getCurrentAuthToken } from './firebase';
import { fetchApi } from './config';

export async function devGet(path: string, signal?: AbortSignal) {
  try {
    const token = await getCurrentAuthToken().catch(() => '');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetchApi(`/api/devops${path}`, { headers, signal });
    if (res.ok) return res.json();
    const errorJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorJson.error || errorJson.message || `HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { aborted: true };
    }
    throw err;
  }
}

export async function devPost(path: string, body?: any, signal?: AbortSignal) {
  try {
    const token = await getCurrentAuthToken().catch(() => '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : undefined;

    const res = await fetchApi(`/api/devops${path}`, {
      method: 'POST',
      headers,
      body: payload,
      signal
    });
    if (res.ok) return res.json();
    const errorJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorJson.error || errorJson.message || `HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { aborted: true };
    }
    throw err;
  }
}

export async function devDelete(path: string, signal?: AbortSignal) {
  try {
    const token = await getCurrentAuthToken().catch(() => '');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetchApi(`/api/devops${path}`, {
      method: 'DELETE',
      headers,
      signal
    });
    if (res.ok) return res.json();
    const errorJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorJson.error || errorJson.message || `HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { aborted: true };
    }
    throw err;
  }
}
