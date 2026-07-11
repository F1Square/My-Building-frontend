import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ToastAndroid, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { API_BASE } from '../constants/api';
import BottomSheetModal from './BottomSheetModal';
import { ExpenseDatePicker } from './ExpenseDatePicker';
import {
  expenseExportRange,
  formatExpenseDate,
  localDateString,
  type ExpenseExportPreset,
} from '../utils/expenseDate';

const PRESETS: { key: ExpenseExportPreset; label: string; sub: string }[] = [
  { key: 'this_month', label: 'This month', sub: 'From the 1st to today' },
  { key: 'last_6_months', label: 'Last 6 months', sub: 'Rolling six-month window' },
  { key: 'current_fy', label: 'Current financial year', sub: '1 Apr → today (India FY)' },
  { key: 'last_fy', label: 'Last financial year', sub: 'Previous Apr–Mar' },
];

type ActiveKey = ExpenseExportPreset | 'custom';

type Props = {
  visible: boolean;
  onClose: () => void;
  format: 'pdf' | 'excel';
  buildingId: string;
  wingName: string;
};

export default function ExpenseExportSheet({
  visible,
  onClose,
  format,
  buildingId,
  wingName,
}: Props) {
  const [activeKey, setActiveKey] = useState<ActiveKey | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [fromDate, setFromDate] = useState(localDateString());
  const [toDate, setToDate] = useState(localDateString());
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Compute once when sheet opens — avoid recalculating every row on re-render
  const ranges = useMemo(() => {
    const map = {} as Record<ExpenseExportPreset, ReturnType<typeof expenseExportRange>>;
    for (const p of PRESETS) map[p.key] = expenseExportRange(p.key);
    return map;
  }, [visible]);

  const resetAndClose = () => {
    setShowCustom(false);
    setRangeError(null);
    setActiveKey(null);
    onClose();
  };

  const download = async (key: ActiveKey, from: string, to: string) => {
    if (activeKey) return;
    if (from > to) {
      setRangeError('From date must be on or before To date');
      return;
    }
    setRangeError(null);
    setActiveKey(key);
    try {
      const token = await AsyncStorage.getItem('token');
      const qs = new URLSearchParams({
        format,
        building_id: buildingId,
        wing: wingName,
        from,
        to,
      });
      if (token) qs.set('token', token);

      // Same pattern as maintenance PDF — browser/system download, not share sheet
      await Linking.openURL(`${API_BASE}/expenses/export?${qs.toString()}`);
      ToastAndroid.show('Download started', ToastAndroid.SHORT);
      resetAndClose();
    } catch {
      ToastAndroid.show('Could not start download', ToastAndroid.LONG);
      setActiveKey(null);
    }
  };

  const busy = activeKey !== null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={resetAndClose}
      title={format === 'pdf' ? 'Download PDF' : 'Download Excel'}
      subtitle="Choose a period for this wing"
      snapPoints={showCustom ? ['78%'] : ['62%']}
    >
      {PRESETS.map((p) => {
        const range = ranges[p.key];
        const loading = activeKey === p.key;
        return (
          <TouchableOpacity
            key={p.key}
            style={[styles.option, busy && !loading && styles.optionDim]}
            onPress={() => download(p.key, range.from, range.to)}
            disabled={busy}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, format === 'pdf' ? styles.pdfBg : styles.excelBg]}>
              <Ionicons
                name={format === 'pdf' ? 'document-text-outline' : 'grid-outline'}
                size={20}
                color={format === 'pdf' ? '#DC2626' : '#16A34A'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{p.label}</Text>
              <Text style={styles.optionSub}>
                {formatExpenseDate(range.from)} – {formatExpenseDate(range.to)}
              </Text>
            </View>
            {loading
              ? <ActivityIndicator color={Colors.primary} />
              : <Ionicons name="download-outline" size={18} color={Colors.textMuted} />}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.option, busy && activeKey !== 'custom' && styles.optionDim]}
        onPress={() => { setShowCustom((v) => !v); setRangeError(null); }}
        disabled={busy}
        activeOpacity={0.75}
      >
        <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '18' }]}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Custom range</Text>
          <Text style={styles.optionSub}>From date → To date</Text>
        </View>
        <Ionicons
          name={showCustom ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {showCustom ? (
        <View style={styles.customBox}>
          <ExpenseDatePicker label="From date" value={fromDate} onChange={setFromDate} />
          <ExpenseDatePicker label="To date" value={toDate} onChange={setToDate} />
          {rangeError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{rangeError}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.downloadBtn, busy && { opacity: 0.6 }]}
            onPress={() => download('custom', fromDate, toDate)}
            disabled={busy}
          >
            {activeKey === 'custom'
              ? <ActivityIndicator color={Colors.white} />
              : (
                <>
                  <Ionicons name="download-outline" size={18} color={Colors.white} />
                  <Text style={styles.downloadBtnText}>
                    Download {format === 'pdf' ? 'PDF' : 'Excel'}
                  </Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionDim: { opacity: 0.45 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBg: { backgroundColor: '#FEE2E2' },
  excelBg: { backgroundColor: '#DCFCE7' },
  optionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  optionSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  customBox: { paddingTop: 4, paddingBottom: 8 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, color: Colors.danger, flex: 1, fontWeight: '500' },
  downloadBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
});
