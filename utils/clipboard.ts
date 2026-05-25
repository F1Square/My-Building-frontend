import { Share } from 'react-native';

/** Copy without eager native import — avoids crash when ExpoClipboard isn't in the binary. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    try {
      await Share.share({ message: text });
    } catch {
      return false;
    }
    return false;
  }
}
