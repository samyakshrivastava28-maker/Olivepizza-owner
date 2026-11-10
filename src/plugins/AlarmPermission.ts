import { registerPlugin } from '@capacitor/core';

export interface AlarmPermissionPluginRegistry {
  setupPermissions(options?: { role?: string; force?: boolean }): Promise<{ success: boolean; skipped?: boolean; role?: string; reason?: string }>;
  checkPermissions(): Promise<{ canUseFullScreenIntent: boolean; isBatteryOptimized: boolean }>;
  requestFullScreenPermission(): Promise<{ success: boolean }>;
  requestBatteryOptimization(options?: { role?: string }): Promise<{ success: boolean }>;
}

export const AlarmPermission = registerPlugin<AlarmPermissionPluginRegistry>('AlarmPermission');
