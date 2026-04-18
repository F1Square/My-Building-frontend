import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Registered by AuthContext so the interceptor can trigger logout
let _onAuthFailure: (() => void) | null = null;
export function registerAuthFailureHandler(fn: () => void) {
  _onAuthFailure = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // Token missing, invalid or expired — force logout
    // Don't treat feature-gated 403s (e.g. newspaper_addon_required) as auth failures
    if (status === 401 || (status === 403 && !error.response?.data?.error)) {
      await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
      _onAuthFailure?.();
      return Promise.reject({ _authError: true });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('[API] Network error — is the backend running at', API_BASE, '?');
    } else if (status === 404 && error.response?.data?.error === 'not_available') {
      // Expected — no newspaper uploaded for this date, no need to log
    } else {
      console.error('[API] Error:', status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;
