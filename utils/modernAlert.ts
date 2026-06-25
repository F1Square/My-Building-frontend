/**
 * Modern alert system for React Native
 * Replaces Alert.alert with a hybrid approach:
 * - Toast notifications for simple messages
 * - Native alerts for confirmations/critical actions
 * - Unified API for better UX and aesthetics
 */

import { Alert as RNAlert, Platform } from 'react-native';

// This will be set by the useToast hook via a singleton pattern
let toastInstance: any = null;

export function setToastInstance(instance: any) {
  toastInstance = instance;
}

type AlertType = 'success' | 'error' | 'warning' | 'info';
type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Show a toast notification (for non-critical messages)
 */
function showToast(
  title: string,
  message?: string,
  type: AlertType = 'info',
  duration?: number
) {
  if (!toastInstance) {
    console.warn('[ModernAlert] Toast instance not initialized, falling back to native alert');
    const fullMessage = message ? `${title}: ${message}` : title;
    RNAlert.alert(type.toUpperCase(), fullMessage);
    return;
  }

  const fullMessage = message ? `${title}: ${message}` : title;
  toastInstance.showToast({ message: fullMessage, type, duration });
}

/**
 * Show a native alert (for confirmations/critical actions)
 */
function showNativeAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type: AlertType = 'info'
): Promise<number> {
  return new Promise((resolve) => {
    const fullMessage = message || '';
    
    // Use native alert for confirmations
    RNAlert.alert(
      title,
      fullMessage,
      buttons?.map((btn, index) => ({
        text: btn.text,
        onPress: () => {
          btn.onPress?.();
          resolve(index);
        },
        style: btn.style || 'default',
      })) || [{ text: 'OK', onPress: () => resolve(0) }]
    );
  });
}

/**
 * Smart alert system that chooses the right display method
 */
export const ModernAlert = {
  /**
   * Show a success message as toast
   */
  success: (title: string, message?: string, duration?: number) => {
    showToast(title, message, 'success', duration);
  },

  /**
   * Show an error message as toast
   */
  error: (title: string, message?: string, duration?: number) => {
    showToast(title, message, 'error', duration);
  },

  /**
   * Show a warning message as toast
   */
  warning: (title: string, message?: string, duration?: number) => {
    showToast(title, message, 'warning', duration);
  },

  /**
   * Show an info message as toast
   */
  info: (title: string, message?: string, duration?: number) => {
    showToast(title, message, 'info', duration);
  },

  /**
   * Show a confirmation dialog (uses native alert)
   */
  confirm: (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ): Promise<number> => {
    return showNativeAlert(title, message, buttons, 'warning');
  },

  /**
   * Show a critical alert (uses native alert)
   */
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type: AlertType = 'info'
  ): Promise<number> => {
    return showNativeAlert(title, message, buttons, type);
  },

  /**
   * Convenience method for delete confirmations
   */
  deleteConfirm: (
    itemName?: string,
    extraMessage?: string
  ): Promise<number> => {
    const message = itemName
      ? `Delete "${itemName}"?${extraMessage ? ` ${extraMessage}` : ''}`
      : extraMessage || 'Delete this item?';
    
    return showNativeAlert(
      'Delete',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' },
      ],
      'warning'
    );
  },

  /**
   * Convenience method for subscription/upgrade prompts
   */
  subscriptionRequired: (
    featureName?: string,
    action?: string
  ): Promise<number> => {
    const message = featureName
      ? `The ${featureName} requires an active subscription.${action ? ` ${action}` : ''}`
      : 'This feature requires an active subscription.';
    
    return showNativeAlert(
      'Subscription Required',
      message,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'View Plans', style: 'default' },
      ],
      'warning'
    );
  },

  /**
   * Convenience method for permission requests
   */
  permissionRequired: (
    permissionName: string,
    reason?: string
  ): Promise<number> => {
    const message = reason || `Allow ${permissionName} to use this feature`;
    
    return showNativeAlert(
      'Permission Required',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Allow', style: 'default' },
      ],
      'info'
    );
  },
};

/**
 * Drop-in replacement for React Native Alert
 * Automatically chooses between toast and native alert based on buttons
 */
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: AlertType
  ): Promise<number> | void => {
    // If buttons are provided, use native alert
    if (buttons && buttons.length > 0) {
      return showNativeAlert(title, message, buttons, type);
    }
    
    // Otherwise use toast
    showToast(title, message, type);
  },
};

// Export for backward compatibility
export const showAlert = showToast;