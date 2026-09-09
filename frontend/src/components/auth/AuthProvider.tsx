import { useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore, isAuthorizedOwnerEmail } from '../../lib/store';
import { UserRole } from '../../types/auth';
import { initFCMNotifications } from '../../lib/fcm';
import { getApiUrl } from '../../lib/config';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setInitialized, setLoading, setRestricted } = useAuthStore();
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
              const token = await firebaseUser.getIdToken();

              let isAuthorized = false;
              let serverUser: any = null;
              let denialReason = 'This Google account is not authorized to access the Olive Pizza Owner & Executive Console.';

              try {
                const authRes = await fetch(getApiUrl('/api/auth/authorize-app'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ targetApp: 'OWNER' })
                });

                if (authRes.ok) {
                  const data = await authRes.json();
                  if (data.authorized) {
                    isAuthorized = true;
                    serverUser = data.user;
                  } else {
                    denialReason = data.reason || denialReason;
                  }
                } else {
                  const data = await authRes.json().catch(() => ({}));
                  denialReason = data.reason || denialReason;
                  if (authRes.status !== 403 && isOwnerEmail) {
                    isAuthorized = true;
                  }
                }
              } catch (networkErr: any) {
                console.warn('[AuthProvider] Network error checking authorization:', networkErr);
                if (isOwnerEmail) {
                  isAuthorized = true;
                }
              }

              if (!isAuthorized) {
                console.warn(`[AuthProvider] Access restricted for ${firebaseUser.email}: ${denialReason}`);
                await signOut(auth);
                if (mounted) {
                  setRestricted(denialReason, firebaseUser.email);
                  setLoading(false);
                  setInitialized(true);
                }
                return;
              }

              // Authorized Owner/Executive
              let resolvedRole: UserRole = (serverUser?.role as UserRole) || (isOwnerEmail ? 'owner' : 'customer');
              let name = serverUser?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Owner';
              let phone = firebaseUser.phoneNumber;

              // Check Firestore user doc for extra fields if needed
              try {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  if (data.role && !serverUser?.role) {
                    resolvedRole = data.role as UserRole;
                  }
                  if (data.name) name = data.name;
                  if (data.phone) phone = data.phone;
                }
              } catch (fsErr: any) {
                console.warn('[AuthProvider] Firestore user doc read notice:', fsErr?.message);
              }

              if (mounted) {
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name,
                    phone: phone || undefined,
                    role: resolvedRole,
                  },
                  resolvedRole
                );

                initFCMNotifications(firebaseUser.uid).catch(() => {});
              }
            } catch (error: any) {
              console.warn('[AuthProvider] Auth user resolution warning:', error?.message);
              if (mounted) {
                if (isAuthorizedOwnerEmail(firebaseUser.email)) {
                  const fallbackRole = 'owner';
                  setUser(
                    {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      name: firebaseUser.displayName || 'Owner',
                      role: fallbackRole,
                    },
                    fallbackRole
                  );
                } else {
                  await signOut(auth);
                  setRestricted('Unable to verify account permissions. Please sign in again.', firebaseUser.email);
                }
              }
            }
          } else {
            if (mounted) {
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
  }, [setUser, setInitialized, setLoading, setRestricted]);

  return <>{children}</>;
}
