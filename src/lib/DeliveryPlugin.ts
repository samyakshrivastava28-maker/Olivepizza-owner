import { registerPlugin } from '@capacitor/core';

export interface DeliveryPluginRegistry {
  startTracking(options: { orderId: string; token: string }): Promise<void>;
  stopTracking(): Promise<void>;
  checkBatteryOptimization(): Promise<{ isOptimized: boolean }>;
}

export const DeliveryPlugin = registerPlugin<DeliveryPluginRegistry>('DeliveryPlugin');
