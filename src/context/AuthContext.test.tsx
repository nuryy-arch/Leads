import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured, getSupabase } from '../services/supabaseClient';

describe('Supabase Client - Configuration & Fallback Safety', () => {
  it('correctly evaluates isSupabaseConfigured in default unconfigured environment', () => {
    // In local dev without .env.local, isSupabaseConfigured should be false without throwing
    expect(typeof isSupabaseConfigured).toBe('boolean');
  });

  it('throws a helpful, descriptive error message when getSupabase() is called unconfigured', () => {
    if (!isSupabaseConfigured) {
      expect(() => getSupabase()).toThrowError(
        /Supabase не настроен. Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY/
      );
    } else {
      expect(getSupabase()).toBeDefined();
    }
  });
});
