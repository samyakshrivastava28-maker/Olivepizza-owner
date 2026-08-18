import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Configure dotenv to ensure environment variables are loaded
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Missing Supabase environment variables in backend. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
