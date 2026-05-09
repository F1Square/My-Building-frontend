// Values come from .env / .env.production (see metro.config.js + npm run android:bundle:release).
// EXPO_PUBLIC_ prefix is inlined at bundle time (Expo SDK 49+).
/** Production API origin (no /api suffix) — must be HTTPS for Play Store builds. */
const PRODUCTION_ORIGIN = 'https://my-building-backend.vercel.app';

const FALLBACK_ORIGIN = __DEV__ ? 'http://localhost:5000' : PRODUCTION_ORIGIN;

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE || `${FALLBACK_ORIGIN}/api`
).trim();
export const ENTRY_BASE = (
  process.env.EXPO_PUBLIC_ENTRY_BASE || `${FALLBACK_ORIGIN}/entry`
).trim();
