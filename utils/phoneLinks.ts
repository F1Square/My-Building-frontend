import { Linking } from 'react-native';
import { Alert } from './alert';

/** Digits-only phone for WhatsApp (country code, no +). e.g. 919876543210 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;

  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function normalizeDialPhone(phone: string | null | undefined): string | null {
  const wa = normalizeWhatsAppPhone(phone);
  if (!wa) return null;
  if (wa.startsWith('91') && wa.length === 12) return wa.slice(2);
  return wa;
}

export async function openWhatsApp(phone: string | null | undefined): Promise<void> {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    Alert.error('Invalid number', 'This phone number cannot be opened in WhatsApp.', 4000);
    return;
  }

  const urls = [
    `https://wa.me/${normalized}`,
    `whatsapp://send?phone=${normalized}`,
  ];

  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try next scheme
    }
  }

  Alert.error('Could not open WhatsApp', 'Please check that WhatsApp is installed and the phone number is valid.', 4000);
}

export async function openPhoneDialer(phone: string | null | undefined): Promise<void> {
  const normalized = normalizeDialPhone(phone);
  if (!normalized) {
    Alert.error('Invalid number', 'This phone number cannot be used for calling.', 4000);
    return;
  }

  const tel = normalized.length === 10 ? `tel:${normalized}` : `tel:+${normalized}`;
  try {
    await Linking.openURL(tel);
  } catch {
    Alert.error('Could not start call', 'Please check the phone number and try again.', 4000);
  }
}
