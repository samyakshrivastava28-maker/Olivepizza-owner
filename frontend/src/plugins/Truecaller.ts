import { registerPlugin, Capacitor } from '@capacitor/core';
import { fetchApi } from '../lib/config';

export interface TruecallerNativeResult {
  payload: string;
  signature: string;
  signatureAlgorithm?: string;
}

export interface TruecallerPlugin {
  isSupported(): Promise<{ isSupported: boolean }>;
  verify(): Promise<TruecallerNativeResult>;
}

export const Truecaller = registerPlugin<TruecallerPlugin>('Truecaller', {
  web: () => ({
    isSupported: async () => ({ isSupported: false }),
    verify: async () => {
      throw new Error('Native Truecaller SDK is available on Android devices. Use Web / QR verification on browsers.');
    }
  })
});

export interface TruecallerWebSessionResponse {
  success: boolean;
  requestId: string;
  deepLink: string;
  expiresAt: number;
}

export interface TruecallerSessionStatusResponse {
  success: boolean;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'CANCELLED';
  phone?: string;
  error?: string;
  name?: string;
  country?: string;
}

export const TruecallerService = {
  isNative: (): boolean => {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  isNativeSupported: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return false;
    }
    try {
      const result = await Truecaller.isSupported();
      return Boolean(result?.isSupported);
    } catch {
      return false;
    }
  },

  verifyNative: async (): Promise<TruecallerNativeResult> => {
    return Truecaller.verify();
  },

  createWebSession: async (expectedPhone?: string, token?: string): Promise<TruecallerWebSessionResponse> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetchApi('/api/phone/truecaller/session', {
      method: 'POST',
      headers,
      body: JSON.stringify({ expectedPhone })
    });
    if (!res.ok) {
      throw new Error('Failed to initiate Truecaller web session.');
    }
    return res.json();
  },

  pollWebSession: async (requestId: string): Promise<TruecallerSessionStatusResponse> => {
    const res = await fetchApi(`/api/phone/truecaller/session/${requestId}`);
    if (!res.ok) {
      throw new Error('Failed to query Truecaller session status.');
    }
    return res.json();
  },

  verifyOnBackend: async (payload: any, token?: string, expectedPhone?: string): Promise<any> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const bodyPayload = {
      ...payload,
      expectedPhone
    };

    const res = await fetchApi('/api/phone/truecaller', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Truecaller verification failed on server.');
    }
    return data;
  }
};
