import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, ScrollView, Modal, TextInput, FlatList,
  Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import api from '../utils/api';
import { API_BASE } from '../constants/api';

type BillingCategory = 'maintenance' | 'water_meter' | 'special';

interface PaymentRecord {
  id: string;
  bill_id: string;
  user_id: string;
  amount: number;
  flat_amount?: number;
  status: 'pending' | 'paid';
  paid_at?: string;
  razorpay_payment_id?: string;
  category?: BillingCategory;
  maintenance_bills?: {
    id: string;
    description: string;
    due_date: string;
    amount: number;
    penalty_amount?: number;
    month?: number;
    year?: number;
    category?: BillingCategory;
  };
}

interface Bill {
  id: string;
  description: string;
  due_date: string;
  amount: number;
  penalty_amount?: number;
  month?: number;
  year?: number;
  category: BillingCategory;
  amount_mode?: 'uniform' | 'flat_wise';
  targeting_mode?: 'building_wide' | 'targeted';
  created_at: string;
  is_edited?: boolean;
  edited_by?: string;
  editor?: { name: string } | null;
}

interface Member {
  id: string;
  name: string;
  flat_no: string;
  wing?: string;
}

interface FlatAmountEntry {
  user_id: string;
  flat_no: string;
  name: string;
  amount: string;
}

interface BillFormState {
  due_date: string;
  description: string;
  amount: string;
  penalty_amount: string;
  month: string;
  year: string;
  flat_amounts: FlatAmountEntry[];
  amount_mode: 'uniform' | 'flat_wise';
  targeting_mode: 'building_wide' | 'targeted';
  targeted_user_ids: string[];
}

const CATEGORY_LABELS: Record<BillingCategory, string> = {
  maintenance: 'Maintenance Bill',
  water_meter: 'Water Meter',
  special: 'Special Bills',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ─── User Bill Card ───────────────────────────────────────────────────────────

interface BillCardProps {
  record: PaymentRecord;
  category: BillingCategory;
  onPay: (record: PaymentRecord) => void;
  onReceipt: (record: PaymentRecord) => void;
}

function BillCard({ record, category, onPay, onReceipt }: BillCardProps) {
  const bill = record.maintenance_bills;
  const overdue = record.status === 'pending' && bill?.due_date ? isOverdue(bill.due_date) : false;
  const penaltyAmount = category === 'maintenance' && overdue && bill?.penalty_amount ? bill.penalty_amount : 0;
  const totalDue = record.amount + penaltyAmount;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.desc}>{bill?.description || '—'}</Text>
          {bill?.month && bill?.year && (
            <Text style={cardStyles.period}>{MONTHS[(bill.month ?? 1) - 1]} {bill.year}</Text>
          )}
        </View>
        <View style={[
          cardStyles.statusBadge,
          record.status === 'paid' ? cardStyles.paidBadge : overdue ? cardStyles.overdueBadge : cardStyles.pendingBadge,
        ]}>
          <Text style={cardStyles.statusText}>
            {record.status === 'paid' ? 'Paid' : overdue ? 'Overdue' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={cardStyles.row}>
        <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
        <Text style={cardStyles.meta}>Due: {formatDate(bill?.due_date)}</Text>
        {record.status === 'paid' && record.paid_at && (
          <Text style={[cardStyles.meta, { marginLeft: 12 }]}>Paid: {formatDate(record.paid_at)}</Text>
        )}
      </View>

      <View style={cardStyles.amountRow}>
        <Text style={cardStyles.amount}>{formatAmount(record.amount)}</Text>
        {penaltyAmount > 0 && (
          <Text style={cardStyles.penalty}>+ ₹{penaltyAmount} penalty = {formatAmount(totalDue)}</Text>
        )}
      </View>

      {record.status === 'pending' && (
        <TouchableOpacity style={cardStyles.payBtn} onPress={() => onPay(record)} activeOpacity={0.8}>
          <Ionicons name="card-outline" size={16} color={Colors.white} />
          <Text style={cardStyles.payBtnText}>Pay {formatAmount(totalDue)}</Text>
        </TouchableOpacity>
      )}
      {record.status === 'paid' && (
        <TouchableOpacity style={cardStyles.receiptBtn} onPress={() => onReceipt(record)} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={16} color={Colors.primary} />
          <Text style={cardStyles.receiptBtnText}>Download Receipt</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  desc: { fontSize: 15, fontWeight: '700', color: Colors.text },
  period: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  paidBadge: { backgroundColor: '#DCFCE7' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  overdueBadge: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  meta: { fontSize: 12, color: Colors.textMuted },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  amount: { fontSize: 20, fontWeight: '800', color: Colors.text },
  penalty: { fontSize: 12, color: Colors.danger, flex: 1 },
  payBtn: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  receiptBtn: {
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  receiptBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});

// ─── Payment Detail Modal ─────────────────────────────────────────────────────

interface PaymentDetailModalProps {
  record: PaymentRecord | null;
  visible: boolean;
  onClose: () => void;
}

function PaymentDetailModal({ record, visible, onClose }: PaymentDetailModalProps) {
  if (!record) return null;
  const bill = record.maintenance_bills;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <View style={detailStyles.sheet}>
          <View style={detailStyles.handle} />
          <Text style={detailStyles.title}>Payment Detail</Text>

          <View style={detailStyles.row}>
            <Text style={detailStyles.label}>Description</Text>
            <Text style={detailStyles.value}>{bill?.description || '—'}</Text>
          </View>
          <View style={detailStyles.row}>
            <Text style={detailStyles.label}>Amount</Text>
            <Text style={detailStyles.value}>{formatAmount(record.amount)}</Text>
          </View>
          <View style={detailStyles.row}>
            <Text style={detailStyles.label}>Status</Text>
            <Text style={[detailStyles.value, { color: record.status === 'paid' ? Colors.success : Colors.danger, fontWeight: '700' }]}>
              {record.status === 'paid' ? 'Paid' : 'Pending'}
            </Text>
          </View>
          <View style={detailStyles.row}>
            <Text style={detailStyles.label}>Due Date</Text>
            <Text style={detailStyles.value}>{formatDate(bill?.due_date)}</Text>
          </View>
          {record.status === 'paid' && (
            <>
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Paid On</Text>
                <Text style={detailStyles.value}>{formatDate(record.paid_at)}</Text>
              </View>
              {record.razorpay_payment_id && (
                <View style={detailStyles.row}>
                  <Text style={detailStyles.label}>Payment ID</Text>
                  <Text style={[detailStyles.value, { fontSize: 12 }]}>{record.razorpay_payment_id}</Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose}>
            <Text style={detailStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 14, color: Colors.textMuted },
  value: { fontSize: 14, color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  closeBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  closeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});

// ─── Bill Creation Form Modal ─────────────────────────────────────────────────

interface BillFormModalProps {
  visible: boolean;
  category: BillingCategory;
  members: Member[];
  onClose: () => void;
  onSubmit: (form: BillFormState) => Promise<void>;
}

function BillFormModal({ visible, category, members, onClose, onSubmit }: BillFormModalProps) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<BillFormState>({
    due_date: '',
    description: '',
    amount: '',
    penalty_amount: '',
    month: String(new Date().getMonth() + 1),
    year: String(currentYear),
    flat_amounts: members.map(m => ({ user_id: m.id, flat_no: m.flat_no, name: m.name, amount: '' })),
    amount_mode: 'uniform',
    targeting_mode: 'building_wide',
    targeted_user_ids: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(new Date().getMonth() + 1);

  // Sync flat_amounts when members change
  React.useEffect(() => {
    setForm(f => ({
      ...f,
      flat_amounts: members.map(m => {
        const existing = f.flat_amounts.find(fa => fa.user_id === m.id);
        return existing ?? { user_id: m.id, flat_no: m.flat_no, name: m.name, amount: '' };
      }),
    }));
  }, [members]);

  const set = (key: keyof BillFormState, value: any) => setForm(f => ({ ...f, [key]: value }));

  const toggleTargeted = (userId: string) => {
    setForm(f => {
      const ids = f.targeted_user_ids.includes(userId)
        ? f.targeted_user_ids.filter(id => id !== userId)
        : [...f.targeted_user_ids, userId];
      return { ...f, targeted_user_ids: ids };
    });
  };

  const updateFlatAmount = (userId: string, amount: string) => {
    setForm(f => ({
      ...f,
      flat_amounts: f.flat_amounts.map(fa => fa.user_id === userId ? { ...fa, amount } : fa),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  const showFlatAmounts = (category === 'water_meter' && form.amount_mode === 'flat_wise') || (category === 'special' && form.amount_mode === 'flat_wise');
  const showUniformAmount = category === 'maintenance' || (category === 'water_meter' && form.amount_mode === 'uniform') || (category === 'special' && form.amount_mode === 'uniform');
  const visibleMembers = form.targeting_mode === 'targeted'
    ? members.filter(m => form.targeted_user_ids.includes(m.id))
    : members;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={formStyles.overlay}>
        <View style={formStyles.sheet}>
          <View style={formStyles.handle} />
          <View style={formStyles.sheetHeader}>
            <Text style={formStyles.title}>Create {CATEGORY_LABELS[category]} Bill</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Due Date — calendar picker */}
            <Text style={formStyles.label}>Due Date *</Text>
            <TouchableOpacity style={formStyles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{ color: form.due_date ? Colors.text : Colors.textMuted, fontSize: 15 }}>
                {form.due_date ? formatDate(form.due_date) : 'Select due date...'}
              </Text>
            </TouchableOpacity>

            {/* Inline mini calendar */}
            {showDatePicker && (
              <View style={formStyles.calendarBox}>
                <View style={formStyles.calHeader}>
                  <TouchableOpacity onPress={() => {
                    if (dpMonth === 1) { setDpMonth(12); setDpYear(y => y - 1); }
                    else setDpMonth(m => m - 1);
                  }}>
                    <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={formStyles.calMonthLabel}>{MONTHS[dpMonth - 1]} {dpYear}</Text>
                  <TouchableOpacity onPress={() => {
                    if (dpMonth === 12) { setDpMonth(1); setDpYear(y => y + 1); }
                    else setDpMonth(m => m + 1);
                  }}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={formStyles.calGrid}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <Text key={d} style={formStyles.calDayLabel}>{d}</Text>
                  ))}
                  {(() => {
                    const firstDay = new Date(dpYear, dpMonth - 1, 1).getDay();
                    const daysInMonth = new Date(dpYear, dpMonth, 0).getDate();
                    const cells: (number | null)[] = Array(firstDay).fill(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    while (cells.length % 7 !== 0) cells.push(null);
                    return cells.map((day, i) => {
                      if (!day) return <View key={i} style={formStyles.calCell} />;
                      const dateStr = `${dpYear}-${String(dpMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const selected = form.due_date === dateStr;
                      return (
                        <TouchableOpacity key={i} style={[formStyles.calCell, selected && formStyles.calCellSelected]}
                          onPress={() => { set('due_date', dateStr); setShowDatePicker(false); }}>
                          <Text style={[formStyles.calCellText, selected && { color: Colors.white, fontWeight: '800' }]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </View>
            )}

            {/* Description */}
            <Text style={formStyles.label}>Description {category !== 'special' ? '' : '*'}</Text>
            <TextInput
              style={formStyles.input}
              placeholder={category === 'water_meter' ? 'Optional' : 'e.g. Festival decoration levy'}
              value={form.description}
              onChangeText={v => set('description', v)}
              placeholderTextColor={Colors.textMuted}
            />

            {/* Maintenance-specific: month, year, penalty */}
            {category === 'maintenance' && (
              <>
                <View style={formStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={formStyles.label}>Month *</Text>
                    <TextInput
                      style={formStyles.input}
                      placeholder="1-12"
                      value={form.month}
                      onChangeText={v => set('month', v)}
                      keyboardType="numeric"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={formStyles.label}>Year *</Text>
                    <TextInput
                      style={formStyles.input}
                      placeholder={String(currentYear)}
                      value={form.year}
                      onChangeText={v => set('year', v)}
                      keyboardType="numeric"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
                <Text style={formStyles.label}>Penalty Amount (₹)</Text>
                <TextInput
                  style={formStyles.input}
                  placeholder="0"
                  value={form.penalty_amount}
                  onChangeText={v => set('penalty_amount', v)}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            {/* Water meter / Special: amount_mode toggle */}
            {(category === 'water_meter' || category === 'special') && (
              <>
                <Text style={formStyles.label}>Amount Mode</Text>
                <View style={formStyles.toggleRow}>
                  {(['uniform', 'flat_wise'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[formStyles.toggleBtn, form.amount_mode === mode && formStyles.toggleBtnActive]}
                      onPress={() => set('amount_mode', mode)}
                    >
                      <Text style={[formStyles.toggleText, form.amount_mode === mode && formStyles.toggleTextActive]}>
                        {mode === 'uniform' ? 'Uniform' : 'Flat-wise'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Special only: targeting mode + flat picker */}
            {category === 'special' && (
              <>
                <Text style={formStyles.label}>Targeting Mode</Text>
                <View style={formStyles.toggleRow}>
                  {(['building_wide', 'targeted'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[formStyles.toggleBtn, form.targeting_mode === mode && formStyles.toggleBtnActive]}
                      onPress={() => set('targeting_mode', mode)}
                    >
                      <Text style={[formStyles.toggleText, form.targeting_mode === mode && formStyles.toggleTextActive]}>
                        {mode === 'building_wide' ? 'Building-wide' : 'Targeted'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Targeted: flat picker */}
                {form.targeting_mode === 'targeted' && (
                  <>
                    <Text style={formStyles.label}>Select Flats *</Text>
                    {members.map(m => (
                      <TouchableOpacity
                        key={m.id}
                        style={formStyles.flatPickerRow}
                        onPress={() => toggleTargeted(m.id)}
                      >
                        <View style={[
                          formStyles.checkbox,
                          form.targeted_user_ids.includes(m.id) && formStyles.checkboxChecked,
                        ]}>
                          {form.targeted_user_ids.includes(m.id) && (
                            <Ionicons name="checkmark" size={14} color={Colors.white} />
                          )}
                        </View>
                        <Text style={formStyles.flatPickerText}>
                          {m.wing ? `${m.wing}-` : ''}{m.flat_no} — {m.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Uniform amount field */}
            {showUniformAmount && (
              <>
                <Text style={formStyles.label}>Amount (₹) *</Text>
                <TextInput
                  style={formStyles.input}
                  placeholder="e.g. 2500"
                  value={form.amount}
                  onChangeText={v => set('amount', v)}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            {/* Flat-wise amount inputs */}
            {showFlatAmounts && (
              <>
                <Text style={formStyles.label}>Flat-wise Amounts (₹) *</Text>
                {(form.targeting_mode === 'targeted' && category === 'special'
                  ? form.flat_amounts.filter(fa => form.targeted_user_ids.includes(fa.user_id))
                  : form.flat_amounts
                ).map(fa => (
                  <View key={fa.user_id} style={formStyles.flatAmountRow}>
                    <Text style={formStyles.flatLabel}>
                      {fa.flat_no} — {fa.name}
                    </Text>
                    <TextInput
                      style={formStyles.flatInput}
                      placeholder="₹"
                      value={fa.amount}
                      onChangeText={v => updateFlatAmount(fa.user_id, v)}
                      keyboardType="numeric"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity
              style={[formStyles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={formStyles.submitBtnText}>Create Bill</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '92%',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg,
  },
  row: { flexDirection: 'row' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center',
  },
  toggleBtnActive: { borderColor: Colors.primary, backgroundColor: '#EEF2FF' },
  toggleText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  toggleTextActive: { color: Colors.primary },
  flatPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  flatPickerText: { fontSize: 14, color: Colors.text },
  flatAmountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  flatLabel: { fontSize: 13, color: Colors.text, flex: 1 },
  flatInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, fontSize: 14, color: Colors.text, width: 90, textAlign: 'right',
  },
  submitBtn: {
    marginTop: 24, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  calendarBox: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 10, marginTop: 4 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayLabel: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSelected: { backgroundColor: Colors.primary, borderRadius: 20 },
  calCellText: { fontSize: 13, color: Colors.text },
});

// ─── Export Bottom Sheet ──────────────────────────────────────────────────────

interface ExportSheetProps {
  visible: boolean;
  billId: string;
  token: string | null;
  onClose: () => void;
}

function ExportSheet({ visible, billId, token, onClose }: ExportSheetProps) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const exportPDF = async () => {
    setExporting('pdf');
    try {
      const url = `${API_BASE}/maintenance/report/${billId}?format=pdf&token=${token}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open PDF report.');
    } finally {
      setExporting(null);
      onClose();
    }
  };

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const url = `${API_BASE}/maintenance/report/${billId}?format=excel&token=${token}`;
      const fileUri = FileSystem.cacheDirectory + `report_${billId}.xlsx`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share Excel Report',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch {
      Alert.alert('Error', 'Could not download Excel report.');
    } finally {
      setExporting(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={exportStyles.overlay}>
        <View style={exportStyles.sheet}>
          <View style={exportStyles.handle} />
          <Text style={exportStyles.title}>Export Report</Text>

          <TouchableOpacity
            style={exportStyles.option}
            onPress={exportPDF}
            disabled={exporting !== null}
          >
            <View style={[exportStyles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="document-text-outline" size={24} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={exportStyles.optionTitle}>PDF Report</Text>
              <Text style={exportStyles.optionSub}>Opens in browser / PDF viewer</Text>
            </View>
            {exporting === 'pdf'
              ? <ActivityIndicator color={Colors.primary} />
              : <Ionicons name="chevron-forward" size={18} color={Colors.border} />
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={exportStyles.option}
            onPress={exportExcel}
            disabled={exporting !== null}
          >
            <View style={[exportStyles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="grid-outline" size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={exportStyles.optionTitle}>Excel Report</Text>
              <Text style={exportStyles.optionSub}>Download .xlsx and share</Text>
            </View>
            {exporting === 'excel'
              ? <ActivityIndicator color={Colors.primary} />
              : <Ionicons name="chevron-forward" size={18} color={Colors.border} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={exportStyles.cancelBtn} onPress={onClose}>
            <Text style={exportStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const exportStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  optionSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
});

// ─── Pramukh: Flat-wise Payment Status Row ────────────────────────────────────

interface FlatRowProps {
  record: PaymentRecord & { user?: { name: string; flat_no: string; wing?: string } };
  onPress: () => void;
}

function FlatRow({ record, onPress }: FlatRowProps) {
  const paid = record.status === 'paid';
  const name = record.user?.name ?? '—';
  const flatNo = record.user?.flat_no ?? '—';
  const wing = record.user?.wing;

  return (
    <TouchableOpacity style={flatRowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[flatRowStyles.indicator, { backgroundColor: paid ? Colors.success : Colors.danger }]} />
      <View style={{ flex: 1 }}>
        <Text style={flatRowStyles.flatNo}>{wing ? `${wing}-` : ''}{flatNo}</Text>
        <Text style={flatRowStyles.name}>{name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={flatRowStyles.amount}>{formatAmount(record.flat_amount ?? record.amount)}</Text>
        {paid && record.paid_at && (
          <Text style={flatRowStyles.paidDate}>{formatDate(record.paid_at)}</Text>
        )}
        {!paid && (
          <Text style={[flatRowStyles.paidDate, { color: Colors.danger }]}>Pending</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

const flatRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  indicator: { width: 10, height: 10, borderRadius: 5 },
  flatNo: { fontSize: 14, fontWeight: '700', color: Colors.text },
  name: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  paidDate: { fontSize: 11, color: Colors.success, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MaintenanceCategoryScreen() {
  const { category, building_id, building_name } = useLocalSearchParams<{ category: BillingCategory; building_id?: string; building_name?: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();

  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh' || isAdmin;

  // For admin: use the passed building_id; for pramukh/user: use their own building
  const effectiveBuildingId = isAdmin && building_id && building_id !== 'undefined' ? building_id : undefined;

  // ── User view state ──
  const [userPayments, setUserPayments] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // ── Pramukh view state ──
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billPayments, setBillPayments] = useState<PaymentRecord[]>([]);
  const [myPramukhPayments, setMyPramukhPayments] = useState<PaymentRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportBillId, setExportBillId] = useState<string>('');
  const [flatDetailRecord, setFlatDetailRecord] = useState<PaymentRecord | null>(null);
  const [flatDetailVisible, setFlatDetailVisible] = useState(false);
  const [pramukhTab, setPramukhTab] = useState<'bills' | 'my-bill'>('bills');
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [editForm, setEditForm] = useState({ description: '', due_date: '', amount: '', penalty_amount: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editDatePickerVisible, setEditDatePickerVisible] = useState(false);
  const [editDpYear, setEditDpYear] = useState(new Date().getFullYear());
  const [editDpMonth, setEditDpMonth] = useState(new Date().getMonth() + 1);

  // ── Shared state ──
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const cat = (category as BillingCategory) || 'maintenance';

  // ── Data fetching ──

  const fetchUserData = async () => {
    try {
      const params: any = { category: cat, mine: 'true' };
      if (effectiveBuildingId) params.building_id = effectiveBuildingId;
      const res = await api.get('/maintenance/payments', { params });
      setUserPayments(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchPramukhData = async () => {
    try {
      const billParams: any = { category: cat };
      const payParams: any = { category: cat, mine: 'true' };
      if (effectiveBuildingId) {
        billParams.building_id = effectiveBuildingId;
        payParams.building_id = effectiveBuildingId;
      }

      const membersUrl = effectiveBuildingId
        ? `/buildings/members/${effectiveBuildingId}`
        : '/buildings/members';

      const [billsRes, membersRes, myPaymentsRes] = await Promise.all([
        api.get('/maintenance/bills', { params: billParams }),
        api.get(membersUrl),
        api.get('/maintenance/payments', { params: payParams }),
      ]);
      setBills(billsRes.data);
      setMembers(membersRes.data);
      setMyPramukhPayments(myPaymentsRes.data);
      if (selectedBill) {
        const allParams: any = { category: cat };
        if (effectiveBuildingId) allParams.building_id = effectiveBuildingId;
        const paymentsRes = await api.get('/maintenance/payments', { params: allParams });
        setBillPayments(paymentsRes.data.filter((p: PaymentRecord) => p.bill_id === selectedBill.id));
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchBillPayments = async (bill: Bill) => {
    try {
      const params: any = { category: cat };
      if (effectiveBuildingId) params.building_id = effectiveBuildingId;
      const res = await api.get('/maintenance/payments', { params });
      setBillPayments(res.data.filter((p: PaymentRecord) => p.bill_id === bill.id));
    } catch {}
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    if (isPramukh) {
      fetchPramukhData();
    } else {
      fetchUserData();
    }
  }, [cat, isPramukh]));

  // Deep-link listener for payment completion
  React.useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('mybuilding://payment')) {
        if (isPramukh) fetchPramukhData();
        else fetchUserData();
      }
    });
    return () => sub.remove();
  }, [cat, isPramukh]);

  // ── Payment flow ──

  const handlePay = async (record: PaymentRecord) => {
    setPaying(record.id);
    try {
      const res = await api.post('/maintenance/pay/order', { payment_record_id: record.id });
      const { checkout_url } = res.data;
      if (checkout_url) {
        await WebBrowser.openBrowserAsync(checkout_url);
        // Refresh after returning from browser
        if (isPramukh) fetchPramukhData();
        else await fetchUserData();
      }
    } catch (e: any) {
      Alert.alert('Payment Error', e?.response?.data?.error || 'Could not initiate payment.');
    } finally {
      setPaying(null);
    }
  };

  const handleReceipt = async (record: PaymentRecord) => {
    try {
      const url = `${API_BASE}/maintenance/receipt/${record.id}?token=${token}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open receipt.');
    }
  };

  // ── Bill creation ──

  const handleCreateBill = async (form: BillFormState) => {
    try {
      let body: any = {
        category: cat,
        due_date: form.due_date,
        description: form.description,
      };
      if (effectiveBuildingId) body.building_id = effectiveBuildingId;

      if (cat === 'maintenance') {
        body.amount = parseFloat(form.amount);
        body.month = parseInt(form.month, 10);
        body.year = parseInt(form.year, 10);
        if (form.penalty_amount) body.penalty_amount = parseFloat(form.penalty_amount);
      } else if (cat === 'water_meter') {
        body.amount_mode = form.amount_mode;
        body.targeting_mode = 'building_wide';
        if (form.amount_mode === 'uniform') {
          body.amount = parseFloat(form.amount);
        } else {
          body.flat_amounts = form.flat_amounts
            .filter(fa => fa.amount.trim() !== '')
            .map(fa => ({ user_id: fa.user_id, amount: parseFloat(fa.amount) }));
        }
      } else if (cat === 'special') {
        body.amount_mode = form.amount_mode;
        body.targeting_mode = form.targeting_mode;
        if (form.amount_mode === 'uniform') {
          body.amount = parseFloat(form.amount);
        } else {
          const relevantFlats = form.targeting_mode === 'targeted'
            ? form.flat_amounts.filter(fa => form.targeted_user_ids.includes(fa.user_id))
            : form.flat_amounts;
          body.flat_amounts = relevantFlats
            .filter(fa => fa.amount.trim() !== '')
            .map(fa => ({ user_id: fa.user_id, amount: parseFloat(fa.amount) }));
        }
        if (form.targeting_mode === 'targeted') {
          body.targeted_user_ids = form.targeted_user_ids;
        }
      }

      await api.post('/maintenance/bills', body);
      setCreateVisible(false);
      Alert.alert('Success', 'Bill created successfully.');
      fetchPramukhData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not create bill.');
    }
  };

  const openEditBill = (bill: Bill) => {
    setEditForm({
      description: bill.description || '',
      due_date: bill.due_date || '',
      amount: bill.amount ? String(bill.amount) : '',
      penalty_amount: bill.penalty_amount ? String(bill.penalty_amount) : '',
    });
    const due = bill.due_date ? new Date(bill.due_date) : new Date();
    setEditDpYear(due.getFullYear());
    setEditDpMonth(due.getMonth() + 1);
    setEditBill(bill);
  };

  const handleEditBill = async () => {
    if (!editBill) return;
    setEditSubmitting(true);
    try {
      const body: any = { bill_id: editBill.id };
      if (editForm.description !== editBill.description) body.description = editForm.description;
      if (editForm.due_date !== editBill.due_date) body.due_date = editForm.due_date;
      if (editForm.amount && parseFloat(editForm.amount) !== editBill.amount) body.amount = parseFloat(editForm.amount);
      if (cat === 'maintenance' && editForm.penalty_amount !== undefined)
        body.penalty_amount = parseFloat(editForm.penalty_amount) || 0;
      await api.patch('/maintenance/bills', body);
      setEditBill(null);
      Alert.alert('Updated', 'Bill updated successfully.');
      fetchPramukhData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not update bill.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Derived data ──

  const pendingPayments = userPayments.filter(p => p.status === 'pending');
  const paidPayments = userPayments.filter(p => p.status === 'paid');
  const displayedPayments = activeTab === 'pending' ? pendingPayments : paidPayments;

  const paidCount = billPayments.filter(p => p.status === 'paid').length;
  const pendingCount = billPayments.filter(p => p.status === 'pending').length;
  const overdueCount = billPayments.filter(p => {
    const due = p.maintenance_bills?.due_date;
    return p.status === 'pending' && due && new Date(due) < new Date();
  }).length;

  // Pramukh's own bills
  const myPendingBills = myPramukhPayments.filter(p => p.status === 'pending');
  const myPaidBills = myPramukhPayments.filter(p => p.status === 'paid');
  const myDisplayedBills = pramukhTab === 'my-bill'
    ? (activeTab === 'pending' ? myPendingBills : myPaidBills)
    : [];

  // ── Header title ──
  const headerTitle = CATEGORY_LABELS[cat] || 'Bills';

  // ── Render ──

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (selectedBill && isPramukh) {
            setSelectedBill(null);
            setBillPayments([]);
          } else {
            router.back();
          }
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>
            {isPramukh
              ? selectedBill ? selectedBill.description : (isAdmin && building_name ? building_name : 'Manage bills')
              : 'Your bills'
            }
          </Text>
        </View>
        {isPramukh && !selectedBill && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateVisible(true)}>
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        )}
        {isPramukh && selectedBill && (
          <TouchableOpacity style={styles.createBtn} onPress={() => {
            setExportBillId(selectedBill.id);
            setExportVisible(true);
          }}>
            <Ionicons name="share-outline" size={18} color={Colors.white} />
            <Text style={styles.createBtnText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : isPramukh ? (
        // ── Pramukh View ──
        <>
          {/* Pramukh top tabs: Bills | My Bill */}
          {!selectedBill && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, pramukhTab === 'bills' && styles.tabActive]}
                onPress={() => setPramukhTab('bills')}
              >
                <Text style={[styles.tabText, pramukhTab === 'bills' && styles.tabTextActive]}>All Bills</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, pramukhTab === 'my-bill' && styles.tabActive]}
                onPress={() => setPramukhTab('my-bill')}
              >
                <Text style={[styles.tabText, pramukhTab === 'my-bill' && styles.tabTextActive]}>
                  My Bill {myPendingBills.length > 0 ? `(${myPendingBills.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {pramukhTab === 'my-bill' && !selectedBill ? (
            // Pramukh's own bills — same as user view
            <View style={{ flex: 1 }}>
              <View style={styles.tabBar}>
                {(['pending', 'paid'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab === 'pending' ? `Pending (${myPendingBills.length})` : `Paid (${myPaidBills.length})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPramukhData(); }} />}
              >
                {(activeTab === 'pending' ? myPendingBills : myPaidBills).length === 0 ? (
                  <Text style={styles.emptyText}>{activeTab === 'pending' ? 'No pending bills.' : 'No paid bills yet.'}</Text>
                ) : (
                  (activeTab === 'pending' ? myPendingBills : myPaidBills).map(record => (
                    <BillCard key={record.id} record={record} category={cat}
                      onPay={paying ? () => {} : handlePay} onReceipt={handleReceipt} />
                  ))
                )}
              </ScrollView>
            </View>
          ) : selectedBill ? (
            // Flat-wise payment status — block grid
            <View style={{ flex: 1 }}>
              {/* Summary bar */}
              <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.summaryText}>{paidCount} Paid</Text>
                </View>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.summaryText}>{pendingCount - overdueCount} Pending</Text>
                </View>
                {overdueCount > 0 && (
                  <View style={styles.summaryItem}>
                    <View style={[styles.summaryDot, { backgroundColor: Colors.danger }]} />
                    <Text style={styles.summaryText}>{overdueCount} Overdue</Text>
                  </View>
                )}
                <Text style={styles.summaryTotal}>{billPayments.length} Total</Text>
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.success }]} /><Text style={styles.legendText}>Paid</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Pending</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.danger }]} /><Text style={styles.legendText}>Overdue</Text></View>
              </View>

              <ScrollView
                contentContainerStyle={styles.flatGrid}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBillPayments(selectedBill); setRefreshing(false); }} />}
              >
                {billPayments.map(item => {
                  const p = item as any;
                  const paid = p.status === 'paid';
                  const due = p.maintenance_bills?.due_date;
                  const overdue = !paid && due && new Date(due) < new Date();
                  const bgColor = paid ? Colors.success : overdue ? Colors.danger : '#F59E0B';
                  const flatNo = p.users?.flat_no ?? p.user?.flat_no ?? '—';
                  const wing = p.users?.wing ?? p.user?.wing;
                  const name = p.users?.name ?? p.user?.name ?? '—';
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.flatBlock, { backgroundColor: bgColor }]}
                      onPress={() => { setFlatDetailRecord(p); setFlatDetailVisible(true); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.flatBlockNo}>{wing ? `${wing}-` : ''}{flatNo}</Text>
                      <Text style={styles.flatBlockName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.flatBlockAmt}>{formatAmount(p.flat_amount ?? p.amount)}</Text>
                      {paid && <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }} />}
                      {overdue && <Text style={styles.flatBlockOverdue}>Overdue</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            // Bill list
            <FlatList
              data={bills}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPramukhData(); }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.billListCard}
                  onPress={() => { setSelectedBill(item); fetchBillPayments(item); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billListDesc}>{item.description}</Text>
                    <Text style={styles.billListMeta}>
                      Due: {formatDate(item.due_date)}
                      {item.month && item.year ? `  •  ${MONTHS[item.month - 1]} ${item.year}` : ''}
                    </Text>
                    {item.is_edited && item.editor?.name && (
                      <Text style={styles.editedByText}>✏️ Edited by {item.editor.name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.billListAmount}>{formatAmount(item.amount)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEditBill(item)}
                      >
                        <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      {isAdmin && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => {
                            Alert.alert(
                              'Delete Bill',
                              `Delete "${item.description || 'this bill'}"? All payment records will also be removed.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: async () => {
                                  try {
                                    await api.delete(`/maintenance/bills/${item.id}`);
                                    fetchPramukhData();
                                  } catch (e: any) {
                                    Alert.alert('Error', e?.response?.data?.error || 'Could not delete bill.');
                                  }
                                }},
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.border} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No bills yet. Tap "Create" to add one.</Text>}
            />
          )}
        </>
      ) : (
        // ── User View ──
        <View style={{ flex: 1 }}>
          {/* Sub-tabs */}
          <View style={styles.tabBar}>
            {(['pending', 'paid'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'pending' ? `Pending (${pendingPayments.length})` : `Paid (${paidPayments.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {
                setRefreshing(true);
                fetchUserData();
              }} />
            }
          >
            {displayedPayments.length === 0 ? (
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? 'No pending bills.' : 'No paid bills yet.'}
              </Text>
            ) : (
              displayedPayments.map(record => (
                <BillCard
                  key={record.id}
                  record={record}
                  category={cat}
                  onPay={paying ? () => {} : handlePay}
                  onReceipt={handleReceipt}
                />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Modals */}
      <BillFormModal
        visible={createVisible}
        category={cat}
        members={members}
        onClose={() => setCreateVisible(false)}
        onSubmit={handleCreateBill}
      />

      <ExportSheet
        visible={exportVisible}
        billId={exportBillId}
        token={token}
        onClose={() => setExportVisible(false)}
      />

      <PaymentDetailModal
        record={selectedRecord || flatDetailRecord}
        visible={detailVisible || flatDetailVisible}
        onClose={() => {
          setDetailVisible(false);
          setFlatDetailVisible(false);
          setSelectedRecord(null);
          setFlatDetailRecord(null);
        }}
      />

      {/* Edit Bill Modal */}
      <Modal visible={!!editBill} transparent animationType="slide" onRequestClose={() => setEditBill(null)}>
        <View style={detailStyles.overlay}>
          <View style={detailStyles.sheet}>
            <View style={detailStyles.handle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={detailStyles.title}>Edit Bill</Text>
              <TouchableOpacity onPress={() => setEditBill(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={formStyles.label}>Description</Text>
              <TextInput
                style={formStyles.input}
                value={editForm.description}
                onChangeText={v => setEditForm(f => ({ ...f, description: v }))}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={formStyles.label}>Due Date</Text>
              <TouchableOpacity style={formStyles.input} onPress={() => setEditDatePickerVisible(v => !v)}>
                <Text style={{ color: editForm.due_date ? Colors.text : Colors.textMuted, fontSize: 15 }}>
                  {editForm.due_date ? formatDate(editForm.due_date) : 'Select due date...'}
                </Text>
              </TouchableOpacity>
              {editDatePickerVisible && (
                <View style={formStyles.calendarBox}>
                  <View style={formStyles.calHeader}>
                    <TouchableOpacity onPress={() => {
                      if (editDpMonth === 1) { setEditDpMonth(12); setEditDpYear(y => y - 1); }
                      else setEditDpMonth(m => m - 1);
                    }}>
                      <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={formStyles.calMonthLabel}>{MONTHS[editDpMonth - 1]} {editDpYear}</Text>
                    <TouchableOpacity onPress={() => {
                      if (editDpMonth === 12) { setEditDpMonth(1); setEditDpYear(y => y + 1); }
                      else setEditDpMonth(m => m + 1);
                    }}>
                      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={formStyles.calGrid}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <Text key={d} style={formStyles.calDayLabel}>{d}</Text>
                    ))}
                    {(() => {
                      const firstDay = new Date(editDpYear, editDpMonth - 1, 1).getDay();
                      const daysInMonth = new Date(editDpYear, editDpMonth, 0).getDate();
                      const cells: (number | null)[] = Array(firstDay).fill(null);
                      for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                      while (cells.length % 7 !== 0) cells.push(null);
                      return cells.map((day, i) => {
                        if (!day) return <View key={i} style={formStyles.calCell} />;
                        const dateStr = `${editDpYear}-${String(editDpMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const selected = editForm.due_date === dateStr;
                        return (
                          <TouchableOpacity key={i} style={[formStyles.calCell, selected && formStyles.calCellSelected]}
                            onPress={() => { setEditForm(f => ({ ...f, due_date: dateStr })); setEditDatePickerVisible(false); }}>
                            <Text style={[formStyles.calCellText, selected && { color: Colors.white, fontWeight: '800' }]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>
                </View>
              )}

              {editBill?.amount_mode !== 'flat_wise' && (
                <>
                  <Text style={formStyles.label}>Amount (₹)</Text>
                  <TextInput
                    style={formStyles.input}
                    value={editForm.amount}
                    onChangeText={v => setEditForm(f => ({ ...f, amount: v }))}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              {cat === 'maintenance' && (
                <>
                  <Text style={formStyles.label}>Penalty Amount (₹)</Text>
                  <TextInput
                    style={formStyles.input}
                    value={editForm.penalty_amount}
                    onChangeText={v => setEditForm(f => ({ ...f, penalty_amount: v }))}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              <TouchableOpacity
                style={[formStyles.submitBtn, editSubmitting && { opacity: 0.6 }]}
                onPress={handleEditBill}
                disabled={editSubmitting}
              >
                {editSubmitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={formStyles.submitBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 2,
  },
  createBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  summaryText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  summaryTotal: { marginLeft: 'auto', fontSize: 13, color: Colors.textMuted },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 15 },
  legendRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  flatGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  flatBlock: {
    width: '30%', borderRadius: 12, padding: 10, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  flatBlockNo: { fontSize: 16, fontWeight: '800', color: Colors.white },
  flatBlockName: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  flatBlockAmt: { fontSize: 12, fontWeight: '700', color: Colors.white, marginTop: 4 },
  flatBlockOverdue: { fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  billListCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  billListDesc: { fontSize: 15, fontWeight: '700', color: Colors.text },
  billListMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  billListAmount: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  editedByText: { fontSize: 11, color: Colors.textMuted, marginTop: 3, fontStyle: 'italic' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: Colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: Colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deleteBtnText: { fontSize: 12, color: Colors.danger, fontWeight: '600' },
});
