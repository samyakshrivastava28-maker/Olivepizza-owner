import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🛰️ Dedicated Supabase Navigation Client
 * 
 * STRICT ARCHITECTURAL CONSTRAINT:
 * This client must be used ONLY for high-frequency live GPS rider telemetry and Realtime channels.
 * It must NEVER be used for Payments, POS shifts, Invoices, or Business data.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://tdjrkqmhdynbaciguyvr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkanJrcW1oZHluYmFjaWd1eXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDE4MzUsImV4cCI6MjA5Nzg3NzgzNX0.03rt77yV0zfnxbLNqbEOWijqpT0iAuEgYqSTGN0HPtI';

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    console.log('[Supabase Navigation] Dedicated live GPS telemetry client initialized.');
  } catch (err: any) {
    console.warn('[Supabase Navigation] Initialization warning:', err.message);
  }
}

export const supabaseNav = supabaseClient!;

/**
 * Navigation Subsystem Health Probe
 */
export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  table: string;
  error?: string;
}> {
  const start = Date.now();
  if (!supabaseClient) {
    return { connected: false, latencyMs: 0, table: 'delivery_locations', error: 'Supabase client not initialized' };
  }
  try {
    const { error } = await supabaseClient
      .from('delivery_locations')
      .select('delivery_partner_id')
      .limit(1);

    const latencyMs = Date.now() - start;
    if (error) {
      return { connected: false, latencyMs, table: 'delivery_locations', error: error.message };
    }
    return { connected: true, latencyMs, table: 'delivery_locations' };
  } catch (err: any) {
    return { connected: false, latencyMs: Date.now() - start, table: 'delivery_locations', error: err.message };
  }
}