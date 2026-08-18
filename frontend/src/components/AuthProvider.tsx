import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../lib/store';
import { requestNotificationPermission, verifyAndRefreshTokens } from '../lib/fcm';

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
              
              if (userDoc.exists()) {
                const data = userDoc.data();
                setUser(
                  {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: data.name,
                    phone: data.phone,
                    photoURL: firebaseUser.photoURL || data.photoUrl,
                    phoneVerified: data.phoneVerified ?? false,
                    phoneSetupCompleted: data.phoneVerified ? (data.phoneSetupCompleted ?? true) : false,
                    locationSetupCompleted: data.locationSetupCompleted ?? !!data.fullAddress,
                    lat: data.lat,
                    lng: data.lng,
                    fullAddress: data.fullAddress,
                    emailVerified: firebaseUser.emailVerified,
                    approvalStatus: data.approvalStatus,
                    status: data.status,
                    photoUrl: data.photoUrl,
                    vehicleType: data.vehicleType,
                    vehicleNumber: data.vehicleNumber,
                    vehicleImage: data.vehicleImage,
                    earnings: data.earnings,
                    metrics: data.metrics,
                  },
                  (data.role === 'delivery' ? 'delivery_partner' : (data.role || (['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(firebaseUser.email?.toLowerCase() || '') ? 'owner' : 'customer')))
                );

                  // Silently verify / sync push tokens for already-granted sessions
                  verifyAndRefreshTokens(firebaseUser.uid).catch(() => {});
              } else {
                const fallbackRole = ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(firebaseUser.email?.toLowerCase() || '') ? 'owner' : 'customer';
                setUser({ uid: firebaseUser.uid, email: firebaseUser.email, onboardingComplete: false, emailVerified: firebaseUser.emailVerified }, fallbackRole);
              }
            } catch (error: any) {
              console.warn('[AuthProvider] Firestore read failed:', error?.code || error?.message);
              // auth/network-request-failed — user is logged in but network is unavailable
              // Still set user with cached data so app doesn't lock out
              const fallbackRole = ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(firebaseUser.email?.toLowerCase() || '') ? 'owner' : 'customer';
              setUser({ uid: firebaseUser.uid, email: firebaseUser.email, onboardingComplete: false, emailVerified: firebaseUser.emailVerified }, fallbackRole);
              
              // Retry Firestore read after 5 seconds
              if (error?.code === 'unavailable' || error?.code === 'auth/network-request-failed') {
                retryTimer.current = setTimeout(() => { if (mounted) setupAuth(); }, 5000);
              }
            }
          } else {
            logout();
          }
          setLoading(false);
        }, (error: any) => {
          // onAuthStateChanged error callback (e.g., network issue)
          console.warn('[AuthProvider] Auth state error:', error?.code || error?.message);
          setLoading(false);
          // Retry auth setup after 5 seconds
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
