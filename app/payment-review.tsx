import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import * as WebBrowser from 'expo-web-browser';
import { ModuleHeader } from '../components/ModuleHeader';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PaymentReviewScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { recordId, billAmount, penaltyAmount, totalAmount, billMonth, billYear, billId, category } = useLocalSearchParams<{
    recordId: string;
    billAmount: string;
    penaltyAmount?: string;
    totalAmount?: string;
    billMonth: string;
    billYear: string;
    billId: string;
    category?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  React.useEffect(() => {
    loadPaymentDetails();
  }, [recordId]);

  const loadPaymentDetails = async () => {
    if (!recordId) {
      ToastAndroid.show('Invalid payment record', ToastAndroid.SHORT);
      router.back();
      return;
    }

    try {
      // Fetch payment record details
      const paymentsRes = await api.get('/maintenance/payments?mine=true');
      const payment = paymentsRes.data.find((p: any) => p.id === recordId);
      
      if (payment) {
        setPaymentDetails(payment);
      }
    } catch (e: any) {
      ToastAndroid.show('Failed to load payment details', ToastAndroid.LONG);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await api.post('/maintenance/pay/order', { payment_record_id: recordId });
      const { checkout_url } = res.data;

      // Must match backend easebuzz return deep-link (maintenance-category + Paid tab)
      const billCategory =
        category ||
        paymentDetails?.maintenance_bills?.category ||
        'maintenance';

      const result = await WebBrowser.openAuthSessionAsync(checkout_url, 'mybuilding://maintenance-category');

      if (result.type === 'success' && 'url' in result && result.url) {
        const queryPart = result.url.includes('?') ? result.url.split('?')[1] : '';
        const status = new URLSearchParams(queryPart).get('status');
        const returnCategory =
          new URLSearchParams(queryPart).get('category') || billCategory;

        if (status === 'success') {
          ToastAndroid.show('Payment successful!', ToastAndroid.LONG);
          router.replace({
            pathname: '/maintenance-category',
            params: { category: returnCategory, status: 'success' },
          } as any);
        } else if (status === 'failed') {
          ToastAndroid.show('Payment failed. Please try again.', ToastAndroid.LONG);
          router.replace({
            pathname: '/maintenance-category',
            params: { category: returnCategory, status: 'failed' },
          } as any);
        } else {
          router.replace({
            pathname: '/maintenance-category',
            params: { category: billCategory },
          } as any);
        }
      } else {
        // User closed gateway — still leave payment details
        router.replace({
          pathname: '/maintenance-category',
          params: { category: billCategory },
        } as any);
      }

      await WebBrowser.coolDownAsync().catch(() => {});
    } catch (e: any) {
      ToastAndroid.show(e.response?.data?.error || 'Failed to initiate payment', ToastAndroid.LONG);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  // Prefer live API amounts (includes overdue penalty); fall back to nav params
  const baseAmt = Number(paymentDetails?.amount ?? billAmount ?? 0) || 0;
  const penaltyAmt = paymentDetails
    ? (paymentDetails.is_overdue ? Number(paymentDetails.penalty_amount || 0) : 0)
    : (Number(penaltyAmount || 0) || 0);
  const totalDue = Number(
    paymentDetails?.display_amount ?? totalAmount ?? (baseAmt + penaltyAmt),
  ) || baseAmt;

  const wing = paymentDetails?.users?.wing || user?.wing;
  const flatNo = paymentDetails?.users?.flat_no || user?.flat_no;
  const wingFlat = flatNo ? (wing ? `${wing}-${flatNo}` : String(flatNo)) : 'N/A';

  return (
    <View style={styles.container}>
      {/* Header */}
      <ModuleHeader title="Payment Details" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Payment Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Bill Month</Text>
            <Text style={styles.summaryValue}>
              {MONTHS[parseInt(billMonth || '0')] || 'N/A'} {billYear}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tenant Name</Text>
            <Text style={styles.detailValue}>
              {paymentDetails?.users?.name || user?.name || 'N/A'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Flat No.</Text>
            <Text style={styles.detailValue}>{wingFlat}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Status</Text>
            <View
              style={[
                styles.statusBadge,
                paymentDetails?.status === 'paid'
                  ? styles.statusPaid
                  : styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  paymentDetails?.status === 'paid'
                    ? styles.statusPaidText
                    : styles.statusPendingText,
                ]}
              >
                {paymentDetails?.status?.toUpperCase() || 'PENDING'}
              </Text>
            </View>
          </View>

          {paymentDetails?.razorpay_payment_id && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment ID</Text>
              <Text style={styles.detailValue}>{paymentDetails.razorpay_payment_id.slice(0, 12)}...</Text>
            </View>
          )}
        </View>

        {/* Amount Breakdown */}
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Maintenance Bill</Text>
            <Text style={styles.amountValue}>{fmt(baseAmt)}</Text>
          </View>

          {penaltyAmt > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Late Penalty</Text>
              <Text style={styles.amountValue}>{fmt(penaltyAmt)}</Text>
            </View>
          )}

          <View style={styles.amountDivider} />

          <View style={styles.amountRowTotal}>
            <Text style={styles.totalLabel}>Total Amount Due</Text>
            <Text style={styles.totalAmount}>{fmt(totalDue)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkoutBtn, loading && styles.checkoutBtnDisabled]}
          onPress={handleCheckout}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="card" size={18} color={Colors.white} />
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryHeader: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPaid: {
    backgroundColor: '#DCFCE7',
  },
  statusPendingText: {
    color: '#92400E',
  },
  statusPaidText: {
    color: '#166534',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  amountDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  amountRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  checkoutBtnDisabled: {
    opacity: 0.6,
  },
  checkoutBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  cancelBtn: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
