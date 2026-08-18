import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from '../types/auth';
import { CartItem } from '../types/models';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export const AUTHORIZED_OWNER_EMAILS = [
  'olivepizzarjn@gmail.com',
  'webhub2811@gmail.com',
];

export const isAuthorizedOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return AUTHORIZED_OWNER_EMAILS.includes(email.toLowerCase().trim());
};

// Global App State
interface AppState {
  updateAvailable: boolean;
  setUpdateAvailable: (available: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  updateAvailable: false,
  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
}));

// Owner Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user: User | null, role: 'owner' | 'admin' | 'developer' | null) => {
        set({
          user,
          role,
          isAuthenticated: !!user && !!role,
          isLoading: false,
        });
      },
      logout: async () => {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn('Sign out error:', e);
        }
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
      },
      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: 'olive-owner-auth-store',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setLoading(false);
        }
      },
    }
  )
);

// Shopping Cart Store (used by preview and showcase modals)
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
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      let newItems;
      if (existing) {
        newItems = state.items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      } else {
        newItems = [...state.items, item];
      }
      const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      return { items: newItems, total };
    }),
  removeItem: (id) =>
    set((state) => {
      const newItems = state.items.filter((i) => i.id !== id);
      const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      return { items: newItems, total };
    }),
  updateQuantity: (id, quantity) =>
    set((state) => {
      const newItems = state.items.map((i) => (i.id === id ? { ...i, quantity } : i));
      const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      return { items: newItems, total };
    }),
  clearCart: () => set({ items: [], total: 0 }),
}));

// Owner Operational POS Settings Store
interface OwnerSettingsState {
  soundEnabled: boolean;
  repeatAlarmIntervalSeconds: number;
  autoAcceptOrders: boolean;
  volume: number;
  vibrateEnabled: boolean;
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
      soundEnabled: true,
      repeatAlarmIntervalSeconds: 30,
      autoAcceptOrders: false,
      volume: 1.0,
      vibrateEnabled: true,
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
      name: 'olive-owner-settings-store',
    }
  )
);
