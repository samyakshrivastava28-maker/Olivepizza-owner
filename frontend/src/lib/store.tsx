import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// App Store (For PWA and Global UI states)
interface AppState {
  updateAvailable: boolean;
  setUpdateAvailable: (available: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  updateAvailable: false,
  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
}));

// Authentication Store
import { useDataStore } from './dataStore';

interface AuthState {
  user: any | null;
  role: 'customer' | 'owner' | 'delivery_partner' | 'delivery' | 'admin' | 'developer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: any, role: 'customer' | 'owner' | 'delivery_partner' | 'delivery' | 'admin' | 'developer') => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user, role) => {
        const prevRole = useAuthStore.getState().role;
        set({ user, role, isAuthenticated: !!user, isLoading: false });

        // Role-Aware Permission Policy
        if (user && (role === 'owner' || role === 'delivery_partner')) {
          import('../lib/platform').then(({ isCapacitorNative }) => {
            if (isCapacitorNative()) {
              const storageKey = `olive_staff_permissions_${role}`;
              const alreadyPrompted = localStorage.getItem(storageKey);
              const isRoleTransition = prevRole && prevRole !== role;

              // Only prompt if not yet prompted for this role, or if user transitioned into this role
              if (!alreadyPrompted || isRoleTransition) {
                localStorage.setItem(storageKey, 'true');
                import('../plugins/AlarmPermission').then(({ AlarmPermission }) => {
                  AlarmPermission.setupPermissions({ role }).catch(err =>
                    console.warn('[AlarmPermission] Non-fatal setup error:', err)
                  );
                }).catch(console.error);
              }
            }
          });
        } else if (role === 'customer') {
          // If transitioned from delivery_partner to customer, stop delivery background tracking
          if (prevRole === 'delivery_partner') {
            import('../lib/platform').then(({ isCapacitorNative }) => {
              if (isCapacitorNative()) {
                import('./DeliveryPlugin').then(({ DeliveryPlugin }) => {
                  DeliveryPlugin.stopTracking().catch(() => {});
                }).catch(() => {});
              }
            });
          }
        }
      },
      logout: () => {
        useDataStore.getState().cleanup();
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'olive-auth-store',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.isAuthenticated) {
          state.setLoading(false);
        }
      }
    }
  )
);

// Shopping Cart Store
import { CartItem } from '../types/models';
import toast from 'react-hot-toast';

interface CartState {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  total: 0,
  addItem: (item) => set((state) => {
    if (useAppStore.getState().updateAvailable) {
      toast.error(
        (t) => (
          <div className="flex flex-col gap-2 pointer-events-auto">
            <p className="font-bold">Update Required</p>
            <p className="text-sm">You are using an old version which does not support the current version.</p>
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                window.dispatchEvent(new Event('trigger-pwa-update'));
              }}
              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold mt-1"
            >
              Update Now
            </button>
          </div>
        ),
        { duration: 8000 }
      );
      return state;
    }

    const existing = state.items.find(i => i.id === item.id);
    let newItems;
    if (existing) {
      newItems = state.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
    } else {
      newItems = [...state.items, item];
    }
    const total = newItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    return { items: newItems, total };
  }),
  removeItem: (id) => set((state) => {
    const newItems = state.items.filter(i => i.id !== id);
    const total = newItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    return { items: newItems, total };
  }),
  updateQuantity: (id, quantity) => set((state) => {
    const newItems = state.items.map(i => i.id === id ? { ...i, quantity } : i);
    const total = newItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    return { items: newItems, total };
  }),
  clearCart: () => set({ items: [], total: 0 }),
}));

// Owner POS Alert Settings Store
interface OwnerSettingsState {
  enableNewOrderSound: boolean;
  enableReminderSound: boolean;
  enableUrgentSound: boolean;
  enableBrowserNotifications: boolean;
  enableVibrations: boolean;
  repeatInterval: number;
  volumeLevel: number;
  muteMode: boolean;
  updateSettings: (settings: Partial<OwnerSettingsState>) => void;
}

export const useOwnerSettingsStore = create<OwnerSettingsState>()(
  persist(
    (set) => ({
      enableNewOrderSound: true,
      enableReminderSound: true,
      enableUrgentSound: true,
      enableBrowserNotifications: true,
      enableVibrations: true,
      repeatInterval: 60,
      volumeLevel: 1.0,
      muteMode: false,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'olive-owner-settings',
    }
  )
);
