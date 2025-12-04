import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Create a dummy client if not configured to prevent crashes
let supabase: SupabaseClient<Database>;

if (isSupabaseConfigured) {
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  console.warn('Create a free project at https://supabase.com');
  // Create a placeholder client that will fail gracefully
  supabase = createClient<Database>('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };
