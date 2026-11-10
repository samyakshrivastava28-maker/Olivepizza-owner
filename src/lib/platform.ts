/**
 * Platform Detection Utilities
 * Handles detection of Apple platforms, Capacitor native environments, and Web Push support.
 */

/** Returns true when running inside a Capacitor native Android/iOS shell */
export const isCapacitorNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Capacitor sets window.Capacitor globally
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

export const isMacOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return navigator.userAgent.includes("Mac OS X") && !isIOS();
};

export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("CriOS") && !ua.includes("FxiOS");
};

/** Whether the app is running in a browser PWA standalone window */
export const isStandalonePWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         // @ts-ignore
         window.navigator.standalone === true;
};

/**
 * Returns the notification support mode for the current environment.
 * Capacitor native → use @capacitor/push-notifications (handled natively)
 * Web browser with PushManager → use FCM Web Push
 * iOS Safari web → email fallback only
 */
export const getPushCompatibility = (): { supported: boolean; mode: 'native' | 'web' | 'email_only'; reason: string } => {
  // If inside Capacitor Android/iOS, the native app handles push
  if (isCapacitorNative()) {
    return { supported: true, mode: 'native', reason: 'Capacitor native push notifications' };
  }

  const ios = isIOS();
  const safari = isSafari();

  // iOS Safari without Capacitor has no Web Push support
  if (ios && safari) {
    return { supported: false, mode: 'email_only', reason: 'iOS Safari does not support Web Push. Email notifications will be used instead.' };
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  if (!hasServiceWorker || !hasPushManager || !hasNotification) {
    return { supported: false, mode: 'email_only', reason: 'This browser does not support Web Push Notifications.' };
  }

  return { supported: true, mode: 'web', reason: 'Web Push supported' };
};
