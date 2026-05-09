import React, { useEffect, useRef } from 'react';
import { Colors } from '../constants/colors';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Full-screen blocker when offline. Dismisses automatically when the network returns;
 * then navigates home so the user lands on a fresh tab stack (same expectation as
 * coming back from subscription payment).
 */
export default function NoInternetOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOnline, isChecking } = useNetworkStatus();
  const [retrying, setRetrying] = React.useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevOnlineRef = useRef<boolean | null>(null);

  const showOffline = !isChecking && !isOnline;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isChecking) return;

    const wasOffline = prevOnlineRef.current === false;
    if (wasOffline && isOnline) {
      router.replace('/' as any);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, isChecking, router]);

  useEffect(() => {
    if (!showOffline || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [showOffline]);

  useEffect(() => {
    if (!showOffline) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showOffline, pulseAnim]);

  const retry = async () => {
    setRetrying(true);
    await NetInfo.fetch();
    setTimeout(() => setRetrying(false), 1200);
  };

  if (Platform.OS === 'web') return null;
  if (!showOffline) return null;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => { /* block dismiss — must reconnect or use Try again */ }}
    >
      <StatusBar style="light" />
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.content}>
          <Animated.View style={[styles.iconBox, { opacity: pulseAnim }]}>
            <Ionicons name="cloud-offline-outline" size={56} color={Colors.white} />
          </Animated.View>

          <Text style={styles.title}>No internet connection</Text>
          <Text style={styles.subtitle}>
            Turn on Wi‑Fi or mobile data. When you are back online, we will take you to the home screen.
          </Text>

          <View style={styles.tipBlock}>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.75)" />
              <Text style={styles.tip}>Check Wi‑Fi or mobile data is enabled</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.75)" />
              <Text style={styles.tip}>Try moving to an area with better signal</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.retryBtn, retrying && { opacity: 0.75 }]}
            onPress={retry}
            disabled={retrying}
            activeOpacity={0.9}
          >
            {retrying ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                <Text style={styles.retryText}>Check again</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  tipBlock: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tip: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    flex: 1,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 24,
    minWidth: 200,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
});
