import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { CacheProvider } from '../context/CacheContext';
import { ActivityIndicator, Image, InteractionManager, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const rootNav = useRootNavigationState();
  const router = useRouter();
  const initializedRef = useRef<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const seg0 = segments.length > 0 ? (segments[0] as string) : '';
  const inAuth = seg0 === '(auth)';
  const inLangPicker = seg0 === 'choose-language';
  const inMaintenance = seg0 === 'maintenance-mode';

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

  // Routing logic — only runs once both auth and language are resolved.
  // IMPORTANT (New Architecture / production): Do not list `segments` in the
  // dependency array — every segment change was clearing this timer and
  // scheduling another REPLACE, which races the navigator. Read segments from
  // a ref instead.
  useEffect(() => {
    if (authLoading || langLoading || configLoading) return;
    // Avoid REPLACE until Expo Router's root container has a key (docs pattern).
    if (!rootNav?.key) return;

    // Defer navigation until after interactions AND one tick so the Stack
    // navigator and its (tabs) child are fully mounted before any REPLACE
    // action is dispatched. This prevents the native crash ("UI not supported")
    // on New Architecture where two concurrent REPLACE actions race the
    // navigator mount.
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        try {
          const seg = segmentsRef.current;
          const seg0 = seg.length > 0 ? (seg[0] as string) : '';
          const inAuthNow = seg0 === '(auth)';
          const inLangPickerNow = seg0 === 'choose-language';
          const inMaintenanceNow = seg0 === 'maintenance-mode';

          // 1. Maintenance Check (Priority)
          // Only redirect if NOT an admin (admins need to be able to turn it off!)
          if (isMaintenance && user?.role !== 'admin') {
            if (!inMaintenanceNow) {
              void addBreadcrumb('routing', 'replace_maintenance');
              router.replace({
                pathname: '/maintenance-mode',
                params: { message: maintenanceMessage }
              } as any);
            }
            return;
          }

          if (!user) {
            if (!inAuthNow) {
              void addBreadcrumb('routing', 'replace_login');
              router.replace('/login' as any);
            }
            return;
          }

          // Logged in but hasn't chosen language yet → show picker
          if (!hasChosen) {
            if (!inLangPickerNow) {
              void addBreadcrumb('routing', 'replace_lang_picker');
              router.replace('/choose-language' as any);
            }
            return;
          }

          // Logged in + language chosen → only redirect if currently in auth or language picker
          // Don't redirect on 404 or other valid routes
          if (inAuthNow || inLangPickerNow || inMaintenanceNow) {
            void addBreadcrumb('routing', 'replace_home');
            router.replace('/' as any);
          }
        } catch (err) {
          // Swallow navigation errors during transitions — the error boundary
          // will catch any render-level issues. This prevents native process
          // kills on New Architecture.
          console.warn('[RootNavigator] Navigation error swallowed:', err);
          void addBreadcrumb('routing', 'navigation_error', { message: (err as Error)?.message });
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [user, authLoading, hasChosen, langLoading, isMaintenance, maintenanceMessage, configLoading, router, rootNav?.key, user?.role]);

  // After login, LanguageContext sets langLoading=true while it reads per-user prefs.
  // Showing the full-screen splash during that phase unmounts the root Stack and
  // remounts it — on New Architecture release builds that races router.replace
  // and crashes the app ("My Building keeps stopping"). Only block the UI on
  // language bootstrap when there is no logged-in user yet (cold start / logout).
  const showInitialSplash = authLoading || configLoading || (!user && langLoading);

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

  if (showInitialSplash || waitingForRedirect) {
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

// ── Error Boundary for production crash resilience ─────────────────────────
// In dev mode, React's own error overlay handles exceptions. In production,
// an unhandled render error kills the process instantly. This boundary catches
// those and shows a friendly recovery screen instead.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void addBreadcrumb('error_boundary', 'caught', {
      message: error?.message,
      stack: error?.stack?.slice(0, 500),
      componentStack: info?.componentStack?.slice(0, 500),
    });
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.emoji}>😔</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.subtitle}>
            The app ran into an unexpected error. Please restart to continue.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={errorStyles.devError}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity
            style={errorStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  devError: { fontSize: 12, color: '#FCA5A5', textAlign: 'center', marginBottom: 20, fontFamily: 'monospace' },
  btn: { backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
