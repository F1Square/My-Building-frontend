import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { CacheProvider } from '../context/CacheContext';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/colors';
import NoInternetOverlay from '../components/NoInternetOverlay';
import { OfflineIndicator } from '../components/OfflineIndicator';
import UpdateModal from '../components/UpdateModal';
import api from '../utils/api';
import appJson from '../app.json';

import Constants from 'expo-constants';

const CURRENT_VERSION = Constants.expoConfig?.version || appJson.expo.version;

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
  }, [authLoading, user?.id]);

  // Check App Config (Maintenance & Update)
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await api.get('/app-config');
        const { maintenance_mode, maintenance_message, version: remoteVersion } = res.data;
        
        setIsMaintenance(!!maintenance_mode);
        if (maintenance_message) setMaintenanceMessage(maintenance_message);
        
        if (remoteVersion && isNewerVersion(remoteVersion, CURRENT_VERSION)) {
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.error('App config check failed:', err);
      } finally {
        setConfigLoading(false);
      }
    };
    
    checkConfig();
  }, []);

  // Helper to compare version strings (e.g., "1.14.1" > "1.14.0")
  const isNewerVersion = (remote: string, local: string) => {
    const clean = (v: string) => v.replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    const remoteParts = clean(remote);
    const localParts = clean(local);
    
    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const r = remoteParts[i] || 0;
      const l = localParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  };

  // Routing logic — only runs once both auth and language are resolved
  useEffect(() => {
    if (authLoading || langLoading || configLoading) return;

    const inAuth = (segments[0] as string) === '(auth)';
    const inLangPicker = (segments[0] as string) === 'choose-language';
    const inMaintenance = (segments[0] as string) === 'maintenance-mode';
    const currentRoute = segments.join('/') || 'root';

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
      if (!inAuth) router.replace('/(auth)/login' as any);
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
  }, [user, authLoading, hasChosen, langLoading, isMaintenance, segments, maintenanceMessage, configLoading]);

  if (authLoading || langLoading || configLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }}>
        <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
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
        <Stack.Screen name="admin" options={{ gestureEnabled: true }} />
        <Stack.Screen name="bank-details" options={{ gestureEnabled: true }} />
        <Stack.Screen name="users" options={{ gestureEnabled: true }} />
        <Stack.Screen name="entry/[building_id]" options={{ headerShown: false }} />
        <Stack.Screen name="maintenance-mode" options={{ gestureEnabled: false }} />
      </Stack>
      <UpdateModal 
        visible={showUpdateModal} 
        onClose={() => setShowUpdateModal(false)} 
      />
    </>
  );
}

export default function RootLayout() {
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
