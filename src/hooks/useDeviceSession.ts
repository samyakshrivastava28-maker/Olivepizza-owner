import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function getDeviceFingerprint() {
  let fingerprint = localStorage.getItem('device_fingerprint');
  if (!fingerprint) {
    fingerprint = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('device_fingerprint', fingerprint);
  }
  return fingerprint;
}

export function parseUserAgent(ua: string) {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  else if (ua.includes('Trident')) browser = 'Internet Explorer';
  else if (ua.includes('Edge') || ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('X11')) os = 'UNIX';
  else if (ua.includes('Linux')) os = 'Linux';
  if (ua.includes('Android')) os = 'Android';
  if (ua.includes('like Mac')) os = 'iOS';

  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

  return { browser, os, isPWA };
}

export function useDeviceSession() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sessionActive, setSessionActive] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const deviceId = getDeviceFingerprint();
    const sessionDocId = `${uid}_${deviceId}`;
    const sessionRef = doc(db, 'device_heartbeats', sessionDocId);

    const { browser, os, isPWA } = parseUserAgent(navigator.userAgent);
    
    // Attempt to register session
    const registerSession = async () => {
      try {
        await setDoc(sessionRef, {
          uid,
          deviceId,
          deviceName: localStorage.getItem('custom_device_name') || `${browser} on ${os}${isPWA ? ' (App)' : ''}`,
          os,
          browser,
          isPWA,
          lastActive: Date.now(),
          createdAt: Date.now(),
          isActive: true
        }, { merge: true });

        // Automated Silent Token Validation / Refresh
        if (typeof window !== 'undefined' && ('Notification' in window) && window.Notification.permission === 'granted') {
          import('../lib/fcm').then(({ verifyAndRefreshTokens }) => {
            verifyAndRefreshTokens(uid).catch(console.error);
          });
        }
      } catch (err) {
        console.error("Failed to register device session:", err);
      }
    };

    registerSession();

    // Listen to session status for remote sign out
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isActive === false) {
          // This device was remotely signed out
          console.warn("Session revoked remotely");
          setSessionActive(false);
          auth.signOut();
          logout();
        }
      }
    }, (error) => {
      console.error("Session sync error", error);
    });

    // Heartbeat for last active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setDoc(sessionRef, { lastActive: Date.now() }, { merge: true }).catch(() => {});
      }
    }, 60000); // every minute

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return { sessionActive };
}
