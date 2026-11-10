import { create } from 'zustand';

export type NetworkSpeed = 'offline' | 'slow-2g' | '2g' | '3g' | '4g' | 'wifi';

interface NetworkState {
  isOnline: boolean;
  speed: NetworkSpeed;
  isSlowNetwork: boolean;
}

export const useNetworkStore = create<NetworkState>((set) => {
  const connection = (navigator as any).connection;

  const getSpeed = (): NetworkSpeed => {
    if (!navigator.onLine) return 'offline';
    if (!connection) return 'wifi'; // Fallback for browsers without network info
    return connection.effectiveType || 'wifi';
  };

  const updateNetwork = () => {
    const speed = getSpeed();
    set({
      isOnline: navigator.onLine,
      speed,
      isSlowNetwork: speed === 'slow-2g' || speed === '2g' || speed === '3g',
    });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    if (connection) {
      connection.addEventListener('change', updateNetwork);
    }
  }

  const initialSpeed = getSpeed();
  return {
    isOnline: navigator.onLine,
    speed: initialSpeed,
    isSlowNetwork: initialSpeed === 'slow-2g' || initialSpeed === '2g' || initialSpeed === '3g',
  };
});
