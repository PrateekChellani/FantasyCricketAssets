'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// IMPORTANT: keep this in sync with DailyLoginButton.tsx STORAGE_KEY
export const SUPABASE_STORAGE_KEY = 'sb-fantasy-cricket-auth';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: SUPABASE_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
