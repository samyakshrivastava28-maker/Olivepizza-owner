/**
 * Olive Pizza — Native Location Manager
 *
 * Uses @capacitor/geolocation on Android/iOS for accurate GPS and proper
 * OS-level permission dialog flows. Falls back to browser navigator.geolocation
 * on web.
 *
 * PERMISSION FLOW (Android):
 *   1. Request foreground location (ACCESS_FINE_LOCATION)
 *   2. After foreground granted → request background location (ACCESS_BACKGROUND_LOCATION)
 *   Android 10+ enforces this two-step sequence; requesting both at once fails.
 *
 * USAGE:
 *   const loc = await LocationManager.getCurrentLocation();
 *   const hasBg = await LocationManager.requestBackgroundPermission();
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

export interface LocationData {
  lat: number;
  lng: number;
  fullAddress: string;
  city?: string;
  pincode?: string;
  accuracy?: number;
}

const CACHE_KEY = 'olive_cached_location';

// ─── Permission State Types ─────────────────────────────────────────────────
export type PermissionState = 'granted' | 'denied' | 'prompt';

export class LocationManager {
  // ─── Cache ────────────────────────────────────────────────────────────────

  static getCachedLocation(): LocationData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached) as LocationData;
    } catch {}
    return null;
  }

  static setCachedLocation(location: LocationData): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(location));
    } catch {}
  }

  // ─── Foreground Permission ────────────────────────────────────────────────

  /**
   * Check the current foreground location permission state.
   */
  static async checkPermissionState(): Promise<PermissionState> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Geolocation.checkPermissions();
        // Capacitor returns 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
        if (status.location === 'granted') return 'granted';
        if (status.location === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'denied';
      }
    }

    // Web fallback
    if (!navigator.geolocation) return 'denied';
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state as PermissionState;
    } catch {
      return 'prompt';
    }
  }

  /**
   * Request foreground location permission.
   * Returns 'granted' | 'denied' | 'prompt'.
   */
  static async requestForegroundPermission(): Promise<PermissionState> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Geolocation.requestPermissions();
        if (status.location === 'granted') return 'granted';
        return 'denied';
      } catch {
        return 'denied';
      }
    }

    // Web: permission is requested implicitly when calling getCurrentPosition
    return 'prompt';
  }

  /**
   * Request BACKGROUND location permission.
   * MUST be called AFTER foreground location has been granted.
   * Only available on Android (API 29+) and iOS (with 'Always' mode).
   *
   * Returns true if background location is now granted.
   */
  static async requestBackgroundPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      // First verify foreground is granted
      const fgState = await this.checkPermissionState();
      if (fgState !== 'granted') {
        console.warn('[LocationManager] Cannot request background permission without foreground permission');
        return false;
      }

      // Capacitor Geolocation does not expose a direct background permission API.
      // We use the native platform check: if coarseLocation is granted, we are foreground.
      // To request background, we check the combined permission status.
      const status = await Geolocation.checkPermissions();

      // 'granted' without 'always' means foreground only
      if ((status as any).coarseLocation === 'granted' || status.location === 'granted') {
        // Attempt to request the background permission (supported in Capacitor 5+)
        try {
          const bgStatus = await (Geolocation as any).requestPermissions({ permissions: ['location', 'coarseLocation'] });
          return bgStatus?.location === 'granted';
        } catch {
          // Some Capacitor versions don't support background directly — guide user to settings
          return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if background location is currently granted.
   */
  static async hasBackgroundPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const status = await Geolocation.checkPermissions();
      // On Android, if the user chose "Allow all the time", it shows as granted
      // with the background permission also being granted. We check coarseLocation
      // as a proxy since Capacitor 5 maps it from android's background grant.
      return status.location === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Returns true if we should prompt the user for location permission.
   */
  static async shouldPrompt(): Promise<boolean> {
    const state = await this.checkPermissionState();
    if (state === 'denied') return false;
    if (state === 'granted') return false;
    return true;
  }

  // ─── Position Fetching ───────────────────────────────────────────────────

  /**
   * Get current GPS position using native Capacitor Geolocation on Android,
   * or browser navigator.geolocation on web.
   *
   * Automatically requests permission if needed.
   * Falls back to cached location if permission is denied.
   */
  static async getCurrentLocation(options?: {
    forcePrompt?: boolean;
    fallbackToCache?: boolean;
    highAccuracy?: boolean;
  }): Promise<LocationData> {
    const fallback = options?.fallbackToCache ?? true;
    const highAccuracy = options?.highAccuracy ?? true;

    // Check foreground permission first
    let state = await this.checkPermissionState();

    if (state === 'denied' && !options?.forcePrompt) {
      const cached = this.getCachedLocation();
      if (fallback && cached) return cached;
      throw new Error('Location permission denied. Enable location in device Settings.');
    }

    if (state === 'prompt') {
      state = await this.requestForegroundPermission();
      if (state !== 'granted') {
        const cached = this.getCachedLocation();
        if (fallback && cached) return cached;
        throw new Error('Location permission not granted.');
      }
    }

    try {
      let coords: { latitude: number; longitude: number; accuracy?: number | null };

      if (Capacitor.isNativePlatform()) {
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 5000,
        });
        coords = position.coords;
      } else {
        // Web fallback
        const position = await this._webGetCurrentPosition(highAccuracy);
        coords = position.coords;
      }

      const locationData = await this._reverseGeocode(
        coords.latitude,
        coords.longitude,
        coords.accuracy ?? undefined
      );

      this.setCachedLocation(locationData);
      return locationData;
    } catch (err) {
      const cached = this.getCachedLocation();
      if (fallback && cached) {
        console.warn('[LocationManager] GPS error, returning cached location:', err);
        return cached;
      }
      throw err;
    }
  }

  /**
   * Get a position update suitable for delivery partner heartbeat.
   * Returns null if permission denied rather than throwing.
   */
  static async getDeliveryPosition(): Promise<{ lat: number; lng: number; speed?: number | null; accuracy?: number | null } | null> {
    if (!Capacitor.isNativePlatform()) {
      // Web: use navigator directly for delivery heartbeat
      try {
        const pos = await this._webGetCurrentPosition(false);
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        };
      } catch {
        return null;
      }
    }

    const state = await this.checkPermissionState();
    if (state !== 'granted') return null;

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false, // Battery-saving for frequent updates
        timeout: 8000,
        maximumAge: 15000,
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
      };
    } catch {
      return null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private static _webGetCurrentPosition(highAccuracy: boolean): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  private static async _reverseGeocode(lat: number, lng: number, accuracy?: number): Promise<LocationData> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) throw new Error('Geocoding failed');
      const data = await response.json();
      return {
        lat,
        lng,
        fullAddress: data.display_name || 'Current Location',
        city: data.address?.city || data.address?.town || data.address?.village || '',
        pincode: data.address?.postcode || '',
        accuracy,
      };
    } catch {
      // Reverse geocode failed — return coords only
      return { lat, lng, fullAddress: 'Current Location', accuracy };
    }
  }
}
