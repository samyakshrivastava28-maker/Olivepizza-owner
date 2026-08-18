import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from '../types/auth';
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

interface OwnerSettingsState {
  soundEnabled: boolean;
  repeatAlarmIntervalSeconds: number;
  autoAcceptOrders: boolean;
  volume: number;
  vibrateEnabled: boolean;
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
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'olive-owner-settings-store',
    }
  )
);
