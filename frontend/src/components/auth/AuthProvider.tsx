import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';
import { initFCMNotifications } from '../../lib/fcm';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, logout } = useAuthStore();
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    const setupAuth = () => {
      try {
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!mounted) return;
          if (firebaseUser) {
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (!mounted) return;

              const isOwnerEmail = isAuthorizedOwnerEmail(firebaseUser.email);
              
              if (userDoc.exists()) {
                const data = userDoc.data();
                const resolvedRole = isOwnerEmail ? 'owner' : (data.role || 'customer');
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: data.name || firebaseUser.displayName || 'Owner',
                    phone: data.phone,
                    role: resolvedRole,
                  },
                  resolvedRole
                );

                // Silently sync FCM tokens for owner alerts
                initFCMNotifications(firebaseUser.uid).catch(() => {});
              } else {
                const fallbackRole = isOwnerEmail ? 'owner' : 'customer';
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName || 'Owner',
                    role: fallbackRole,
                  },
                  fallbackRole
                );
              }
            } catch (error: any) {
              console.warn('[AuthProvider] Firestore read failed:', error?.message);
              const fallbackRole = isAuthorizedOwnerEmail(firebaseUser.email) ? 'owner' : 'customer';
              setUser(
                {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  name: firebaseUser.displayName || 'Owner',
                  role: fallbackRole,
                },
                fallbackRole
              );
            }
          } else {
            logout();
          }
          setLoading(false);
        }, (error: any) => {
          console.warn('[AuthProvider] Auth state error:', error?.message);
          setLoading(false);
          if (mounted) {
            retryTimer.current = setTimeout(setupAuth, 5000);
          }
        });
      } catch (err: any) {
        console.error('[AuthProvider] Fatal auth init error:', err?.message);
        setLoading(false);
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [setUser, setLoading, logout]);

  return <>{children}</>;
}
