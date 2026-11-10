import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types/auth';
import { CartItem } from '../types/models';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export type AuthStatus = 'IDLE' | 'LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR';

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  serverUser: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isDatabaseUnavailable: boolean;
  authStatus: AuthStatus;
  restrictedReason: string | null;
  restrictedEmail: string | null;
  setUser: (user: User | null, role: UserRole | null, serverUser?: any) => void;
  setDatabaseUnavailable: (isDatabaseUnavailable: boolean) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setInitialized: (isInitialized: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setRestricted: (reason: string | null, email?: string | null) => void;
  clearRestricted: () => void;
  logout: () => Promise<void>;
}

// Global App State
interface AppState {
  updateAvailable: boolean;
  setUpdateAvailable: (available: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  updateAvailable: false,
  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
}));

// Owner Auth Store - Database-Authoritative Session Management
// Sensitive authorization decisions are NEVER persisted in localStorage to prevent bypass.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      serverUser: null,
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,
      isDatabaseUnavailable: false,
      authStatus: 'IDLE',
      restrictedReason: null,
      restrictedEmail: null,

      setUser: (user: User | null, role: UserRole | null, serverUser?: any) => {
        const isAuth = !!user && (role === 'owner' || role === 'platform_owner');
        set({
          user,
          role,
          serverUser: serverUser || null,
          isAuthenticated: isAuth,
          isLoading: false,
          isInitialized: true,
          isDatabaseUnavailable: false,
          authStatus: isAuth ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
          restrictedReason: isAuth ? null : undefined,
          restrictedEmail: isAuth ? null : undefined,
        });
      },

      setDatabaseUnavailable: (isDatabaseUnavailable: boolean) => {
        set({
          isDatabaseUnavailable,
          isLoading: false,
          isInitialized: true,
        });
      },

      setAuthStatus: (authStatus: AuthStatus) => {
        set({
          authStatus,
          isAuthenticated: authStatus === 'AUTHENTICATED',
          isLoading: authStatus === 'LOADING',
        });
      },

      setInitialized: (isInitialized: boolean) => set({ isInitialized }),
      setLoading: (isLoading: boolean) => set({ isLoading }),

      setRestricted: (reason: string | null, email?: string | null) => {
        set({
          restrictedReason: reason,
          restrictedEmail: email || null,
          user: null,
          role: null,
          serverUser: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          authStatus: 'UNAUTHENTICATED',
        });
      },

      clearRestricted: () => {
        set({
          restrictedReason: null,
          restrictedEmail: null,
        });
      },

      logout: async () => {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn('[useAuthStore] Firebase signOut notice:', e);
        }
        set({
          user: null,
          role: null,
          serverUser: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          isDatabaseUnavailable: false,
          authStatus: 'UNAUTHENTICATED',
          restrictedReason: null,
          restrictedEmail: null,
        });
      },
    }),
    {
      name: 'olive-owner-auth-store',
      // Strict Security: Stale localStorage cannot bypass server authorization
      partialize: (state) => ({
        restrictedReason: state.restrictedReason,
        restrictedEmail: state.restrictedEmail,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Always require live handshake verification on reload
          state.setLoading(true);
          state.setInitialized(false);
        }
      },
    }
  )
);

// Shopping Cart Store
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
      const newItems = quantity <= 0
        ? state.items.filter((i) => i.id !== id)
        : state.items.map((i) => (i.id === id ? { ...i, quantity } : i));
      const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      return { items: newItems, total };
    }),
  clearCart: () => set({ items: [], total: 0 }),
}));


// Owner Audio and App Settings Store
interface OwnerSettingsState {
  soundEnabled: boolean;
  volume: number;
  repeatAlarmIntervalSeconds: number;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setRepeatAlarmIntervalSeconds: (seconds: number) => void;
}

export const useOwnerSettingsStore = create<OwnerSettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 1.0,
      repeatAlarmIntervalSeconds: 30,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume }),
      setRepeatAlarmIntervalSeconds: (repeatAlarmIntervalSeconds) => set({ repeatAlarmIntervalSeconds }),
    }),
    {
      name: 'olive-owner-settings-store',
    }
  )
);
