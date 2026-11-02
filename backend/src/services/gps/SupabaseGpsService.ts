/**
 * SupabaseGpsService.ts — GPS Service Gateway (Consolidated to Main PostgreSQL)
 * 
 * Complies with Phase 7 Architecture:
 * 1. Main PostgreSQL is the sole authoritative source for live rider GPS telemetry,
 *    breadcrumbs, and navigation sessions.
 * 2. Eliminates external Supabase GPS database dependency.
 * 3. All calls seamlessly delegate to PostgresGpsService.
 */

import { PostgresGpsService, GpsLocationPayload, NavigationSessionPayload, NavigationPointPayload } from './PostgresGpsService.js';

export type { GpsLocationPayload, NavigationSessionPayload, NavigationPointPayload };

export class SupabaseGpsService {
  /**
   * Upsert the latest live GPS coordinate for a delivery partner into PostgreSQL delivery_locations.
   */
  public static async upsertLatestLocation(payload: GpsLocationPayload): Promise<{ success: boolean; error?: string }> {
    return PostgresGpsService.upsertLatestLocation(payload);
  }

  /**
   * Retrieve the latest GPS location for a specific delivery partner from PostgreSQL.
   */
  public static async getLatestLocation(deliveryPartnerId: string): Promise<any | null> {
    const loc = await PostgresGpsService.getLatestLocation(deliveryPartnerId);
    if (!loc) return null;
    return {
      delivery_partner_id: loc.deliveryPartnerId,
      active_order_id: loc.activeOrderId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
      online_status: loc.onlineStatus,
      last_updated: loc.lastUpdated,
      is_stale: loc.isStale,
    };
  }

  /**
   * Retrieve the latest GPS location for an active order from PostgreSQL.
   */
  public static async getLatestLocationByOrder(orderId: string): Promise<any | null> {
    const loc = await PostgresGpsService.getLatestLocationByOrder(orderId);
    if (!loc) return null;
    return {
      delivery_partner_id: loc.deliveryPartnerId,
      active_order_id: loc.activeOrderId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
      online_status: loc.onlineStatus,
      last_updated: loc.lastUpdated,
      is_stale: loc.isStale,
    };
  }

  /**
   * Retrieve all currently online rider locations from PostgreSQL.
   */
  public static async getActiveLocations(): Promise<any[]> {
    const locations = await PostgresGpsService.getActiveLocations();
    return locations.map(loc => ({
      delivery_partner_id: loc.deliveryPartnerId,
      active_order_id: loc.activeOrderId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
      online_status: loc.onlineStatus,
      last_updated: loc.lastUpdated,
      is_stale: loc.isStale,
    }));
  }

  /**
   * Start a new navigation session in PostgreSQL.
   */
  public static async startNavigationSession(payload: NavigationSessionPayload): Promise<{ success: boolean; error?: string }> {
    return PostgresGpsService.startNavigationSession(payload);
  }

  /**
   * Append a high-frequency breadcrumb navigation point into PostgreSQL navigation_points.
   */
  public static async appendNavigationPoint(payload: NavigationPointPayload): Promise<{ success: boolean; error?: string }> {
    return PostgresGpsService.appendNavigationPoint(payload);
  }

  /**
   * Mark a navigation session as COMPLETED in PostgreSQL.
   */
  public static async endNavigationSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    return PostgresGpsService.endNavigationSession(sessionId);
  }

  /**
   * Set active order for rider in PostgreSQL live GPS delivery_locations and delivery_partners.
   */
  public static async setActiveOrder(deliveryPartnerId: string, orderId: string): Promise<void> {
    return PostgresGpsService.setActiveOrder(deliveryPartnerId, orderId);
  }

  /**
   * Clear active order on rider location upon order delivery or cancellation.
   */
  public static async clearActiveOrder(deliveryPartnerId: string, orderId?: string): Promise<void> {
    return PostgresGpsService.clearActiveOrder(deliveryPartnerId, orderId);
  }

  /**
   * Set online status for rider in PostgreSQL delivery_locations and delivery_partners.
   */
  public static async setOnlineStatus(deliveryPartnerId: string, onlineStatus: boolean): Promise<void> {
    return PostgresGpsService.setOnlineStatus(deliveryPartnerId, onlineStatus);
  }

  /**
   * Prune high-frequency GPS breadcrumbs older than retention window (default 5 minutes).
   */
  public static async pruneStaleNavigationPoints(retentionMinutes = 5): Promise<number> {
    const result = await PostgresGpsService.pruneStaleGpsData(retentionMinutes);
    return result.prunedPoints;
  }

  /**
   * Remove GPS entries for orders that ended more than 5 minutes ago.
   */
  public static async cleanupDeliveredGps(orderId: string): Promise<void> {
    try {
      await PostgresGpsService.cleanupDeliveredGps(orderId);
    } catch (err: any) {
      console.warn('[SupabaseGpsService] Notice cleaning delivered GPS in PostgreSQL:', err?.message);
    }
  }
}
