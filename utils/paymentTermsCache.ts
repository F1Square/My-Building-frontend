import api from './api';
import type { PaymentTermsData } from '../components/PaymentTermsModal';

let cached: PaymentTermsData | null = null;

export async function fetchPaymentTerms(force = false): Promise<PaymentTermsData> {
  if (cached && !force) return cached;
  const response = await api.get('/buildings/payment-terms');
  cached = response.data;
  return cached!;
}
