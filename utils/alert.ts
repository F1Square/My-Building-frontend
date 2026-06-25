/**
 * Modern alert replacement using Toast notifications
 * Drop-in replacement for React Native's Alert.alert
 * 
 * Usage:
 *   import { Alert } from '../utils/alert';
 *   Alert.success('Success', 'Operation completed successfully');
 *   Alert.error('Error', 'Something went wrong');
 *   Alert.alert('Title', 'Message'); // Uses toast for simple messages
 *   Alert.alert('Confirm', 'Are you sure?', [{text: 'Cancel'}, {text: 'OK'}]); // Uses native alert for confirmations
 */

import { setToastInstance } from './modernAlert';
import { determineAlertType } from './alertPatch';

// Re-export from modernAlert for backward compatibility
export { setToastInstance };

// Import and re-export ModernAlert as Alert for drop-in replacement
import { ModernAlert } from './modernAlert';

/**
 * Smart alert system that chooses between toast and native alerts
 * Drop-in replacement for React Native Alert
 */
export const Alert = {
  /**
   * Show a success toast
   */
  success: ModernAlert.success,

  /**
   * Show an error toast
   */
  error: ModernAlert.error,

  /**
   * Show a warning toast
   */
  warning: ModernAlert.warning,

  /**
   * Show an info toast
   */
  info: ModernAlert.info,

  /**
   * Show a confirmation dialog (uses native alert)
   */
  confirm: ModernAlert.confirm,

  /**
   * Show a critical alert (uses native alert for confirmations, toast for simple messages)
   */
  alert: (
    title: string,
    message?: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    if (buttons && buttons.length > 0) {
      return ModernAlert.alert(title, message, buttons);
    }
    const type = determineAlertType(title, message);
    switch (type) {
      case 'success': return ModernAlert.success(title, message);
      case 'error': return ModernAlert.error(title, message);
      case 'warning': return ModernAlert.warning(title, message);
      default: return ModernAlert.info(title, message);
    }
  },

  /**
   * Convenience method for delete confirmations
   */
  deleteConfirm: ModernAlert.deleteConfirm,

  /**
   * Convenience method for subscription/upgrade prompts
   */
  subscriptionRequired: ModernAlert.subscriptionRequired,

  /**
   * Convenience method for permission requests
   */
  permissionRequired: ModernAlert.permissionRequired,
};

// Legacy exports for backward compatibility
export const showAlert = ModernAlert.info;