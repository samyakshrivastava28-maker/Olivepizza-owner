import { useDataStore } from './dataStore';

interface StoreStatus {
  isRestaurantOpen: boolean;
  isDeliveryAvailable: boolean;
  canAcceptDeliveries: boolean;
  availabilityStatus: 'AVAILABLE' | 'HIGH_DEMAND' | 'NO_RIDERS' | 'CLOSED';
  availabilityMessage: string;
  isLoading: boolean;
  isWithinBusinessHours: boolean;
  deliveryRadiusKm: number;
  openingHour?: number;
  closingHour?: number;
  openingTime?: string;
  closingTime?: string;
}

export function useStoreStatus(): StoreStatus {
  return useDataStore(state => state.storeStatus);
}
