import { useEffect } from 'react';
import { useAuthStore } from '../lib/store';

export function useHeartbeat() {
  const { user, role, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    if (role !== 'owner' && role !== 'delivery_partner') return;

    const sendHeartbeat = async () => {
      try {
        let batteryLevel = null;
        let connectionQuality = (navigator as any).connection?.effectiveType || 'unknown';

        if ('getBattery' in navigator) {
          const battery: any = await (navigator as any).getBattery();
          batteryLevel = battery.level;
        }

        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid,
            deviceName: navigator.userAgent,
            browser: navigator.userAgent,
            platform: navigator.platform,
            appVersion: '1.0.0',
            isOnline: navigator.onLine,
            notificationReady: typeof window !== 'undefined' && ('Notification' in window) && window.Notification.permission === 'granted',
            batteryLevel,
            connectionQuality
          }),
        });
      } catch (err) {
        console.error('Failed to send heartbeat', err);
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Send every 3 minutes
    const intervalId = setInterval(sendHeartbeat, 3 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user, role, isAuthenticated]);
}
