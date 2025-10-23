import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://inhhrzqlezkenjumpvxa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluaGhyenFsZXprZW5qdW1wdnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzAxMDIsImV4cCI6MjA3NjgwNjEwMn0.mwmFccKBMFaiV7rGovcxbyOLn3xAzfjZKh9ldJDV5n8';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
