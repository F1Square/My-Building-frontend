import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { registerAuthFailureHandler, setAuthToken } from '../utils/api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { cacheManager } from '../utils/CacheManager';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'pramukh' | 'admin' | 'watchman';
  building_id?: string;
  flat_no?: string;
  phone?: string;
  wing?: string;
  total_members?: number;
  app_language?: string | null;
};

type Subscription = {
  plan: string;
  status: 'active' | 'expired' | 'cancelled';
  expires_at: string | null;
  newspaper_addon?: boolean;
  newspaper_expires_at?: string | null;
} | null;

type AuthContextType = {
  user: User | null;
  token: string | null;
  subscription: Subscription;
  hasActiveSubscription: boolean;
  login: (token: string, user: User, subscription?: Subscription) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription>(null);

  const safeParse = <T,>(value: string | null, fallback: T): T => {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn('[AuthContext] Invalid cached JSON ignored:', error);
      return fallback;
    }
  };

  const isSubActive = (sub: Subscription) => {
    if (!sub || sub.status !== 'active') return false;
    if (sub.plan === 'lifetime') return true;
    return !sub.expires_at || new Date(sub.expires_at) > new Date();
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/subscriptions/me');
      const sub = res.data as Subscription;
      setSubscription(sub);
      await AsyncStorage.setItem('subscription', JSON.stringify(sub));
    } catch (err) {
      console.error('[AuthContext] Fetch subscription failed:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const restoreSession = async () => {
      try {
        const values = await AsyncStorage.multiGet(['token', 'user', 'subscription']);
        
        if (!mounted) return;
        
        const [t, u, s] = values;
        const restoredToken = t[1];
        const restoredUser = safeParse<User | null>(u[1], null);
        const restoredSubscription = safeParse<Subscription>(s[1], null);

        // Validate restored data integrity
        if (restoredToken && restoredUser && restoredUser.id) {
          console.log('[AuthContext] Restoring session for user:', restoredUser.email);
          setAuthToken(restoredToken);
          setToken(restoredToken);
          setUser(restoredUser);
          // Load cached subscription instantly — no flicker
          setSubscription(restoredSubscription);
          // Then refresh in background
          fetchSubscription().catch(err => {
            console.warn('[AuthContext] Background subscription refresh failed:', err);
          });
        } else if (restoredToken || u[1] || s[1]) {
          // Partial/corrupt auth state can create boot loops after upgrades.
          console.warn('[AuthContext] Detected partial/corrupt auth state - clearing');
          await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
          setAuthToken(null);
          setToken(null);
          setUser(null);
          setSubscription(null);
        } else {
          console.log('[AuthContext] No session to restore');
        }
      } catch (error) {
        console.error('[AuthContext] Failed to restore session:', error);
        // On error, clear potentially corrupt state
        try {
          await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
        } catch (clearError) {
          console.error('[AuthContext] Failed to clear corrupt state:', clearError);
        }
        if (mounted) {
          setAuthToken(null);
          setToken(null);
          setUser(null);
          setSubscription(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();
    
    return () => {
      mounted = false;
    };
  }, [fetchSubscription]);

  const registerPushToken = useCallback(async () => {
    try {
      if (!Device.isDevice) return;
      if (Platform.OS === 'web') return;
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default', importance: Notifications.AndroidImportance.MAX,
        });
      }
      // Explicit projectId prevents native crash when EAS config is missing
      const projectId = Constants.expoConfig?.extra?.eas?.projectId  ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn('[AuthContext] No EAS projectId — skipping push token');
        return;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      await api.post('/auth/push-token', { expo_push_token: tokenData.data });
    } catch (err) {
      // Swallow — push registration must never crash the app
      console.log('[AuthContext] Push token registration failed:', err);
    }
  }, []);

  const login = useCallback(async (t: string, u: User, sub?: Subscription) => {
    if (!t || !u?.id) {
      console.warn('[AuthContext] login ignored — missing token or user id');
      return;
    }
    
    const resolvedSub = sub !== undefined ? sub : null;
    
    try {
      const userJson = JSON.stringify(u);
      const subJson = JSON.stringify(resolvedSub);
      
      // Use multiSet for atomic operation
      await AsyncStorage.multiSet([
        ['token', t],
        ['user', userJson],
        ['subscription', subJson],
      ]);
      
      console.log('[AuthContext] Session persisted successfully');
    } catch (e) {
      console.error('[AuthContext] Failed to persist session:', e);
      console.warn('[AuthContext] Continuing with in-memory session only');
    }

    // Update in-memory state
    setAuthToken(t);
    setToken(t);
    setUser(u);
    setSubscription(resolvedSub);

    // Background operations - fire and forget
    if (sub === undefined) {
      fetchSubscription().catch(err => 
        console.warn('[AuthContext] Background subscription fetch failed:', err)
      );
    }

    try {
      const userKey = cacheManager.generateKey('auth', '/auth/me', {}, u.role, u.building_id);
      cacheManager.warmCache([
        { key: userKey, fetcher: async () => u },
      ]).catch(err => 
        console.warn('[AuthContext] Cache warming failed (non-critical):', err)
      );
    } catch (err) {
      console.warn('[AuthContext] Cache warming setup failed:', err);
    }
  }, [fetchSubscription]);

  useEffect(() => {
    if (loading || !user?.id || !token) return;
    
    let cancelled = false;
    
    // Register push token immediately in background
    registerPushToken().catch((err) => {
      if (!cancelled) {
        console.log('[AuthContext] Push token registration failed (non-critical):', err);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, token, registerPushToken]);

  const logout = useCallback(async () => {
    // Clear in-memory state first for immediate UI response
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setSubscription(null);
    
    // Clear storage and cache in background (non-blocking)
    AsyncStorage.multiRemove(['token', 'user', 'subscription'])
      .catch((err) => console.error('[AuthContext] Storage cleanup failed:', err));
    
    cacheManager.clear()
      .catch((err) => console.error('[AuthContext] Cache cleanup failed:', err));
  }, []);

  // Wire up the API interceptor so 401/403 auto-triggers logout
  useEffect(() => {
    registerAuthFailureHandler(async () => {
      try {
        // Clear storage first, then update React state.
        // Awaiting prevents race conditions where the app might still
        // see a valid token during the transition.
        const currentToken = await AsyncStorage.getItem('token');
        if (!currentToken) return; // already logged out
        await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
        await cacheManager.clear().catch(() => null);
      } catch {
        // Must never throw — we're inside an axios interceptor.
      }
      setAuthToken(null);
      setToken(null);
      setUser(null);
      setSubscription(null);
    });
  }, []);

  // Clear cache when user role changes (role-based cache isolation)
  const prevRoleRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    if (user?.role && prevRoleRef.current && prevRoleRef.current !== user.role) {
      cacheManager.clear();
    }
    prevRoleRef.current = user?.role;
  }, [user?.role]);

  const refreshSubscription = useCallback(async () => {
    const t = token || (await AsyncStorage.getItem('token'));
    if (t) await fetchSubscription();
  }, [fetchSubscription, token]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const updated = res.data.user as User;
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (err) {
      console.error('[AuthContext] Refresh user failed:', err);
    }
  }, []);

  const contextValue = useMemo(() => ({
    user, token, subscription,
    hasActiveSubscription: user?.role === 'admin' || isSubActive(subscription),
    login, logout, refreshUser, refreshSubscription, loading,
  }), [user, token, subscription, login, logout, refreshUser, refreshSubscription, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
