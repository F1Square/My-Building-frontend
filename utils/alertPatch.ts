/**
 * Runtime patch for React Native Alert.alert
 * This file should be imported early in the app lifecycle (e.g., in _layout.tsx)
 * It automatically intercepts all Alert.alert calls and converts them to modern toast notifications
 */

import { Alert as RNAlert } from 'react-native';
import { ModernAlert } from './modernAlert';

// Store the original alert method
const originalAlert = RNAlert.alert;

/**
 * Determine alert type based on title and message content
 */
export function determineAlertType(title: string, message?: string): 'success' | 'error' | 'warning' | 'info' {
  const titleLower = title.toLowerCase();
  const messageLower = message?.toLowerCase() || '';
  
  // Check for success indicators
  if (
    titleLower.includes('success') ||
    titleLower.includes('successful') ||
    titleLower.includes('done') ||
    titleLower.includes('saved') ||
    titleLower.includes('updated') ||
    titleLower.includes('created') ||
    titleLower.includes('uploaded') ||
    titleLower.includes('downloaded') ||
    titleLower.includes('added') ||
    messageLower.includes('success') ||
    messageLower.includes('successful') ||
    messageLower.includes('saved successfully')
  ) {
    return 'success';
  }
  
  // Check for error indicators
  if (
    titleLower.includes('error') ||
    titleLower.includes('failed') ||
    titleLower.includes('failure') ||
    titleLower.includes('upload failed') ||
    titleLower.includes('download failed') ||
    titleLower.includes('could not') ||
    titleLower.includes('cannot') ||
    titleLower.includes('unable to') ||
    titleLower.includes('something went wrong') ||
    messageLower.includes('error') ||
    messageLower.includes('failed') ||
    messageLower.includes('could not') ||
    messageLower.includes('please try again')
  ) {
    return 'error';
  }
  
  // Check for warning indicators
  if (
    titleLower.includes('warning') ||
    titleLower.includes('attention') ||
    titleLower.includes('permission') ||
    titleLower.includes('required') ||
    titleLower.includes('required') ||
    titleLower.includes('subscription') ||
    titleLower.includes('access denied') ||
    titleLower.includes('confirm') ||
    titleLower.includes('delete') ||
    titleLower.includes('are you sure')
  ) {
    return 'warning';
  }
  
  // Default to info
  return 'info';
}

/**
 * Patch Alert.alert to use modern toast system
 * This intercepts all Alert.alert calls and:
 * - Uses toast notifications for simple messages (no buttons)
 * - Uses native alerts for confirmations (with buttons)
 * - Provides better UX and aesthetics
 */
export function patchAlertSystem() {
  // @ts-ignore - Overriding React Native Alert.alert
  RNAlert.alert = function(
    title: string,
    message?: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    type?: 'success' | 'error' | 'warning' | 'info'
  ): any {
    // For simple messages without buttons, use toast
    if (!buttons || buttons.length === 0) {
      // Determine alert type based on title/message content
      const alertType = type || determineAlertType(title, message);
      
      // Show appropriate toast based on type
      switch (alertType) {
        case 'success':
          ModernAlert.success(title, message);
          break;
        case 'error':
          ModernAlert.error(title, message);
          break;
        case 'warning':
          ModernAlert.warning(title, message);
          break;
        case 'info':
        default:
          ModernAlert.info(title, message);
          break;
      }
      return;
    }
    
    // For confirmations/actions with buttons, use the original alert
    // but we can improve it by adding better styling
    return originalAlert.call(RNAlert, title, message, buttons);
  };
}

/**
 * Initialize the alert patch (idempotent). Also runs via alertBootstrap on app load.
 */
export function initAlertPatch() {
  if (RNAlert.alert !== originalAlert) {
    return;
  }

  try {
    patchAlertSystem();
  } catch (error) {
    console.error('[AlertPatch] Failed to patch alert system:', error);
  }
}