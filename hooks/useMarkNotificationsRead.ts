import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import api from '../utils/api';

/**
 * Call this in any screen to mark notifications of given types as read
 * when the user focuses the screen.
 */
export function useMarkNotificationsRead(types: string[]) {
  useFocusEffect(
    useCallback(() => {
      // Fire and forget with a small delay so it doesn't compete with the main data fetch
      const timer = setTimeout(() => {
        api.patch('/notifications/read-by-types', { types }).catch(() => {});
      }, 1000);
      return () => clearTimeout(timer);
    }, [])
  );
}
