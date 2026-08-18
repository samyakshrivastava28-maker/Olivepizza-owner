import { getFirebaseMessaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { fetchApi } from './api';
import toast from 'react-hot-toast';
import { soundPlayer } from './audio';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const initFCMNotifications = async (userId: string): Promise<string | null> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      }
      return null;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] Notification permission not granted');
        return null;
      }

      const messaging = await getFirebaseMessaging();
      if (!messaging || !VAPID_KEY) {
        console.warn('[FCM] Messaging or VAPID_KEY not available');
        return null;
      }

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) {
        // Register token with backend
        await fetchApi('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId, platform: 'web', role: 'owner' }),
        }).catch(() => {});

        // Attach listener for foreground alerts
        onMessage(messaging, (payload) => {
          soundPlayer.playNewOrderAlarm();
          const title = payload.notification?.title || 'New Notification';
          const body = payload.notification?.body || '';
          const message = body ? `${title}: ${body}` : title;
          toast(message, { duration: 6000, icon: '🔔' });
        });

        return token;
      }
    }
  } catch (err) {
    console.warn('[FCM] Token initialization warning:', err);
  }
  return null;
};
