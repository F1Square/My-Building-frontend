// Values come from .env — copy .env.example to .env and fill in your values
// EXPO_PUBLIC_ prefix makes them available in the app bundle (Expo SDK 49+)
const FALLBACK_URL = __DEV__ ? 'http://localhost:5000' : 'https://my-building-backend.vercel.app';

export const API_BASE   = (process.env.EXPO_PUBLIC_API_BASE   || `${FALLBACK_URL}/api`).trim();
export const ENTRY_BASE = (process.env.EXPO_PUBLIC_ENTRY_BASE || `${FALLBACK_URL}/entry`).trim();

if (!process.env.EXPO_PUBLIC_API_BASE && !__DEV__) {
  console.warn('[API] EXPO_PUBLIC_API_BASE is not defined in production! Falling back to Vercel.');
}
