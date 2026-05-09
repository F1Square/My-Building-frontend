import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { computeIsOnline } from '../utils/networkState';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => Platform.OS === 'web');
  const [isChecking, setIsChecking] = useState(() => Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsOnline(true);
      setIsChecking(false);
      return;
    }

    let mounted = true;
    NetInfo.fetch().then((state) => {
      if (!mounted) return;
      setIsOnline(computeIsOnline(state));
      setIsChecking(false);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(computeIsOnline(state));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { isOnline, isChecking };
}
