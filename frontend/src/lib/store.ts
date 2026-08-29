import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types/auth';
import { CartItem } from '../types/models';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

export const AUTHORIZED_OWNER_EMAILS = [
  'olivepizzarjn@gmail.com',
  'webhub2811@gmail.com',
  'olivepizzamaker@gmail.com'
];

export const isAuthorizedOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return AUTHORIZED_OWNER_EMAILS.includes(email.toLowerCase().trim());
};

export type AuthStatus = 'IDLE' | 'LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR';

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  authStatus: AuthStatus;
  setUser: (user: User | null, role: UserRole | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setInitialized: (isInitialized: boolean) => void;
  setLoading: (isLoading: boolean) => void;
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

// Owner Auth Store with persistent session cache
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,
      authStatus: 'IDLE',

      setUser: (user: User | null, role: UserRole | null) => {
        const isAuth = !!user && !!role;
        set({
          user,
          role,
          isAuthenticated: isAuth,
          isLoading: false,
          isInitialized: true,
          authStatus: isAuth ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
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

      logout: async () => {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn('[useAuthStore] Firebase signOut notice:', e);
        }
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          authStatus: 'UNAUTHENTICATED',
        });
      },
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
          // Keep isLoading true until Firebase Auth finishes its onAuthStateChanged check,
          // but preserve state.user and state.isAuthenticated for seamless transitions
          state.setLoading(false);
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
      if (quantity <= 0) {
        const newItems = state.items.filter((i) => i.id !== id);
        const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
        return { items: newItems, total };
      }
      const newItems = state.items.map((i) =>
        i.id === id ? { ...i, quantity } : i
      );
      const total = newItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      return { items: newItems, total };
    }),
  clearCart: () => set({ items: [], total: 0 }),
}));

// Owner Audio and App Settings Store
interface OwnerSettingsState {
  soundEnabled: boolean;
  volume: number;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

export const useOwnerSettingsStore = create<OwnerSettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 1.0,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume }),
    }),
    {
      name: 'olive-owner-settings-store',
    }
  )
);
