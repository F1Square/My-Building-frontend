/**
 * Runtime patch for React Native ToastAndroid
 * This file patches ToastAndroid to use modern toast notifications
 */

import { ToastAndroid as RNToastAndroid } from 'react-native';
import { ToastCompat } from './toastCompat';

// Store original ToastAndroid methods
const originalToastAndroid = {
  show: RNToastAndroid.show,
  showWithGravity: RNToastAndroid.showWithGravity,
  showWithGravityAndOffset: RNToastAndroid.showWithGravityAndOffset,
};

/**
 * Patch ToastAndroid to use modern toast system
 */
export function patchToastAndroid() {
  // @ts-ignore - Overriding ToastAndroid methods
  RNToastAndroid.show = function(message: string, duration?: number) {
    // Determine toast type based on message content
    let type: 'success' | 'error' | 'warning' | 'info' = 'info';
    const messageLower = message.toLowerCase();
    
    if (
      messageLower.includes('success') ||
      messageLower.includes('saved') ||
      messageLower.includes('updated') ||
      messageLower.includes('created') ||
      messageLower.includes('uploaded') ||
      messageLower.includes('downloaded') ||
      messageLower.includes('added')
    ) {
      type = 'success';
    } else if (
      messageLower.includes('error') ||
      messageLower.includes('failed') ||
      messageLower.includes('could not') ||
      messageLower.includes('unable to')
    ) {
      type = 'error';
    } else if (
      messageLower.includes('warning') ||
      messageLower.includes('required') ||
      messageLower.includes('must')
    ) {
      type = 'warning';
    }
    
    ToastCompat.show(message, duration);
    return;
  };
  
  // @ts-ignore - Overriding ToastAndroid methods
  RNToastAndroid.showWithGravity = function(
    message: string,
    duration?: number,
    gravity?: number
  ) {
    ToastCompat.show(message, duration);
    return;
  };
  
  // @ts-ignore - Overriding ToastAndroid methods
  RNToastAndroid.showWithGravityAndOffset = function(
    message: string,
    duration?: number,
    gravity?: number,
    xOffset?: number,
    yOffset?: number
  ) {
    ToastCompat.show(message, duration);
    return;
  };
}

/**
 * Initialize the ToastAndroid patch
 * Call this early in your app initialization
 */
export function initToastAndroidPatch() {
  if (originalToastAndroid.show !== RNToastAndroid.show) {
    console.log('[ToastPatch] ToastAndroid already patched');
    return;
  }
  
  try {
    patchToastAndroid();
    console.log('[ToastPatch] ToastAndroid patched successfully');
    console.log('[ToastPatch] All ToastAndroid calls will now use modern toast notifications');
  } catch (error) {
    console.error('[ToastPatch] Failed to patch ToastAndroid:', error);
  }
}

// Auto-patch if imported directly (for development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    try {
      if (originalToastAndroid.show !== RNToastAndroid.show) {
        console.log('[ToastPatch] Auto-patching ToastAndroid...');
        patchToastAndroid();
      }
    } catch (error) {
      console.warn('[ToastPatch] Failed to auto-patch ToastAndroid:', error);
    }
  }, 1000);
}