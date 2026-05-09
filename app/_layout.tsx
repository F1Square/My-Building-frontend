import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { CacheProvider } from '../context/CacheContext';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import NoInternetOverlay from '../components/NoInternetOverlay';
import { OfflineIndicator } from '../components/OfflineIndicator';
import UpdateModal from '../components/UpdateModal';
import api from '../utils/api';
import appJson from '../app.json';
import { addBreadcrumb, getBreadcrumbs } from '../utils/crashBreadcrumbs';

import Constants from 'expo-constants';

const CURRENT_VERSION = Constants.expoConfig?.version || appJson.expo.version;

function isNewerVersion(remote: unknown, local: unknown) {
  const clean = (v: unknown) => String(v ?? '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);

  const remoteStr = String(remote ?? '').trim();
  const localStr = String(local ?? '').trim();
  if (!remoteStr || !localStr) return false;

  const remoteParts = clean(remote);
  const localParts = clean(local);

  for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
    const r = remoteParts[i] || 0;
    const l = localParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { hasChosen, loading: langLoading, initForUser } = useLanguage();
  const segments = useSegments();
  const router = useRouter();
  const initializedRef = useRef<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const inAuth = (segments[0] as string) === '(auth)';
  const inLangPicker = (segments[0] as string) === 'choose-language';
  const inMaintenance = (segments[0] as string) === 'maintenance-mode';

  useEffect(() => {
    // Log persisted breadcrumbs on startup so the last pre-crash steps are visible in JS logs.
    getBreadcrumbs().then((items) => {
      if (!items.length) return;
      const recent = items.slice(-12);
      console.log('[CrashBreadcrumbs] Recent:', recent);
    });
  }, []);

  // When auth resolves, init language for the current user (or unblock if no user)
  useEffect(() => {
    if (authLoading) return;

    if (user?.id) {
      // Only call initForUser once per user session to avoid re-triggering
      if (initializedRef.current !== user.id) {
        initializedRef.current = user.id;
        initForUser(user.id);
      }
    } else {
      // No user logged in — unblock language loading immediately
      if (initializedRef.current !== 'no-user') {
        initializedRef.current = 'no-user';
        // Access the internal markNoUser via a workaround — just set loading done
        // by calling initForUser with a dummy that won't find a key
        initForUser('__no_user__');
      }
    }
  }, [authLoading, user?.id, initForUser]);

  // Check App Config (Maintenance & Update)
  useEffect(() => {
    let cancelled = false;

    const checkConfig = async () => {
      try {
        const res = await api.get('/app-config');
        const { maintenance_mode, maintenance_message, version: remoteVersion } = res.data || {};
        if (cancelled) return;

        setIsMaintenance(!!maintenance_mode);
        if (maintenance_message) setMaintenanceMessage(maintenance_message);

        if (isNewerVersion(remoteVersion, CURRENT_VERSION)) {
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.error('App config check failed:', err);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    };

    checkConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Routing logic — only runs once both auth and language are resolved
  useEffect(() => {
    if (authLoading || langLoading || configLoading) return;

    // Defer all navigation by one tick so the Stack navigator and its (tabs)
    // child are fully mounted before any REPLACE action is dispatched.
    const timer = setTimeout(() => {
      // 1. Maintenance Check (Priority)
      // Only redirect if NOT an admin (admins need to be able to turn it off!)
      if (isMaintenance && user?.role !== 'admin') {
        if (!inMaintenance) {
          router.replace({
            pathname: '/maintenance-mode',
            params: { message: maintenanceMessage }
          } as any);
        }
        return;
      }

      if (!user) {
        if (!inAuth) router.replace('/login' as any);
        return;
      }

      // Logged in but hasn't chosen language yet → show picker
      if (!hasChosen) {
        if (!inLangPicker) router.replace('/choose-language' as any);
        return;
      }

      // Logged in + language chosen → only redirect if currently in auth or language picker
      // Don't redirect on 404 or other valid routes
      if (inAuth || inLangPicker || inMaintenance) {
        router.replace('/' as any);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [user, authLoading, hasChosen, langLoading, isMaintenance, segments, maintenanceMessage, configLoading, router]);

  const waitingForRedirect =
    !authLoading &&
    !langLoading &&
    !configLoading &&
    (
      (!user && !inAuth) ||
      (isMaintenance && user?.role !== 'admin' && !inMaintenance) ||
      (!!user && !hasChosen && !inLangPicker) ||
      (!!user && hasChosen && (inAuth || inLangPicker || inMaintenance))
    );

  if (authLoading || langLoading || configLoading || waitingForRedirect) {
    return (
      <View style={loadingStyles.container}>
        <Image
          source={require('../assets/images/icon.png')}
          style={loadingStyles.logo}
          resizeMode="contain"
        />
        <Text style={loadingStyles.title}>My Building</Text>
        <Text style={loadingStyles.subtitle}>Building Management</Text>
        <ActivityIndicator size="large" color={Colors.white} style={loadingStyles.spinner} />
      </View>
    );
  }

  return (
    <>
      <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }}>
        <Stack.Screen name="choose-language" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="maintenance" />
        <Stack.Screen name="announcements" />
        <Stack.Screen name="visitors" />
        <Stack.Screen name="parking" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="members" />
        <Stack.Screen name="expenses" />
        <Stack.Screen name="join-requests" />
        <Stack.Screen name="subscribe" />
        <Stack.Screen name="subscriptions-admin" />
        <Stack.Screen name="helpline" />
        <Stack.Screen name="complaints" />
        <Stack.Screen name="complaints-admin" />
        <Stack.Screen name="activity-logs" />
        <Stack.Screen name="website-contacts" />
        <Stack.Screen name="cache-debug" />
        <Stack.Screen name="bank-details" options={{ gestureEnabled: true }} />
        <Stack.Screen name="users" options={{ gestureEnabled: true }} />
        <Stack.Screen name="entry/[building_id]" options={{ headerShown: false }} />
        <Stack.Screen name="maintenance-mode" options={{ gestureEnabled: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
      </Stack>
      <UpdateModal
        visible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />
    </>
  );
}

// Styles for the brand-aware loading screen shown while auth / language /
// app-config are still resolving. Replaces the previous bare spinner.
const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  spinner: {
    marginTop: 28,
  },
});

export default function RootLayout() {
  useEffect(() => {
    const g = global as any;
    const errorUtils = g?.ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;

    const originalHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      void addBreadcrumb('global', 'js_fatal', {
        isFatal: !!isFatal,
        message: error?.message,
        stack: error?.stack,
      });
      if (typeof originalHandler === 'function') {
        originalHandler(error, isFatal);
      }
    });
  }, []);

  return (
    <CacheProvider>
      <LanguageProvider>
        <AuthProvider>
          <OfflineIndicator />
          <RootNavigator />
          <NoInternetOverlay />
          {/* We'll handle the modal inside RootNavigator or here */}
        </AuthProvider>
      </LanguageProvider>
    </CacheProvider>
  );
}
