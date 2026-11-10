import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface MetricsState {
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  monthOrders: number;
  pending: number;
  preparing: number;
  outForDelivery: number;
  completed: number;
  cancelled: number;
  activeCustomers: number;
  partnersOnline: number;
  ownersOnline: number;
  error: string | null;
  isInitialized: boolean;
  init: () => void;
  cleanup: () => void;
}

let unsubOrders: (() => void) | null = null;
let unsubPartners: (() => void) | null = null;

const getTimestampMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export const useLiveMetricsStore = create<MetricsState>((set, get) => ({
  todayRevenue: 0,
  todayOrders: 0,
  monthRevenue: 0,
  monthOrders: 0,
  pending: 0,
  preparing: 0,
  outForDelivery: 0,
  completed: 0,
  cancelled: 0,
  activeCustomers: 0,
  partnersOnline: 0,
  ownersOnline: 1,
  error: null,
  isInitialized: false,

  init: () => {
    if (get().isInitialized) return; // Prevent duplicate listeners

    const ordersRef = collection(db, "orders");
    const qRecent = query(ordersRef, orderBy("createdAt", "desc"), limit(300));

    try {
      unsubOrders = onSnapshot(qRecent, (snapshot) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfTodayMs = today.getTime();

        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
        const startOfMonthMs = firstOfMonth.getTime();

        let todayRevenue = 0, todayOrders = 0;
        let monthRevenue = 0, monthOrders = 0;
        let pending = 0, preparing = 0, outForDelivery = 0, completed = 0, cancelled = 0;

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const status = (data.status || '').toLowerCase();
          const amount = Number(data.totalAmount || data.total_amount || 0);
          const orderTimeMs = getTimestampMillis(data.createdAt);

          const isTerminalFailed = ['cancelled', 'payment_failed', 'failed', 'rejected'].includes(status);

          // Today Metrics
          if (orderTimeMs >= startOfTodayMs) {
            if (!isTerminalFailed) {
              todayOrders++;
              todayRevenue += amount;
            }

            if (['pending', 'placed', 'created', 'new_order', 'pending_acceptance', 'paid', 'payment_success'].includes(status)) {
              pending++;
            } else if (['preparing', 'accepted', 'cooking'].includes(status)) {
              preparing++;
            } else if (['out_for_delivery', 'picked_up', 'partner_assigned', 'ready'].includes(status)) {
              outForDelivery++;
            } else if (['delivered', 'completed'].includes(status)) {
              completed++;
            } else if (['cancelled', 'rejected', 'failed'].includes(status)) {
              cancelled++;
            }
          }

          // Month Metrics
          if (orderTimeMs >= startOfMonthMs && !isTerminalFailed) {
            monthOrders++;
            monthRevenue += amount;
          }
        });

        set({ 
          todayRevenue, 
          todayOrders, 
          monthRevenue,
          monthOrders,
          pending, 
          preparing, 
          outForDelivery, 
          completed, 
          cancelled, 
          error: null 
        });
      }, (error) => {
        console.warn('[useLiveMetrics] Firestore orders error:', error.code || error.message);
        set({ error: error.code || 'Network error' });
      });
    } catch (e: any) {
      console.error('[useLiveMetrics] Failed to subscribe:', e.message);
    }

    try {
      unsubPartners = onSnapshot(
        query(collection(db, "users"), where("role", "in", ["delivery_partner", "delivery"])),
        (snapshot) => {
          let onlineCount = 0;
          snapshot.docs.forEach(d => {
            const u = d.data();
            const status = (u.deliveryStatus || u.status || '').toLowerCase();
            if (status === 'online' || status === 'on_delivery' || status === 'busy' || u.isOnline) {
              onlineCount++;
            }
          });
          set({ partnersOnline: onlineCount, ownersOnline: 1 });
        },
        (error) => { console.warn('[useLiveMetrics] Partners error:', error.code); }
      );
    } catch (e: any) {
      console.warn('[useLiveMetrics] Failed to subscribe to partners:', e.message);
    }

    set({ isInitialized: true });
  },

  cleanup: () => {
    if (unsubOrders) {
      unsubOrders();
      unsubOrders = null;
    }
    if (unsubPartners) {
      unsubPartners();
      unsubPartners = null;
    }
    set({ isInitialized: false });
  }
}));

// Wrapper hook to keep API identical for existing components, while fixing the underlying memory leak
import { useEffect } from 'react';
export const useLiveMetrics = () => {
  const store = useLiveMetricsStore();
  
  useEffect(() => {
    store.init();
    // We don't cleanup on unmount because we want the singleton to persist across component unmounts (e.g. tabs).
    // The App or Auth provider should handle global cleanup if the user logs out.
  }, [store]);

  return store;
};
