import { useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../lib/store';
import { UserRole } from '../../types/auth';
import { initFCMNotifications } from '../../lib/fcm';
import { getApiUrl } from '../../lib/config';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setInitialized, setLoading, setRestricted, setDatabaseUnavailable, clearRestricted } = useAuthStore();
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
              setLoading(true);
              const token = await firebaseUser.getIdToken();

              // Database-Authoritative Handshake
              let authRes: Response | null = null;
              try {
                authRes = await fetch(getApiUrl('/api/auth/authorize-app'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ targetApp: 'OWNER' })
                });
              } catch (networkErr: any) {
                console.warn('[AuthProvider] Backend network error during handshake:', networkErr?.message);
                if (mounted) {
                  // Retain session, do NOT sign out, mark database/network unavailable
                  setDatabaseUnavailable(true);
                  setLoading(false);
                  setInitialized(true);
                }
                return;
              }

              // Handle Database Outage (HTTP 503)
              if (authRes.status === 503) {
                console.warn('[AuthProvider] Database unavailable (503). Retaining Firebase session.');
                if (mounted) {
                  setDatabaseUnavailable(true);
                  setLoading(false);
                  setInitialized(true);
                }
                return;
              }

              // Handle Unauthorized / Access Denied (HTTP 403 or non-OK)
              if (authRes.status === 403) {
                const data = await authRes.json().catch(() => ({}));
                const denialReason = data.reason || 'This account is not authorized to access the Olive Pizza Owner & Executive Console.';
                console.warn(`[AuthProvider] Access denied (403): ${denialReason}`);
                await signOut(auth);
                if (mounted) {
                  setRestricted(denialReason, firebaseUser.email);
                  setUser(null, null);
                  setDatabaseUnavailable(false);
                  setLoading(false);
                  setInitialized(true);
                }
                return;
              }

              // Handle Expired / Invalid Token (HTTP 401)
              if (authRes.status === 401) {
                console.warn('[AuthProvider] Authentication token expired or invalid (401).');
                await signOut(auth);
                if (mounted) {
                  setUser(null, null);
                  setDatabaseUnavailable(false);
                  setLoading(false);
                  setInitialized(true);
                }
                return;
              }

              // Handle OK response (HTTP 200)
              if (authRes.ok) {
                const data = await authRes.json();
                if (data.authorized && data.user) {
                  const serverRole: UserRole = data.user.role;
                  // Strictly verify owner or platform_owner role
                  if (serverRole !== 'owner' && serverRole !== 'platform_owner') {
                    console.warn(`[AuthProvider] Account role "${serverRole}" is not authorized for the Owner Portal.`);
                    await signOut(auth);
                    if (mounted) {
                      setRestricted(`Access denied: Your assigned role is "${serverRole}". The Owner Portal requires the Platform Owner role.`, firebaseUser.email);
                      setUser(null, null);
                      setLoading(false);
                      setInitialized(true);
                    }
                    return;
                  }

                  if (mounted) {
                    clearRestricted();
                    setDatabaseUnavailable(false);
                    setUser(
                      {
                        uid: data.user.uid || firebaseUser.uid,
                        email: data.user.email || firebaseUser.email,
                        name: data.user.name || firebaseUser.displayName || 'Platform Owner',
                        phone: data.user.phone || firebaseUser.phoneNumber || undefined,
                        role: serverRole,
                        allowedApps: data.allowedApps || ['OWNER'],
                        applicationAccess: data.appAccess || { app_owner: true },
                        permissions: data.permissions || ['owner.all'],
                        branchId: data.branchId || 'main_branch',
                        branchIds: data.branchIds || ['main_branch'],
                        franchiseId: data.franchiseId || 'fra_rajnandgaon',
                      },
                      serverRole,
                      data.user
                    );
                    setLoading(false);
                    setInitialized(true);

                    initFCMNotifications(firebaseUser.uid).catch(() => {});
                  }
                  return;
                } else {
                  // Not authorized according to response body
                  const denialReason = data.reason || 'Account not authorized for OWNER application.';
                  await signOut(auth);
                  if (mounted) {
                    setRestricted(denialReason, firebaseUser.email);
                    setUser(null, null);
                    setLoading(false);
                    setInitialized(true);
                  }
                  return;
                }
              }

              // Unhandled status code fallback
              const errData = await authRes.json().catch(() => ({}));
              await signOut(auth);
              if (mounted) {
                setRestricted(errData.reason || 'Failed to verify account authorization with the server.', firebaseUser.email);
                setUser(null, null);
                setLoading(false);
                setInitialized(true);
              }
            } catch (error: any) {
              console.warn('[AuthProvider] Auth user resolution error:', error?.message);
              await signOut(auth);
              if (mounted) {
                setRestricted('Unable to verify account permissions. Please sign in again.', firebaseUser.email);
                setUser(null, null);
                setLoading(false);
                setInitialized(true);
              }
            }
          } else {
            if (mounted) {
              setUser(null, null);
              setDatabaseUnavailable(false);
              setLoading(false);
              setInitialized(true);
            }
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
  }, [setUser, setInitialized, setLoading, setRestricted, setDatabaseUnavailable, clearRestricted]);

  return <>{children}</>;
}
