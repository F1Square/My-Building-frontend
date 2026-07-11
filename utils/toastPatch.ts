/**
 * ToastAndroid patch disabled.
 * Patching ToastAndroid broke Burnt (Burnt Android uses ToastAndroid under the hood)
 * and swallowed toasts after the old JS toast provider was removed.
 */
export function patchToastAndroid() {
  // no-op — leave native ToastAndroid alone
}

export function initToastAndroidPatch() {
  // no-op
}
