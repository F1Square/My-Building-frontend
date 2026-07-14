import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { API_BASE } from '../constants/api';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { ModuleHeader } from '../components/ModuleHeader';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type HistoryTab = 'all' | 'paid' | 'pending';

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  water_meter: 'Water',
  special: 'Special',
};

function getPaymentActions(
  status: string,
  paymentMethod: string | null,
): ('pay_now' | 'mark_cash' | 'upload_receipt')[] {
  if (status !== 'pending' && status !== 'partial') return [];
  const m = paymentMethod ?? 'Online (Payment Gateway)';
  const actions: ('pay_now' | 'mark_cash' | 'upload_receipt')[] = [];
  if (m === 'Online (Payment Gateway)' || m === 'Both Cash & Online' || m === 'Cheque & Online') {
    actions.push('pay_now');
  }
  if (m === 'Cash Only' || m === 'Both Cash & Online') {
    actions.push('mark_cash');
  }
  if (m === 'Cheque' || m === 'Cheque & Online') {
    actions.push('upload_receipt');
  }
  if (actions.length === 0) actions.push('pay_now');
  return actions;
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function statusMeta(item: any) {
  if (item.status === 'paid') return { label: 'Paid', color: Colors.success };
  if (item.status === 'receipt_uploaded') return { label: 'Submitted', color: Colors.primary };
  if (item.status === 'partial') return { label: 'Partial', color: '#7C3AED' };
  return { label: 'Pending', color: '#D97706' };
}

export default function MyPaymentsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, hasActiveSubscription } = useAuth();
  const isLocked = user?.role !== 'admin' && !hasActiveSubscription;
  const processGuardRef = useRef(0);
  const { status: linkStatus } = useLocalSearchParams<{ status?: string }>();

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [tab, setTab] = useState<HistoryTab>('all');

  const fetchPayments = useCallback(async () => {
    try {
      const paymentsRes = await api.get('/maintenance/payments?mine=true');
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
    } catch (e: any) {
      Alert.error('Error', e?.response?.data?.error || 'Failed to load payment history', 4000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (isLocked) {
      setLoading(false);
      return;
    }
    fetchPayments();
  }, [isLocked, fetchPayments]));

  const processPaymentUrl = useCallback(async (url: string) => {
    const isReturn =
      url.startsWith('mybuilding://my-payments') ||
      url.startsWith('mybuilding://payment');
    if (!isReturn) return;
    const now = Date.now();
    if (now - processGuardRef.current < 2500) return;
    processGuardRef.current = now;

    const queryPart = url.includes('?') ? url.split('?')[1] : '';
    const status = new URLSearchParams(queryPart).get('status');
    await fetchPayments();
    if (status === 'success') {
      setTab('paid');
      Alert.success('Payment successful', 'Your payment was recorded.', 4000);
    } else if (status === 'failed') {
      Alert.error('Payment not completed', 'The payment did not finish. If your account was debited, refresh this screen.', 4000);
    }
  }, [fetchPayments]);

  useEffect(() => {
    if (linkStatus === 'success' || linkStatus === 'failed') {
      void processPaymentUrl(`mybuilding://my-payments?status=${linkStatus}`);
    }
  }, [linkStatus, processPaymentUrl]);

  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      await processPaymentUrl(event.url);
    };
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) return processPaymentUrl(initialUrl);
      })
      .catch(() => null);
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [processPaymentUrl]);

  const payNow = (recordId: string, item: any) => {
    const bill = item.maintenance_bills;
    const base = Number(item.amount) || 0;
    const total = Number(item.display_amount ?? item.amount) || base;
    const penalty = item.is_overdue
      ? Number(item.penalty_amount ?? Math.max(0, total - base))
      : 0;
    router.push({
      pathname: '/payment-review',
      params: {
        recordId,
        billAmount: String(base),
        penaltyAmount: String(penalty),
        totalAmount: String(total),
        billMonth: String(bill?.month || 0),
        billYear: String(bill?.year || new Date().getFullYear()),
        billId: String(bill?.id || ''),
        category: bill?.category || 'maintenance',
      },
    } as any);
  };

  const uploadReceipt = async (recordId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingReceipt(recordId);
    try {
      await api.patch(`/maintenance/payments/${recordId}/receipt`, {
        receipt_url: `data:image/jpeg;base64,${asset.base64}`,
      });
      fetchPayments();
    } catch (e: any) {
      Alert.error('Upload Failed', e.response?.data?.error || 'Could not upload receipt. Please try again.', 4000);
    } finally {
      setUploadingReceipt(null);
    }
  };

  const downloadReceipt = async (recordId: string) => {
    setDownloading(recordId);
    try {
      const token = await AsyncStorage.getItem('token');
      const url = `${API_BASE}/maintenance/receipt/${recordId}`;
      const localPath = `${FileSystem.cacheDirectory}receipt_${recordId.slice(0, 8)}.pdf`;

      const result = await FileSystem.downloadAsync(url, localPath, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.status !== 200) {
        Alert.error('Error', 'Failed to download receipt. Please try again.', 4000);
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.success('Downloaded', `Receipt saved to: ${result.uri}`, 4000);
      }
    } catch {
      Alert.error('Error', 'Could not download receipt. Check your connection.', 4000);
    } finally {
      setDownloading(null);
    }
  };

  const { paidList, pendingList, totalPaid, totalPending } = useMemo(() => {
    const paid: any[] = [];
    const pending: any[] = [];
    let paidSum = 0;
    let pendingSum = 0;
    for (const p of payments) {
      if (p.status === 'paid') {
        paid.push(p);
        paidSum += Number(p.display_amount ?? p.amount) || 0;
      } else if (p.status === 'pending' || p.status === 'partial' || p.status === 'receipt_uploaded') {
        pending.push(p);
        pendingSum += Number(p.amount_due ?? p.display_amount ?? p.amount) || 0;
      }
    }
    return { paidList: paid, pendingList: pending, totalPaid: paidSum, totalPending: pendingSum };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (tab === 'paid') return paidList;
    if (tab === 'pending') return pendingList;
    return payments;
  }, [tab, payments, paidList, pendingList]);

  const buildingPaymentMethod = payments[0]?.building_payment_method ?? null;

  const renderItem = ({ item }: { item: any }) => {
    const isPaid = item.status === 'paid';
    const isReceiptUploaded = item.status === 'receipt_uploaded';
    const isPartial = item.status === 'partial';
    const bill = item.maintenance_bills;
    const actions = getPaymentActions(item.status, buildingPaymentMethod);
    const status = statusMeta(item);
    const categoryKey = bill?.category || 'maintenance';
    const categoryLabel = CATEGORY_LABELS[categoryKey] || 'Bill';

    return (
      <View style={[styles.card, isPaid && styles.cardPaid]}>
        <View style={styles.cardTop}>
          <View style={styles.monthBox}>
            <Text style={styles.monthText}>{MONTHS[bill?.month] || '—'}</Text>
            <Text style={styles.yearText}>{bill?.year || ''}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardAmount}>{formatMoney(item.display_amount ?? item.amount)}</Text>
            <Text style={styles.cardCategory}>{categoryLabel}</Text>
            {item.is_overdue && Number(item.penalty_amount) > 0 ? (
              <Text style={styles.cardDesc}>
                Bill {formatMoney(item.amount)} + Penalty {formatMoney(item.penalty_amount)}
              </Text>
            ) : null}
            {bill?.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{bill.description}</Text>
            ) : null}
            {!isPaid && bill?.due_date ? (
              <Text style={styles.cardDue}>
                Due {new Date(bill.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {isPaid && item.paid_at ? (
          <View style={styles.metaRow}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.metaText} numberOfLines={2}>
              Paid on {new Date(item.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {item.payment_method === 'advance' ? ' · via advance credit' : ''}
            </Text>
          </View>
        ) : null}

        {isPartial ? (
          <View style={styles.metaRow}>
            <Ionicons name="wallet-outline" size={14} color="#7C3AED" />
            <Text style={[styles.metaText, { color: '#7C3AED' }]} numberOfLines={2}>
              {formatMoney(item.advance_credit_applied || 0)} via advance · {formatMoney(item.amount_due || 0)} remaining
            </Text>
          </View>
        ) : null}

        {isReceiptUploaded ? (
          <View style={styles.metaRow}>
            <Ionicons name="cloud-upload-outline" size={14} color={Colors.primary} />
            <Text style={[styles.metaText, { color: Colors.primary }]}>
              Receipt submitted — awaiting verification
            </Text>
          </View>
        ) : null}

        {(actions.length > 0 || isPaid) && (
          <View style={styles.cardActions}>
            {actions.includes('pay_now') && (
              <TouchableOpacity style={styles.payBtn} onPress={() => payNow(item.id, item)}>
                <Ionicons name="card-outline" size={15} color={Colors.white} />
                <Text style={styles.payBtnText}>Pay Now</Text>
              </TouchableOpacity>
            )}
            {actions.includes('mark_cash') && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => Alert.warning('Cash Payment', 'Please inform your Pramukh about your cash payment.', 4000)}
              >
                <Text style={[styles.outlineBtnText, { color: Colors.accent }]}>Cash</Text>
              </TouchableOpacity>
            )}
            {actions.includes('upload_receipt') && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => uploadReceipt(item.id)}
                disabled={uploadingReceipt === item.id}
              >
                {uploadingReceipt === item.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={15} color={Colors.primary} />
                    <Text style={styles.outlineBtnText}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {isPaid && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => downloadReceipt(item.id)}
                disabled={downloading === item.id}
              >
                {downloading === item.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={15} color={Colors.primary} />
                    <Text style={styles.outlineBtnText}>{t('receipt')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('paymentHistory')}
        subtitle={!isLocked && !loading ? `${payments.length} record${payments.length === 1 ? '' : 's'}` : undefined}
      />

      {isLocked ? (
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconBox}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.lockedTitle}>Subscription Required</Text>
          <Text style={styles.lockedDesc}>
            Subscribe to view your maintenance payment history and pay bills.
          </Text>
          <TouchableOpacity style={styles.lockedBtn} onPress={() => router.push('/subscribe' as any)}>
            <Ionicons name="star-outline" size={18} color={Colors.white} />
            <Text style={styles.lockedBtnText}>View Plans</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!loading && payments.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
                <Text style={styles.summaryLabel}>{t('totalPaid')}</Text>
                <Text style={[styles.summaryAmount, { color: Colors.success }]}>{formatMoney(totalPaid)}</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
                <Text style={styles.summaryLabel}>{t('pending')}</Text>
                <Text style={[styles.summaryAmount, { color: '#F59E0B' }]}>{formatMoney(totalPending)}</Text>
              </View>
            </View>
          )}

          {!loading && payments.length > 0 && (
            <View style={styles.tabRow}>
              {([
                { key: 'all' as const, label: `All (${payments.length})` },
                { key: 'paid' as const, label: `Paid (${paidList.length})` },
                { key: 'pending' as const, label: `Pending (${pendingList.length})` },
              ]).map((item) => {
                const active = tab === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => setTab(item.key)}
                  >
                    <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={filteredPayments}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.list}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); fetchPayments(); }}
                />
              )}
              ListEmptyComponent={(
                <View style={styles.empty}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons name="receipt-outline" size={36} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {tab === 'paid'
                      ? 'No paid bills yet'
                      : tab === 'pending'
                        ? 'No pending bills'
                        : 'No payment records'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {tab === 'all'
                      ? 'Your maintenance bills will appear here'
                      : 'Try another filter or pull to refresh'}
                  </Text>
                </View>
              )}
              renderItem={renderItem}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  summaryLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, fontWeight: '600' },
  summaryAmount: { fontSize: 18, fontWeight: '800' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.white },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPaid: { borderLeftWidth: 3, borderLeftColor: Colors.success },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  monthBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  yearText: { fontSize: 10, color: Colors.textMuted },
  cardAmount: { fontSize: 18, fontWeight: '800', color: Colors.text },
  cardCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  cardDue: { fontSize: 11, color: '#D97706', marginTop: 3, fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaText: { fontSize: 12, color: Colors.success, flex: 1, lineHeight: 17 },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  outlineBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 56, gap: 10, paddingHorizontal: 32 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  lockedIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  lockedBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
});
