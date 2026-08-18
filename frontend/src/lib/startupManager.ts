import { create } from 'zustand';

export type ServiceState = 'offline' | 'ready' | 'initializing' | 'recovering' | 'disabled';

interface StartupState {
  services: {
    firebase: ServiceState;
    auth: ServiceState;
    dataStore: ServiceState;
    notifications: ServiceState;
    ai: ServiceState;
    monitoring: ServiceState;
  };
  setServiceState: (service: keyof StartupState['services'], state: ServiceState) => void;
  isAppReady: boolean;
  setAppReady: (ready: boolean) => void;
}

export const useStartupManager = create<StartupState>((set) => ({
  services: {
    firebase: 'initializing',
    auth: 'initializing',
    dataStore: 'initializing',
    notifications: 'initializing',
    ai: 'initializing',
    monitoring: 'initializing',
  },
  setServiceState: (service, state) => 
    set((prev) => ({ services: { ...prev.services, [service]: state } })),
  isAppReady: false,
  setAppReady: (ready) => set({ isAppReady: ready }),
}));
