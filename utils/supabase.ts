import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (__DEV__) {
    console.warn('[supabase] Missing env vars — check your .env file');
  } else {
    console.warn(
      '[supabase] Missing EXPO_PUBLIC_SUPABASE_* in release bundle. Copy .env.production.example to .env.production before npm run android:bundle:release.'
    );
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});
