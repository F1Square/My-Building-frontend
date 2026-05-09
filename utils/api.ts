import axios, { InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/api';
import { cacheManager, CACHE_PRESETS, CacheConfig } from './CacheManager';

// Extend Axios config to carry cache metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _cacheKey?: string;
    _cacheConfig?: Partial<CacheConfig>;
    _skipCache?: boolean;
    _module?: string;
  }
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Registered by AuthContext so the interceptor can trigger logout
let _onAuthFailure: (() => void) | null = null;
let _authToken: string | null = null;
let _tokenLoaded = false;
let _tokenLoadPromise: Promise<void> | null = null;

async function ensureTokenLoaded(): Promise<void> {
  if (_tokenLoaded) return;
  if (!_tokenLoadPromise) {
    _tokenLoadPromise = AsyncStorage.getItem('token')
      .then((token) => {
        _authToken = token;
        _tokenLoaded = true;
      })
      .catch(() => {
        _authToken = null;
        _tokenLoaded = true;
      })
      .finally(() => {
        _tokenLoadPromise = null;
      });
  }
  await _tokenLoadPromise;
}

export function setAuthToken(token: string | null) {
  _authToken = token;
  _tokenLoaded = true;
}

export function registerAuthFailureHandler(fn: () => void) {
  _onAuthFailure = fn;
}

// ── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  await ensureTokenLoaded();
  if (_authToken) config.headers.Authorization = `Bearer ${_authToken}`;
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  async (response) => {
    const config = response.config;
    const method = config.method?.toLowerCase();

    // Cache successful GET responses
    if (method === 'get' && !config._skipCache) {
      const module = config._module ?? deriveModule(config.url ?? '');
      const cacheKey = config._cacheKey ?? cacheManager.generateKey(module, config.url ?? '', config.params);
      const cacheConfig = config._cacheConfig ?? guessCacheConfig(config.url ?? '');
      await cacheManager.set(cacheKey, response.data, cacheConfig);
    }

    // Invalidate cache on mutations
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      const module = config._module ?? deriveModule(config.url ?? '');
      await cacheManager.invalidate(`${module}:*`);
    }

    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';

    // Don't auto-logout on login/signup endpoints — let the component handle it
    const isAuthEndpoint = /\/(login|signup|register|forgot-password|verify-otp|reset-password)/.test(url);

    // Token missing, invalid or expired — force logout (but not on auth endpoints)
    if (!isAuthEndpoint && (status === 401 || (status === 403 && !error.response?.data?.error))) {
      // Let AuthContext's registered handler do all cleanup — it awaits storage
      // operations in the correct order. Doing cleanup here too causes a
      // double-clear race that can corrupt the auth state.
      _onAuthFailure?.();
      return Promise.reject({ _authError: true });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('[API] Network error — is the backend running at', API_BASE, '?');
    } else if (status === 404 && error.response?.data?.error === 'not_available') {
      // Expected — no newspaper uploaded for this date
    } else {
      console.error('[API] Error:', status, error.response?.data);
    }

    // Forward technical errors (5xx + network failures) into the activity log
    // so admin can spot them. Validation errors (4xx) are intentionally NOT
    // reported — they're expected user-input issues, not bugs.
    reportTechnicalError(error, status, url);

    return Promise.reject(error);
  },
);

// ── Client-side error reporter ───────────────────────────────────────────────
// Lightweight rate limit so a flapping endpoint can't flood activity_logs.
let _errReports: number[] = [];
const ERR_WINDOW_MS = 60_000;
const ERR_MAX_PER_WINDOW = 8;

function reportTechnicalError(err: any, status: number | undefined, url: string) {
  // Never report errors triggered by the activity-log endpoints themselves —
  // would cause infinite loops if logging is the thing that's broken.
  if (url.includes('/activity-logs')) return;
  // Don't trigger logging on auth-related responses; those are handled above.
  if (/\/(login|signup|register|forgot-password|verify-otp|reset-password)/.test(url)) return;

  const isNetwork = !err.response && (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.message === 'Network Error' ||
    err.message?.includes('timeout')
  );
  const isServer = typeof status === 'number' && status >= 500;
  if (!isNetwork && !isServer) return;

  // Rate limit
  const now = Date.now();
  _errReports = _errReports.filter(t => now - t < ERR_WINDOW_MS);
  if (_errReports.length >= ERR_MAX_PER_WINDOW) return;
  _errReports.push(now);

  const method = err.config?.method?.toUpperCase() || 'GET';
  const moduleGuess = deriveModule(url);
  const detail: Record<string, any> = {
    method,
    path: url,
    kind: isNetwork ? 'network' : 'server',
    status_code: status ?? null,
    error_code: err.code || null,
    error_message:
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Unknown error',
  };

  // Fire and forget. Ignore failures here — if /activity-logs/error is itself
  // down, we don't want to recurse.
  api.post('/activity-logs/error', {
    action: isNetwork ? 'client_network_error' : 'client_server_error',
    module: moduleGuess,
    detail,
  }, { _skipCache: true } as any).catch(() => {});
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive module name from URL path (e.g. /api/maintenance/bills → maintenance) */
function deriveModule(url: string): string {
  const parts = url.replace(/^\/+/, '').split('/');
  // Skip 'api' prefix if present
  const start = parts[0] === 'api' ? 1 : 0;
  return parts[start] ?? 'default';
}

/** Pick a cache preset based on URL patterns */
function guessCacheConfig(url: string): Partial<CacheConfig> {
  if (/\/(bills|payments|transactions)/.test(url)) return CACHE_PRESETS.userSpecific;
  if (/\/(building|society|rules|settings)/.test(url)) return CACHE_PRESETS.static;
  return CACHE_PRESETS.buildingWide;
}

export default api;
