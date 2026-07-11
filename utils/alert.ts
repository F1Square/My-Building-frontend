/**
 * App alert API — Burnt toasts for messages, native Alert for confirmations.
 *
 * Usage:
 *   import { Alert } from '../utils/alert';
 *   Alert.success('Success', 'Operation completed', 4000);
 *   Alert.error('Error', 'Something went wrong', 4000);
 *   Alert.alert('Title', 'Message'); // toast
 *   Alert.alert('Confirm', 'Are you sure?', [{text: 'Cancel'}, {text: 'OK'}]); // native
 */

import * as Burnt from 'burnt';
import { Alert as RNAlert, Platform, ToastAndroid } from 'react-native';
import { determineAlertType, isDismissOnlyButtons } from './alertPatch';

type AlertKind = 'success' | 'error' | 'warning' | 'info';
type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Show a toast via Burnt.
 * On Android Burnt wraps ToastAndroid but passes duration in ms (invalid for RN),
 * so we call ToastAndroid with SHORT/LONG directly — same native toast UX.
 */
function burntToast(title: string, message?: string, kind: AlertKind = 'info', durationMs = 3000) {
  const hasMessage = Boolean(message?.trim());
  const text = hasMessage ? `${title}\n${message}` : title;

  if (Platform.OS === 'android') {
    ToastAndroid.show(text, durationMs > 2500 ? ToastAndroid.LONG : ToastAndroid.SHORT);
    return;
  }

  const duration = Math.max(1, Math.round(durationMs / 1000));
  const preset = kind === 'error' ? 'error' : kind === 'success' ? 'done' : 'none';
  const haptic =
    kind === 'error' ? 'error' : kind === 'success' ? 'success' : kind === 'warning' ? 'warning' : 'none';

  Burnt.toast({
    title,
    message: hasMessage ? message : undefined,
    preset,
    haptic,
    duration,
  });
}

function showNativeAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): Promise<number> {
  return new Promise((resolve) => {
    RNAlert.alert(
      title,
      message || '',
      buttons?.map((btn, index) => ({
        text: btn.text,
        onPress: () => {
          btn.onPress?.();
          resolve(index);
        },
        style: btn.style || 'default',
      })) || [{ text: 'OK', onPress: () => resolve(0) }],
    );
  });
}

export const Alert = {
  success: (title: string, message?: string, durationMs?: number) => {
    burntToast(title, message, 'success', durationMs ?? 3000);
  },

  error: (title: string, message?: string, durationMs?: number) => {
    burntToast(title, message, 'error', durationMs ?? 3500);
  },

  warning: (title: string, message?: string, durationMs?: number) => {
    burntToast(title, message, 'warning', durationMs ?? 3000);
  },

  info: (title: string, message?: string, durationMs?: number) => {
    burntToast(title, message, 'info', durationMs ?? 3000);
  },

  confirm: (title: string, message?: string, buttons?: AlertButton[]) =>
    showNativeAlert(title, message, buttons),

  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (buttons && buttons.length > 0) {
      if (isDismissOnlyButtons(buttons)) {
        burntToast(title, message, determineAlertType(title, message));
        buttons[0]?.onPress?.();
        return;
      }
      return showNativeAlert(title, message, buttons);
    }
    return burntToast(title, message, determineAlertType(title, message));
  },

  deleteConfirm: (itemName?: string, extraMessage?: string) => {
    const message = itemName
      ? `Delete "${itemName}"?${extraMessage ? ` ${extraMessage}` : ''}`
      : extraMessage || 'Delete this item?';
    return showNativeAlert('Delete', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive' },
    ]);
  },

  subscriptionRequired: (featureName?: string, action?: string) => {
    const message = featureName
      ? `The ${featureName} requires an active subscription.${action ? ` ${action}` : ''}`
      : 'This feature requires an active subscription.';
    return showNativeAlert('Subscription Required', message, [
      { text: 'Not Now', style: 'cancel' },
      { text: 'View Plans', style: 'default' },
    ]);
  },

  permissionRequired: (permissionName: string, reason?: string) => {
    const message = reason || `Allow ${permissionName} to use this feature`;
    return showNativeAlert('Permission Required', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Allow', style: 'default' },
    ]);
  },
};

export const showAlert = Alert.info;
