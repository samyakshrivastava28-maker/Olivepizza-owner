import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { db } from './firebase';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { isItemActiveAndValid } from './scheduling';

interface DataState {
  products: any[];
  combos: any[];
  ads: any[];
  specialCategories: any[];
  coupons: any[];
  storeStatus: {
    isRestaurantOpen: boolean;
    isDeliveryAvailable: boolean;
    canAcceptDeliveries: boolean;
    availabilityStatus: 'AVAILABLE' | 'HIGH_DEMAND' | 'NO_RIDERS' | 'CLOSED';
    availabilityMessage: string;
    isLoading: boolean;
    isWithinBusinessHours: boolean;
    deliveryRadiusKm: number;
    openingHour: number;
    closingHour: number;
    openingTime: string;
    closingTime: string;
  };
  isInitialized: boolean;
  isInitializing: boolean;
  initialize: () => void;
  cleanup: () => void;
}

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

let unsubscribers: (() => void)[] = [];
let isInitializingLock = false;

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      products: [],
      combos: [],
      ads: [],
      specialCategories: [],
      coupons: [],
      storeStatus: {
        isRestaurantOpen: true,
        isDeliveryAvailable: true,
        canAcceptDeliveries: true,
        availabilityStatus: 'AVAILABLE',
        availabilityMessage: 'Delivery available',
        isLoading: true,
        isWithinBusinessHours: true,
        deliveryRadiusKm: 5,
        openingHour: 12,
        closingHour: 24,
        openingTime: "12:00",
        closingTime: "24:00"
      },
      isInitialized: false,
      isInitializing: false,
      
      initialize: () => {
        if (get().isInitialized || get().isInitializing || isInitializingLock) return;
        isInitializingLock = true;
        set({ isInitializing: true });

        unsubscribers.forEach((unsub) => unsub());
        unsubscribers = [];

        import('./config').then(({ OPENING_HOUR, CLOSING_HOUR }) => {
          const currentHour = new Date().getHours();
          const isWithinHours = currentHour >= OPENING_HOUR && currentHour < CLOSING_HOUR;
          set((state) => ({ storeStatus: { ...state.storeStatus, isWithinBusinessHours: isWithinHours } }));
        });

        // Filter any cached items from IDB to purge expired items immediately
        const state = get();
        set({
          ads: (state.ads || []).filter(isItemActiveAndValid),
          coupons: (state.coupons || []).filter(isItemActiveAndValid),
          combos: (state.combos || []).filter(isItemActiveAndValid),
          specialCategories: (state.specialCategories || []).filter(isItemActiveAndValid),
        });

        const retryTimers: Record<string, ReturnType<typeof setTimeout>> = {};
        const backoffMap: Record<string, number> = {};

        const handleError = (key: string, setupFn: () => void) => (error: any) => {
          console.warn(`[dataStore] Firebase listener failed for ${key}:`, error);
          const currentBackoff = backoffMap[key] || 1000;
          backoffMap[key] = Math.min(currentBackoff * 2, 30000);
          
          if (retryTimers[key]) clearTimeout(retryTimers[key]);
          retryTimers[key] = setTimeout(() => {
            console.log(`[dataStore] Retrying ${key} after ${currentBackoff}ms`);
            setupFn();
          }, currentBackoff);
        };

        const setupSettings = () => {
          const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const openH = data.openingHour !== undefined ? Number(data.openingHour) : (data.openingTime ? parseInt(data.openingTime.split(':')[0]) : 0);
              const closeH = data.closingHour !== undefined ? Number(data.closingHour) : (data.closingTime ? parseInt(data.closingTime.split(':')[0]) : 24);
              const currentHour = new Date().getHours();
              
              const is24Hours = data.is24x7 === true ||
                (openH === 0 && (closeH >= 23 || closeH === 24 || data.closingTime === '23:59' || String(data.businessHours).includes('23:59') || String(data.businessHours).toLowerCase().includes('24')));

              let isWithinHours = true;
              if (!is24Hours) {
                if (openH <= closeH) {
                  isWithinHours = currentHour >= openH && currentHour < closeH;
                } else {
                  isWithinHours = currentHour >= openH || currentHour < closeH;
                }
              }

              const isDeliveryAvail = data.isDeliveryAvailable ?? true;
              const isRestOpen = (data.isRestaurantOpen ?? true) && isWithinHours;
              let availStatus: 'AVAILABLE' | 'HIGH_DEMAND' | 'NO_RIDERS' | 'CLOSED' = 'AVAILABLE';
              let availMsg = 'Delivery available';

              if (!isRestOpen) {
                availStatus = 'CLOSED';
                availMsg = 'Restaurant is currently closed';
              } else if (!isDeliveryAvail) {
                availStatus = 'NO_RIDERS';
                availMsg = 'Delivery unavailable';
              }

              set({ storeStatus: {
                isRestaurantOpen: isRestOpen,
                isDeliveryAvailable: isDeliveryAvail,
                canAcceptDeliveries: isRestOpen && isDeliveryAvail,
                availabilityStatus: availStatus,
                availabilityMessage: availMsg,
                isLoading: false,
                isWithinBusinessHours: isWithinHours,
                deliveryRadiusKm: data.deliveryRadiusKm ?? 5,
                openingHour: openH,
                closingHour: closeH,
                openingTime: data.openingTime || "00:00",
                closingTime: data.closingTime || "23:59"
              }});
            } else {
              set((state) => ({ storeStatus: { ...state.storeStatus, isLoading: false }}));
            }
            backoffMap['settings'] = 1000;
          }, handleError('settings', setupSettings));
          unsubscribers.push(unsubSettings);
        };
        setupSettings();

        const setupProducts = () => {
          const unsubProducts = onSnapshot(
            query(collection(db, 'products'), where('isActive', '==', true)),
            (snap) => {
              const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
              products.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
              set({ products });
              backoffMap['products'] = 1000;
            },
            handleError('products', setupProducts)
          );
          unsubscribers.push(unsubProducts);
        };
        setupProducts();

        const setupCombos = () => {
          const unsubCombos = onSnapshot(
            query(collection(db, 'combos'), where('isActive', '==', true)),
            (snap) => {
              const rawCombos = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), isCombo: true }));
              const combos = rawCombos.filter(isItemActiveAndValid);
              combos.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
              set({ combos });
              backoffMap['combos'] = 1000;
            },
            handleError('combos', setupCombos)
          );
          unsubscribers.push(unsubCombos);
        };
        setupCombos();

        const setupAds = () => {
          const unsubAds = onSnapshot(
            collection(db, 'ads'),
            (snap) => {
              const rawAds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const ads = rawAds.filter((ad: any) => ad.isActive !== false && isItemActiveAndValid(ad));
              ads.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
              set({ ads });
              backoffMap['ads'] = 1000;
            },
            handleError('ads', setupAds)
          );
          unsubscribers.push(unsubAds);
        };
        setupAds();
        
        const setupSpecial = () => {
          const unsubSpecial = onSnapshot(
            query(collection(db, 'special_categories'), where('isActive', '==', true)),
            (snap) => {
              const rawCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const categories = rawCategories.filter(isItemActiveAndValid);
              categories.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
              set({ specialCategories: categories });
              backoffMap['special'] = 1000;
            },
            handleError('special', setupSpecial)
          );
          unsubscribers.push(unsubSpecial);
        };
        setupSpecial();

        const setupCoupons = () => {
          const unsubCoupons = onSnapshot(
            query(collection(db, 'coupons'), where('isActive', '==', true)),
            (snap) => {
              const rawCoupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const coupons = rawCoupons.filter(isItemActiveAndValid);
              set({ coupons });
              backoffMap['coupons'] = 1000;
            },
            handleError('coupons', setupCoupons)
          );
          unsubscribers.push(unsubCoupons);
        };
        setupCoupons();

        set({ isInitialized: true, isInitializing: false });
        isInitializingLock = false;
      },

      cleanup: () => {
        unsubscribers.forEach((unsub) => unsub());
        unsubscribers = [];
        isInitializingLock = false;
        set({ isInitialized: false, isInitializing: false });
      }
    }),
    {
      name: 'olive-pizza-data-cache',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        products: state.products,
        combos: state.combos,
        ads: state.ads,
        specialCategories: state.specialCategories,
        coupons: state.coupons,
        storeStatus: state.storeStatus,
      }), // ONLY persist data. DO NOT persist isInitialized so listeners always attach once per app load.
    }
  )
);
