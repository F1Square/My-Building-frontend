import { NetInfoState } from '@react-native-community/netinfo';

/**
 * Matches server/cache expectations: connected and not explicitly without internet
 * (e.g. captive portal often reports isInternetReachable === false).
 */
export function computeIsOnline(state: NetInfoState): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}
