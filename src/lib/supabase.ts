import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://tdjrkqmhdynbaciguyvr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkanJrcW1oZHluYmFjaWd1eXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDE4MzUsImV4cCI6MjA5Nzg3NzgzNX0.03rt77yV0zfnxbLNqbEOWijqpT0iAuEgYqSTGN0HPtI';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL) as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY) as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ─── Database Types ───────────────────────────────────────────────────
export interface DeliveryLocation {
  delivery_partner_id: string;
  active_order_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  online_status: boolean;
  last_updated: string;
}
