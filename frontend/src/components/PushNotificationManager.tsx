/**
 * Olive Pizza Ã¢â‚¬” Enterprise Push Notification Manager (Production v3)
 *
 * Production Responsibilities:
 * 1. Request notification permission on first login (native Capacitor on Android)
 * 2. Register FCM token in Postgres (dedup, multi-device, clean invalid tokens)
 * 3. Auto-token management: login/logout/reinstall/token-refresh cycles
 * 4. Listen for foreground messages (Capacitor native + Firebase web)
 * 5. Listen for SW BroadcastChannel messages (quick action results)
 * 6. Adaptive heartbeat (30s GPS for delivery, 5m for others)
 * 7. Battery optimization prompt for owners (one-time, non-blocking)
 * 8. Forward auth token to Service Worker for Quick Actions (web only)
 * 9. Offline recovery: re-register token and refresh state on reconnect
 *
 * IMPORTANT RULES:
 * - Notification failure NEVER blocks login.
 * - If notifications are unavailable: log and continue, do NOT crash.
 * - Battery optimization prompt is advisory only Ã¢â‚¬” never forced.
 * - Uses @capacitor/geolocation on native, browser geolocation on web.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getMessagingInstance, db, auth } from '../lib/firebase';
import { getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { LocationManager } from '../lib/permissions';
import { useAuthStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ShieldCheck, BatteryWarning, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { NOTIFICATION_CHANNELS, NOTIFICATION_ACTION_TYPES } from '../lib/notificationChannels';
import { fetchApi } from '../lib/config';

const BROADCAST_CHANNEL = 'olive_pizza_notifications';

// Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Persistent sound state Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
let continuousAudio: HTMLAudioElement | null = null;

function startContinuousAlert(soundName: string) {
  try {
    if (continuousAudio) return;
    const src = `/sounds/${soundName}`;
    continuousAudio = new Audio(src);
    continuousAudio.loop = true;
    try {
      const persisted = JSON.parse(localStorage.getItem('olive-owner-settings') || '{}');
      continuousAudio.volume = persisted?.state?.volumeLevel ?? 1.0;
    } catch {
      continuousAudio.volume = 1.0;
    }
    continuousAudio.play().catch(err =>
      console.warn('[PushManager] Autoplay blocked for continuous alert:', err)
    );
  } catch {}
}

function stopContinuousAlert() {
  if (continuousAudio) {
    continuousAudio.pause();
    continuousAudio.currentTime = 0;
    continuousAudio = null;
  }
}

function playNotificationSound(soundName: string) {
  try {
    const src = `/sounds/${soundName}`;
    const audio = new Audio(src);
    try {
      const persisted = JSON.parse(localStorage.getItem('olive-owner-settings') || '{}');
      audio.volume = persisted?.state?.volumeLevel ?? 0.7;
    } catch {
      audio.volume = 0.7;
    }
    audio.play().catch(() => {});
  } catch {}
}

// Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Battery Optimization Check Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
async function isBatteryOptimized(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    // We use a heuristic: check if the app is running on Android
    // and has not seen this prompt before. The actual battery optimization
    // API requires a native plugin; we prompt the user to check manually.
    const shown = localStorage.getItem('olive_battery_prompt_shown');
    return !shown; // Show prompt once per install
  } catch {
    return false;
  }
}

// Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Component Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
export default function PushNotificationManager() {
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showBatteryPrompt, setShowBatteryPrompt] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [tokenRegistered, setTokenRegistered] = useState(false);

  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.role);
  const navigate = useNavigate();

  const messagingRef = useRef<Messaging | null>(null);
  const heartbeatTimerRef = useRef<any | null>(null);
  const tokenRefreshTimerRef = useRef<any | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const messageUnsubRef = useRef<(() => void) | null>(null);
  const foregroundListenerSetupRef = useRef(false);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ SW Registration Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      });
      await reg.update();
      return reg;
    } catch (err) {
      console.error('[PushManager] SW registration failed:', err);
      return null;
    }
  }, []);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Create Android Notification Channels Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  const createNativeChannels = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    for (const channel of NOTIFICATION_CHANNELS) {
      try {
        await PushNotifications.createChannel(channel);
      } catch (e) {
        console.warn('[PushManager] Channel creation failed for', channel.id, e);
      }
    }
    // Register action types for notification buttons
    if (typeof (PushNotifications as any).registerActionTypes === 'function') {
      try {
        await (PushNotifications as any).registerActionTypes({
          types: NOTIFICATION_ACTION_TYPES,
        });
      } catch (e) {
        console.warn('[PushManager] Action types registration failed:', e);
      }
    }
  }, []);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Token Registration Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  const registerToken = useCallback(async (uid: string): Promise<void> => {
    try {
      let token = '';

      if (Capacitor.isNativePlatform()) {
        // NATIVE ANDROID/IOS FCM REGISTRATION
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale' as any) {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn('[PushManager] Native push permission denied for user', uid);
          return;
        }

        // Always create channels before registering
        await createNativeChannels();

        // Register with FCM Ã¢â‚¬” attach listeners FIRST so registration event is never missed
        token = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('FCM token registration timeout (15s)'));
          }, 15000);

          const regListener = PushNotifications.addListener('registration', (pushToken) => {
            clearTimeout(timeout);
            regListener.then(h => h.remove()).catch(() => {});
            errListener.then(h => h.remove()).catch(() => {});
            resolve(pushToken.value);
          });

          const errListener = PushNotifications.addListener('registrationError', (error) => {
            clearTimeout(timeout);
            regListener.then(h => h.remove()).catch(() => {});
            errListener.then(h => h.remove()).catch(() => {});
            reject(new Error(`FCM registration error: ${JSON.stringify(error)}`));
          });

          PushNotifications.register().catch((regErr) => {
            clearTimeout(timeout);
            reject(regErr);
          });
        });

        console.log('[PushManager] Ã¢Å“”¦ Native FCM token obtained');

      } else {
        // WEB PWA FIREBASE REGISTRATION
        // Guard against Android Capacitor where Notification API is unavailable
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (window.Notification.permission !== 'granted') return;

        const messaging = await getMessagingInstance();
        if (!messaging) return;

        const vapidKey =
          import.meta.env.VITE_FIREBASE_VAPID_KEY ||
          'BDfxvZSqSw6Es3dvXz4VZMwjNFKMCCfRSgdCVty3rfqqBZ6AAWFlZ2EwWQR8ltp6DRMTUKOmH9Rlu0fjCziOKDk';

        const swReg = await registerServiceWorker();
        if (!swReg) return;

        token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        if (!token) {
          console.warn('[PushManager] Empty web push token received');
          return;
        }
      }

      // Store token in Postgres via backend (handles dedup & multi-device)
      const authToken = await auth.currentUser?.getIdToken();
      if (!authToken) return;

      const res = await fetchApi('/api/notifications/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          deviceName: Capacitor.isNativePlatform()
            ? `Android Native (${navigator.userAgent.match(/; (.+?)\)/)?.[1] || 'Device'})`
            : navigator.userAgent.slice(0, 100),
          platform: Capacitor.isNativePlatform() ? 'android' : navigator.platform,
          browser: Capacitor.isNativePlatform() ? 'capacitor' : getBrowserName(),
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0',
          appName: 'owner',
        }),
      });

      if (res.ok) {
        setTokenRegistered(true);
        console.log('[PushManager] Ã¢Å“”¦ FCM token registered in backend (multi-device safe)');

        // Forward auth token to Service Worker for web quick actions
        if (!Capacitor.isNativePlatform() && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'STORE_AUTH_TOKEN',
            uid,
            token: authToken,
          });
        }
      } else {
        console.error('[PushManager] Backend token registration failed:', res.status);
      }
    } catch (err) {
      console.error('[PushManager] Token registration error (non-fatal):', err);
      // NEVER block login on notification failure
    }
  }, [registerServiceWorker, createNativeChannels]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Foreground Message Listener Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  const setupForegroundListener = useCallback((messaging: Messaging | null) => {
    // Prevent duplicate listeners
    if (foregroundListenerSetupRef.current && Capacitor.isNativePlatform()) return;
    foregroundListenerSetupRef.current = true;

    if (messageUnsubRef.current) {
      messageUnsubRef.current();
      messageUnsubRef.current = null;
    }

    if (Capacitor.isNativePlatform()) {
      // NATIVE: listen for foreground FCM messages
      const handler = PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const data = notification.data || {};
        const title = notification.title || 'Olive Pizza';
        const body = notification.body || '';

        // Acknowledge delivery to backend
        if (data.queueId) {
          fetchApi('/api/notifications/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueId: data.queueId, stage: 'delivered', orderId: data.orderId }),
          }).catch(() => {});
        }

        // Play sound for foreground alerts
        if (data.alert === 'continuous') {
          startContinuousAlert(data.sound || 'order_alert.mp3');
        } else if (data.sound && data.sound !== 'default') {
          playNotificationSound(data.sound);
        }

        // Show in-app toast
        toast(
          (t) => (
            <div className="flex flex-col gap-2 relative">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="absolute -top-1 -right-1 text-slate-400 hover:text-white p-1 bg-slate-800 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div
                  className="flex-1 cursor-pointer pr-4"
                  onClick={() => {
                    if (data.url) navigate(data.url);
                    toast.dismiss(t.id);
                    stopContinuousAlert();
                  }}
                >
                  <p className="font-bold text-white text-sm">{title}</p>
                  <p className="text-slate-300 text-xs mt-0.5 whitespace-pre-wrap leading-tight">{body}</p>
                </div>
              </div>
              {data.alert === 'continuous' && (
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => { stopContinuousAlert(); toast.dismiss(t.id); }}
                    className="px-3 py-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs font-bold"
                  >
                    Stop Alert
                  </button>
                </div>
              )}
            </div>
          ),
          {
            duration: data.alert === 'continuous' ? Infinity : 5000,
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
          }
        );
      });

      // Handle notification tap (app open / brought to foreground)
      const actionHandler = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification.data || {};
        stopContinuousAlert();
        if (data.url) navigate(data.url);

        if (data.queueId) {
          fetchApi('/api/notifications/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueId: data.queueId, stage: 'opened', orderId: data.orderId }),
          }).catch(() => {});
        }
      });

      messageUnsubRef.current = () => {
        handler.then(h => h.remove()).catch(() => {});
        actionHandler.then(h => h.remove()).catch(() => {});
        foregroundListenerSetupRef.current = false;
      };
      return;
    }

    // WEB: use Firebase onMessage for foreground messages
    if (!messaging) return;

    const unsub = onMessage(messaging, async (payload) => {
      const { notification, data } = payload;

      const targetRole = data?.targetRole || data?.role;
      const category = data?.category;

      // Role isolation guard: skip if notification belongs to another role
      if (targetRole && targetRole !== userRole) return;
      if ((category === 'alarm_actionable' || category === 'delivery') && userRole !== 'delivery_partner') return;
      if ((category === 'owner_orders' || category === 'new_order') && userRole !== 'owner' && userRole !== 'admin') return;
      if (category === 'customer' && userRole !== 'customer') return;

      const title = notification?.title || 'Olive Pizza';
      const body = notification?.body || '';
      const url = data?.url || '/';
      const queueId = data?.queueId;
      const orderId = data?.orderId;

      if (queueId) {
        fetchApi('/api/notifications/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId, stage: 'delivered', orderId }),
        }).catch(() => {});
      }

      // Show native notification when tab is background
      if (
        document.hidden &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          const swReg = await navigator.serviceWorker.ready;
          swReg.showNotification(title, {
            body,
            icon: '/logo-transparent.png',
            tag: data?.tag || `fg_${Date.now()}`,
            // @ts-ignore
            renotify: true,
            vibrate: [200, 100, 200],
            data: { url, orderId, queueId },
          });
        } catch {}
      }

      if (data?.alert === 'continuous') {
        startContinuousAlert(data.sound || 'order_alert.mp3');
      } else if (data?.sound && data.sound !== 'default') {
        playNotificationSound(data.sound);
      }

      // Premium in-app toast
      toast.custom(
        (t) => (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="max-w-sm w-full"
            onClick={() => {
              if (data?.alert === 'continuous') return;
              toast.dismiss(t.id);
              navigate(url);
              if (queueId) {
                fetchApi('/api/notifications/track', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ queueId, stage: 'opened', orderId }),
                }).catch(() => {});
              }
            }}
            style={{ cursor: data?.alert === 'continuous' ? 'default' : 'pointer' }}
          >
            <div
              className="rounded-2xl p-4 flex flex-col gap-3 shadow-2xl"
              style={{
                background: 'rgba(10,10,10,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(249,115,22,0.3)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.1)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                >
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm leading-snug">{title}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed line-clamp-2 whitespace-pre-line">
                    {body}
                  </p>
                </div>
                {data?.alert !== 'continuous' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                    className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {data?.alert === 'continuous' && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      stopContinuousAlert();
                      const token = await auth.currentUser?.getIdToken();
                      fetchApi('/api/notifications/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ orderId, action: 'stop_alert', currentStage: data.stage }),
                      }).catch(() => {});
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold py-2 rounded-lg"
                  >
                    Ã°Å¸”• Stop Alert
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); navigate(url); }}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 rounded-lg"
                  >
                    Ã°Å¸“Å  Open Order
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ),
        { duration: data?.alert === 'continuous' ? 60000 : 8000, position: 'top-center' }
      );
    });

    messageUnsubRef.current = unsub;
  }, [navigate]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Web Permission Request Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  const requestWebPermission = useCallback(async (uid: string): Promise<void> => {
    try {
      // Only for web Ã¢â‚¬” native is handled inside registerToken
      if (Capacitor.isNativePlatform()) {
        setShowNotifPrompt(false);
        await registerToken(uid);
        return;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) {
        setShowNotifPrompt(false);
        return;
      }

      const permission = await window.Notification.requestPermission();
      setShowNotifPrompt(false);

      if (permission === 'granted') {
        await registerToken(uid);
        const messaging = await getMessagingInstance();
        if (messaging) {
          messagingRef.current = messaging;
          setupForegroundListener(messaging);
        }
      }
    } catch (err) {
      console.error('[PushManager] Web permission request error:', err);
      setShowNotifPrompt(false);
    }
  }, [registerToken, setupForegroundListener]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ SW BroadcastChannel Listener Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  useEffect(() => {
    broadcastRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastRef.current.onmessage = (event) => {
      const { type, action, orderId, newStatus, sound } = event.data || {};
      if (type === 'ACTION_SUCCESS' || type === 'SYNC_ACTION_SUCCESS') {
        toast.success(`Ã¢Å“”¦ ${action} Ã¢” ”™ ${newStatus}`, { duration: 3000 });
        window.dispatchEvent(new CustomEvent('olive:order:updated', { detail: { orderId, newStatus } }));
      }
      if (type === 'GPS_UPDATE') {
        window.dispatchEvent(new CustomEvent('olive:gps:update', { detail: event.data }));
      }
      if (type === 'START_ALERT') startContinuousAlert(sound || 'order_alert.mp3');
      if (type === 'STOP_ALERT') stopContinuousAlert();
    };
    return () => broadcastRef.current?.close();
  }, []);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Main Init Effect Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  useEffect(() => {
    if (!user) {
      // Clean up on logout
      if (messageUnsubRef.current) { messageUnsubRef.current(); messageUnsubRef.current = null; }
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (tokenRefreshTimerRef.current) clearInterval(tokenRefreshTimerRef.current);
      foregroundListenerSetupRef.current = false;
      setTokenRegistered(false);
      return;
    }

    const uid = user.uid;

    const init = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // NATIVE: register immediately without showing custom prompt
          if (!tokenRegistered) {
            await registerToken(uid);
          }
          setupForegroundListener(null);

          // Check battery optimization for owners (advisory, one-time)
          if (userRole === 'owner') {
            const needsPrompt = await isBatteryOptimized();
            if (needsPrompt) setShowBatteryPrompt(true);
          }

          // Check location permission and prompt if needed (for delivery partners)
          if (userRole === 'delivery_partner') {
            const locState = await LocationManager.checkPermissionState();
            if (locState === 'prompt') setShowLocationPrompt(true);
          }
        } else {
          // WEB: show custom notification permission prompt
          const notifPermission =
            typeof window !== 'undefined' && 'Notification' in window
              ? window.Notification.permission
              : 'denied';

          if (notifPermission === 'granted') {
            if (!tokenRegistered) await registerToken(uid);
            const messaging = await getMessagingInstance();
            if (messaging) {
              messagingRef.current = messaging;
              setupForegroundListener(messaging);
            }
          } else if (notifPermission === 'default') {
            setTimeout(() => setShowNotifPrompt(true), 3000);
          }
        }

        // Auto-refresh auth token in SW every 50 minutes
        if (!Capacitor.isNativePlatform()) {
          const refreshTokenInSW = async () => {
            const freshToken = await auth.currentUser?.getIdToken(true);
            if (freshToken && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'STORE_AUTH_TOKEN', uid, token: freshToken,
              });
            }
          };
          tokenRefreshTimerRef.current = setInterval(refreshTokenInSW, 50 * 60 * 1000);
        }
      } catch (err) {
        // Init errors are NEVER fatal
        console.error('[PushManager] Init error (non-fatal):', err);
      }
    };

    init();

    return () => {
      if (messageUnsubRef.current) { messageUnsubRef.current(); messageUnsubRef.current = null; }
      if (tokenRefreshTimerRef.current) clearInterval(tokenRefreshTimerRef.current);
    };
  }, [user, userRole, tokenRegistered, registerToken, setupForegroundListener]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Adaptive Heartbeat Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  useEffect(() => {
    if (!user) return;
    const intervalMs = userRole === 'delivery_partner' ? 30_000 : 5 * 60_000;

    const sendHeartbeat = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const body: any = {
          online: true,
          deviceName: Capacitor.isNativePlatform() ? 'Android Native App' : navigator.userAgent.slice(0, 80),
          browser: Capacitor.isNativePlatform() ? 'capacitor' : getBrowserName(),
          platform: Capacitor.isNativePlatform() ? 'android' : navigator.platform,
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0',
          notificationReady: Capacitor.isNativePlatform() ? true :
            typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted',
        };

        // Include GPS for delivery partners using native Capacitor geolocation
        if (userRole === 'delivery_partner') {
          const pos = await LocationManager.getDeliveryPosition();
          if (pos) {
            body.lat = pos.lat;
            body.lng = pos.lng;
            body.speed = pos.speed;
            body.accuracy = pos.accuracy;
          }
        }

        await fetchApi('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } catch {} // Heartbeat failures are always non-fatal
    };

    const initialTimeout = setTimeout(() => sendHeartbeat(), 5000);
    heartbeatTimerRef.current = setInterval(sendHeartbeat, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [user, userRole]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Offline Recovery Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  useEffect(() => {
    if (!user) return;
    const handleOnline = async () => {
      try {
        if (Capacitor.isNativePlatform()) await createNativeChannels();
        if (!tokenRegistered) await registerToken(user.uid);
        window.dispatchEvent(new CustomEvent('olive:network:restored', { detail: { uid: user.uid } }));
      } catch (err) {
        console.warn('[PushManager] Offline recovery failed (non-fatal):', err);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, tokenRegistered, registerToken, createNativeChannels]);

  // Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Render Prompts Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
  return (
    <AnimatePresence>
      {/* Web Notification Permission Prompt */}
      {showNotifPrompt && (
        <motion.div
          key="notif-prompt"
          initial={{ opacity: 0, y: -60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm"
        >
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: 'rgba(10,10,10,0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(249,115,22,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24, #f97316)' }} />
            <button onClick={() => setShowNotifPrompt(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                <Bell className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm mb-1">Enable Order Notifications</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Get instant alerts for new orders, delivery updates, and live tracking.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => user && requestWebPermission(user.uid)}
                    className="flex-1 text-white text-sm font-black py-2.5 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                  >
                    Enable
                  </button>
                  <button
                    onClick={() => setShowNotifPrompt(false)}
                    className="px-4 text-slate-400 text-sm font-bold py-2.5 rounded-xl border border-white/10 hover:bg-white/5"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
              <ShieldCheck className="w-3 h-3 text-slate-500" />
              <p className="text-slate-600 text-[10px]">Can be disabled anytime in Settings</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Battery Optimization Advisory (Owners only, one-time) */}
      {showBatteryPrompt && (
        <motion.div
          key="battery-prompt"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] w-[90%] max-w-sm"
        >
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)' }} />
            <button
              onClick={() => {
                setShowBatteryPrompt(false);
                localStorage.setItem('olive_battery_prompt_shown', '1');
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                <BatteryWarning className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm mb-1">Ã¢Å¡Â¡ Improve Order Alerts</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Battery optimization can delay or block new order notifications. For reliable order alerts,
                  go to <span className="text-yellow-400 font-bold">Settings Ã¢” ”™ Battery Ã¢” ”™ Olive Pizza Ã¢” ”™ Unrestricted</span>.
                </p>
                <button
                  onClick={() => {
                    setShowBatteryPrompt(false);
                    localStorage.setItem('olive_battery_prompt_shown', '1');
                  }}
                  className="w-full text-white text-sm font-black py-2.5 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Location Permission Advisory (Delivery partners) */}
      {showLocationPrompt && (
        <motion.div
          key="location-prompt"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9997] w-[90%] max-w-sm"
        >
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(59,130,246,0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <button
              onClick={() => setShowLocationPrompt(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <MapPin className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm mb-1">Ã°Å¸“Â Enable Location</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Share your location to receive accurate delivery assignments and let customers track their orders.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setShowLocationPrompt(false);
                      await LocationManager.requestForegroundPermission();
                    }}
                    className="flex-1 text-white text-sm font-black py-2.5 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                  >
                    Allow Location
                  </button>
                  <button
                    onClick={() => setShowLocationPrompt(false)}
                    className="px-4 text-slate-400 text-sm font-bold py-2.5 rounded-xl border border-white/10"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬ Utilities Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬Ã¢”â‚¬
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
}


