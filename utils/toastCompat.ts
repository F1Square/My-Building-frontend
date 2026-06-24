/**
 * Cross-platform Toast compatibility
 * Provides a unified API for toast notifications across Android and iOS
 * Replaces ToastAndroid with a modern toast system
 */

import { Platform, ToastAndroid } from 'react-native';
import { ModernAlert } from './modernAlert';

/**
 * Show a toast message (cross-platform)
 * @param message - The message to show
 * @param duration - Duration in milliseconds (default: ToastAndroid.SHORT)
 * @param type - Toast type: 'success' | 'error' | 'warning' | 'info'
 */
export function showToast(
  message: string,
  duration: number = Platform.OS === 'android' ? ToastAndroid.SHORT : 3000,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
) {
  // Use ModernAlert for cross-platform compatibility
  const title = type === 'success' ? 'Success' : 
                type === 'error' ? 'Error' :
                type === 'warning' ? 'Warning' : 'Info';
  
  ModernAlert.info(title, message);
}

/**
 * ToastAndroid compatibility wrapper
 * Replaces ToastAndroid with modern toast system
 */
export const ToastCompat = {
  /**
   * Show a toast with the specified duration
   */
  show: (message: string, duration: number = ToastAndroid.SHORT) => {
    showToast(message, duration, 'info');
  },
  
  /**
   * Show a short toast
   */
  SHORT: ToastAndroid.SHORT,
  
  /**
   * Show a long toast
   */
  LONG: ToastAndroid.LONG,
  
  /**
   * Show a toast at the top of the screen
   */
  showWithGravity: (
    message: string,
    duration: number = ToastAndroid.SHORT,
    gravity: number = ToastAndroid.BOTTOM
  ) => {
    showToast(message, duration, 'info');
  },
  
  /**
   * Show a toast at the top of the screen with custom gravity
   */
  showWithGravityAndOffset: (
    message: string,
    duration: number = ToastAndroid.SHORT,
    gravity: number = ToastAndroid.BOTTOM,
    xOffset: number = 0,
    yOffset: number = 0
  ) => {
    showToast(message, duration, 'info');
  },
  
  /**
   * Show a success toast
   */
  success: (message: string, duration?: number) => {
    showToast(message, duration, 'success');
  },
  
  /**
   * Show an error toast
   */
  error: (message: string, duration?: number) => {
    showToast(message, duration, 'error');
  },
  
  /**
   * Show a warning toast
   */
  warning: (message: string, duration?: number) => {
    showToast(message, duration, 'warning');
  },
  
  /**
   * Show an info toast
   */
  info: (message: string, duration?: number) => {
    showToast(message, duration, 'info');
  },
};

// Export for easy migration
export const ToastAndroidCompat = ToastCompat;