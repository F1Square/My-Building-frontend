import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { registerAuthFailureHandler, setAuthToken } from '../utils/api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { InteractionManager, Platform } from 'react-native';
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
};

type Subscription = {
  plan: string;
  status: 'active' | 'expired' | 'cancelled';
  expires_at: string | null;
  newspaper_addon?: boolean;
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
    AsyncStorage.multiGet(['token', 'user', 'subscription'])
      .then(([t, u, s]) => {
        const restoredToken = t[1];
        const restoredUser = safeParse<User | null>(u[1], null);
        const restoredSubscription = safeParse<Subscription>(s[1], null);

        if (restoredToken && restoredUser) {
          setAuthToken(restoredToken);
          setToken(restoredToken);
          setUser(restoredUser);
          // Load cached subscription instantly — no flicker
          setSubscription(restoredSubscription);
          // Then refresh in background
          fetchSubscription();
        } else if (restoredToken || u[1] || s[1]) {
          // Partial/corrupt auth state can create boot loops after upgrades.
          AsyncStorage.multiRemove(['token', 'user', 'subscription']);
          setAuthToken(null);
          setToken(null);
          setUser(null);
          setSubscription(null);
        }
      })
      .catch((error) => {
        console.error('[AuthContext] Failed to restore session:', error);
      })
      .finally(() => {
        setLoading(false);
      });
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
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
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
    // If subscription came with the login response, cache it immediately — no extra round trip
    const resolvedSub = sub !== undefined ? sub : null;
    let userJson: string;
    let subJson: string;
    try {
      userJson = JSON.stringify(u);
      subJson = JSON.stringify(resolvedSub);
    } catch (e) {
      console.error('[AuthContext] Cannot serialize user/subscription for storage:', e);
      return;
    }

    try {
      await AsyncStorage.multiSet([
        ['token', t],
        ['user', userJson],
        ['subscription', subJson],
      ]);
    } catch (e) {
      console.error('[AuthContext] Failed to persist session:', e);
      return;
    }

    setAuthToken(t);
    setToken(t);
    setUser(u);
    setSubscription(resolvedSub);

    // Refresh subscription in background only if it wasn't provided
    if (sub === undefined) fetchSubscription();

    // Defer push: after interactions + delay so native stack and router finish mounting.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => { registerPushToken(); }, 2000);
    });

    // Warm cache with critical data in background (non-blocking)
    const userKey = cacheManager.generateKey('auth', '/auth/me', {}, u.role, u.building_id);
    cacheManager.warmCache([
      { key: userKey, fetcher: async () => u },
    ]);
  }, [fetchSubscription, registerPushToken]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
    // Clear all cached data on logout for security
    await cacheManager.clear();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setSubscription(null);
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
