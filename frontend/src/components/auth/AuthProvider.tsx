import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';
import { UserRole } from '../../types/auth';
import { initFCMNotifications } from '../../lib/fcm';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setInitialized, setLoading, setAuthStatus, user: currentUser } = useAuthStore();
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
              const isOwnerEmail = isAuthorizedOwnerEmail(firebaseUser.email);
              let resolvedRole: UserRole = isOwnerEmail ? 'owner' : 'customer';
              let name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Owner';
              let phone = firebaseUser.phoneNumber;

              // Check Firestore user doc for role
              try {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  if (data.role) {
                    resolvedRole = data.role as UserRole;
                  }
                  if (data.name) name = data.name;
                  if (data.phone) phone = data.phone;
                }
              } catch (fsErr: any) {
                console.warn('[AuthProvider] Firestore user doc read notice:', fsErr?.message);
              }

              // Set authenticated state in store
              if (mounted) {
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name,
                    phone: phone || undefined,
                    role: resolvedRole,
                  },
                  resolvedRole as any
                );

                // Silently sync FCM tokens for owner alerts
                initFCMNotifications(firebaseUser.uid).catch(() => {});
              }
            } catch (error: any) {
              console.warn('[AuthProvider] Auth user resolution warning:', error?.message);
              if (mounted) {
                const fallbackRole = isAuthorizedOwnerEmail(firebaseUser.email) ? 'owner' : 'customer';
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName || 'Owner',
                    role: fallbackRole,
                  },
                  fallbackRole as any
                );
              }
            }
          } else {
            // Firebase Auth reported no active session
            if (mounted) {
              // If there was no cached user or auth initialized, mark unauthenticated
              setUser(null, null);
            }
          }

          if (mounted) {
            setInitialized(true);
            setLoading(false);
          }
        }, (error: any) => {
          console.warn('[AuthProvider] onAuthStateChanged error:', error?.message);
          if (mounted) {
            setLoading(false);
            setInitialized(true);
            retryTimer.current = setTimeout(setupAuth, 4000);
          }
        });
      } catch (err: any) {
        console.error('[AuthProvider] Fatal auth listener setup error:', err?.message);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [setUser, setInitialized, setLoading, setAuthStatus]);

  return <>{children}</>;
}
