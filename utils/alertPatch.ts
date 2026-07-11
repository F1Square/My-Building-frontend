/**
 * Runtime patch for React Native Alert.alert → Burnt/Toast (simple messages)
 * and native alerts (multi-button confirmations).
 */

import * as Burnt from 'burnt';
import { Alert as RNAlert, Platform, ToastAndroid } from 'react-native';

const originalAlert = RNAlert.alert;

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

const DISMISS_BUTTON_TEXTS = new Set([
  'ok', 'okay', 'got it', 'done', 'close', 'dismiss', 'continue',
]);

export function isDismissOnlyButtons(buttons?: AlertButton[] | null): boolean {
  if (!buttons || buttons.length !== 1) return false;
  const btn = buttons[0];
  if (btn.style === 'destructive' || btn.style === 'cancel') return false;
  const text = (btn.text || '').toLowerCase().trim();
  return DISMISS_BUTTON_TEXTS.has(text);
}

export function determineAlertType(title: string, message?: string): 'success' | 'error' | 'warning' | 'info' {
  const titleLower = title.toLowerCase();
  const messageLower = message?.toLowerCase() || '';

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
    titleLower.includes('submitted') ||
    titleLower.includes('posted') ||
    titleLower.includes('copied') ||
    titleLower.includes('granted') ||
    titleLower.includes('approved') ||
    titleLower.includes('sent') ||
    messageLower.includes('success') ||
    messageLower.includes('successful') ||
    messageLower.includes('saved successfully')
  ) {
    return 'success';
  }

  if (
    titleLower.includes('error') ||
    titleLower.includes('failed') ||
    titleLower.includes('failure') ||
    titleLower.includes('could not') ||
    titleLower.includes('cannot') ||
    titleLower.includes('unable to') ||
    titleLower.includes('invalid') ||
    titleLower.includes('mismatch') ||
    messageLower.includes('error') ||
    messageLower.includes('failed') ||
    messageLower.includes('could not') ||
    messageLower.includes('please try again')
  ) {
    return 'error';
  }

  if (
    titleLower.includes('warning') ||
    titleLower.includes('attention') ||
    titleLower.includes('permission') ||
    titleLower.includes('required') ||
    titleLower.includes('weak') ||
    titleLower.includes('subscription') ||
    titleLower.includes('access denied') ||
    titleLower.includes('confirm') ||
    titleLower.includes('delete') ||
    titleLower.includes('are you sure')
  ) {
    return 'warning';
  }

  return 'info';
}

function showToast(
  title: string,
  message?: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
) {
  const hasMessage = Boolean(message?.trim());
  const text = hasMessage ? `${title}\n${message}` : title;

  if (Platform.OS === 'android') {
    ToastAndroid.show(text, ToastAndroid.LONG);
    return;
  }

  const preset = type === 'error' ? 'error' : type === 'success' ? 'done' : 'none';
  const haptic =
    type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'none';

  Burnt.toast({
    title,
    message: hasMessage ? message : undefined,
    preset,
    haptic,
    duration: 3,
  });
}

export function patchAlertSystem() {
  // @ts-ignore
  RNAlert.alert = function (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: 'success' | 'error' | 'warning' | 'info',
  ): any {
    const dismissOnly = isDismissOnlyButtons(buttons);
    if (!buttons || buttons.length === 0 || dismissOnly) {
      showToast(title, message, type || determineAlertType(title, message));
      if (dismissOnly) buttons![0]?.onPress?.();
      return;
    }
    return originalAlert.call(RNAlert, title, message, buttons);
  };
}

export function initAlertPatch() {
  if (RNAlert.alert !== originalAlert) return;
  try {
    patchAlertSystem();
  } catch (error) {
    console.error('[AlertPatch] Failed to patch alert system:', error);
  }
}
