/**
 * SupabaseGpsService.ts — Authoritative Supabase High-Frequency GPS Service
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * 1. Supabase PostgreSQL is the EXCLUSIVE database for live rider GPS telemetry,
 *    breadcrumbs, and Realtime event broadcast.
 * 2. It is NEVER used for business data (orders, payments, products, users).
 * 3. All live location writes from riders route through here, directly updating
 *    Supabase delivery_locations and navigation_points tables to trigger
 *    Supabase Realtime for the Owner Live Map and Customer Tracking.
 */

import { supabaseNav } from '../../config/supabase.js';

export interface GpsLocationPayload {
  deliveryPartnerId: string;
  activeOrderId?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  onlineStatus?: boolean;
}

export interface NavigationSessionPayload {
  sessionId: string;
  orderId: string;
  deliveryPartnerId: string;
  expiresAt?: Date | string | null;
}

export interface NavigationPointPayload {
  sessionId: string;
  orderId: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
}

export class SupabaseGpsService {
  /**
   * Upsert the latest live GPS coordinate for a delivery partner into Supabase delivery_locations.
   * This immediately triggers Supabase Realtime for the Owner Live Map and Customer Tracking.
   */
  public static async upsertLatestLocation(payload: GpsLocationPayload): Promise<{ success: boolean; error?: string }> {
    if (!supabaseNav) {
      return { success: false, error: 'Supabase GPS client not initialized' };
    }

    try {
      const { error } = await supabaseNav
        .from('delivery_locations')
        .upsert({
          delivery_partner_id: payload.deliveryPartnerId,
          active_order_id: payload.activeOrderId || null,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          accuracy: payload.accuracy != null ? Number(payload.accuracy) : null,
          speed: payload.speed != null ? Number(payload.speed) : null,
          heading: payload.heading != null ? Number(payload.heading) : null,
          online_status: payload.onlineStatus ?? true,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'delivery_partner_id'
        });

      if (error) {
        console.error('[SupabaseGpsService] Error upserting delivery location:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[SupabaseGpsService] Exception upserting delivery location:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Retrieve the latest GPS location for a specific delivery partner.
   */
  public static async getLatestLocation(deliveryPartnerId: string): Promise<any | null> {
    if (!supabaseNav) return null;
    try {
      const { data, error } = await supabaseNav
        .from('delivery_locations')
        .select('*')
        .eq('delivery_partner_id', deliveryPartnerId)
        .maybeSingle();

      if (error) {
        console.warn('[SupabaseGpsService] Error fetching location:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Retrieve all currently online rider locations.
   */
  public static async getActiveLocations(): Promise<any[]> {
    if (!supabaseNav) return [];
    try {
      const { data, error } = await supabaseNav
        .from('delivery_locations')
        .select('*')
        .eq('online_status', true);

      if (error) {
        console.warn('[SupabaseGpsService] Error fetching active locations:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Start a new navigation session in Supabase when a rider picks up an order.
   */
  public static async startNavigationSession(payload: NavigationSessionPayload): Promise<{ success: boolean; error?: string }> {
    if (!supabaseNav) return { success: false, error: 'Supabase GPS client not initialized' };

    try {
      const { error } = await supabaseNav
        .from('navigation_sessions')
        .upsert({
          id: payload.sessionId,
          order_id: payload.orderId,
          delivery_partner_id: payload.deliveryPartnerId,
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          expires_at: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Append a high-frequency breadcrumb navigation point into Supabase navigation_points.
   */
  public static async appendNavigationPoint(payload: NavigationPointPayload): Promise<{ success: boolean; error?: string }> {
    if (!supabaseNav) return { success: false, error: 'Supabase GPS client not initialized' };

    try {
      const { error } = await supabaseNav
        .from('navigation_points')
        .insert([{
          session_id: payload.sessionId,
          order_id: payload.orderId,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          speed: payload.speed != null ? Number(payload.speed) : null,
          heading: payload.heading != null ? Number(payload.heading) : null,
          accuracy: payload.accuracy != null ? Number(payload.accuracy) : null,
          created_at: new Date().toISOString()
        }]);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Mark a navigation session as COMPLETED in Supabase.
   */
  public static async endNavigationSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabaseNav) return { success: false, error: 'Supabase GPS client not initialized' };

    try {
      const { error } = await supabaseNav
        .from('navigation_sessions')
        .update({
          status: 'COMPLETED',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Clear active order on rider location upon order delivery or cancellation.
   */
  public static async clearActiveOrder(deliveryPartnerId: string, orderId?: string): Promise<void> {
    if (!supabaseNav) return;
    try {
      let q = supabaseNav
        .from('delivery_locations')
        .update({
          active_order_id: null,
          last_updated: new Date().toISOString()
        })
        .eq('delivery_partner_id', deliveryPartnerId);

      if (orderId) {
        q = q.eq('active_order_id', orderId);
      }
      await q;
    } catch (err: any) {
      console.warn('[SupabaseGpsService] Notice clearing active order:', err?.message);
    }
  }

  /**
   * Set online status for rider in Supabase delivery_locations.
   */
  public static async setOnlineStatus(deliveryPartnerId: string, onlineStatus: boolean): Promise<void> {
    if (!supabaseNav) return;
    try {
      await supabaseNav
        .from('delivery_locations')
        .update({
          online_status: onlineStatus,
          last_updated: new Date().toISOString()
        })
        .eq('delivery_partner_id', deliveryPartnerId);
    } catch (err: any) {
      console.warn('[SupabaseGpsService] Notice setting online status:', err?.message);
    }
  }

  /**
   * Prune high-frequency GPS breadcrumbs older than retention window (default 5 minutes).
   */
  public static async pruneStaleNavigationPoints(retentionMinutes = 5): Promise<number> {
    if (!supabaseNav) return 0;
    try {
      const cutoff = new Date(Date.now() - retentionMinutes * 60 * 1000).toISOString();
      const { data, error } = await supabaseNav
        .from('navigation_points')
        .delete()
        .lt('created_at', cutoff)
        .select('id');

      if (error) {
        console.warn('[SupabaseGpsService] Notice pruning navigation points:', error.message);
        return 0;
      }
      return data?.length || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Remove GPS entries for orders that ended more than 5 minutes ago.
   */
  public static async cleanupDeliveredGps(orderId: string): Promise<void> {
    if (!supabaseNav) return;
    try {
      await supabaseNav
        .from('delivery_locations')
        .update({ active_order_id: null, last_updated: new Date().toISOString() })
        .eq('active_order_id', orderId);

      await supabaseNav
        .from('navigation_points')
        .delete()
        .eq('order_id', orderId);

      await supabaseNav
        .from('navigation_sessions')
        .update({ status: 'COMPLETED', ended_at: new Date().toISOString() })
        .eq('order_id', orderId);
    } catch (err: any) {
      console.warn('[SupabaseGpsService] Notice cleaning delivered GPS:', err?.message);
    }
  }
}
