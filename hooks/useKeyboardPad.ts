import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Extra bottom padding while the IME is open so ScrollView content stays scrollable.
 * Shared by auth screens (login / register).
 */
export function useKeyboardPad() {
  const [keyboardPad, setKeyboardPad] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const next = Math.max(0, Math.round(e.endCoordinates.height) - Math.round(insets.bottom));
      setKeyboardPad((prev) => (prev === next ? prev : next));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  return keyboardPad;
}
