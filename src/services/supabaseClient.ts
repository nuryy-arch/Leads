import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim() ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20
);

let clientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    clientInstance = null;
  }
}

export const supabase = clientInstance;

/**
 * Returns active Supabase client or throws a descriptive error
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase не настроен. Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.local.'
    );
  }
  return supabase;
}
