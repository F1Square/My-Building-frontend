import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, ScrollView, ToastAndroid,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { entryMatchesMonthYear, formatExpenseDate, localDateString, parseExpenseDateParts } from '../utils/expenseDate';
import { ExpenseDatePicker } from '../components/ExpenseDatePicker';
import { ModuleHeader, ModuleHeaderIconButton } from '../components/ModuleHeader';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

type Entry = {
  id: string; type: 'inflow' | 'outflow'; amount: number;
  description: string; category: string | null; date: string;
  created_at?: string;
  is_edited: boolean; edited_at: string | null;
  added_by_user?: { name: string; role: string } | null;
  edited_by_user?: { name: string } | null;
};

const INFLOW_COLOR  = '#16A34A';
const OUTFLOW_COLOR = '#EF4444';
const CATEGORIES = ['Maintenance', 'Salary', 'Repair', 'Cleaning', 'Security', 'Utilities', 'Event', 'Other'];

export default function ExpensesDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { wing, building_id, building_name } = useLocalSearchParams<{ 
    wing?: string; 
    building_id?: string;
    building_name?: string;
  }>();

  const isAdmin   = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canManage = isPramukh || isAdmin;

  // Admin uses building_id from params, pramukh/user use their own
  const buildingId = isAdmin ? building_id : user?.building_id;
  const wingName = wing || 'Building-Wide';

  const [summary, setSummary]   = useState<any>(null);
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showSetBalance, setShowSetBalance] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [showEdit, setShowEdit] = useState<Entry | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs]         = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState<Entry | null>(null);

  // Forms
  const [balanceInput, setBalanceInput] = useState('');
  const [form, setForm] = useState({
    type: 'outflow' as 'inflow' | 'outflow',
    amount: '',
    description: '',
    category: '',
    date: localDateString()
  });
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const CURRENT_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

  const fetchData = async () => {
    if (!buildingId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    setFetchError(false);
    try {
      const [sumRes, entRes] = await Promise.all([
        api.get('/expenses/summary', { params: { building_id: buildingId, wing: wingName } }),
        api.get('/expenses/entries', { params: { building_id: buildingId, wing: wingName } }),
      ]);
      setSummary(sumRes.data);
      setEntries(entRes.data);
      // First-time pramukh: no opening balance set
      if (isPramukh && (sumRes.data?.opening_balance === null || sumRes.data?.opening_balance === undefined)) {
        setShowSetBalance(true);
      }
    } catch (e: any) {
      setFetchError(true);
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [buildingId, wingName]));

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== 'all') result = result.filter(e => e.type === typeFilter);
    result = result.filter(e =>
      entryMatchesMonthYear(e.date, e.created_at, selectedMonth, selectedYear),
    );
    return result;
  }, [entries, typeFilter, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    const inflow  = filtered.filter(e => e.type === 'inflow').reduce((s, e) => s + Number(e.amount), 0);
    const outflow = filtered.filter(e => e.type === 'outflow').reduce((s, e) => s + Number(e.amount), 0);
    return { inflow, outflow };
  }, [filtered]);

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const saveBalance = async () => {
    const val = parseFloat(balanceInput);
    if (isNaN(val) || val < 0) {
      ToastAndroid.show('Enter a valid amount', ToastAndroid.SHORT);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/expenses/opening-balance', {
        amount: val,
        building_id: buildingId,
        wing: wingName,
      });
      setSummary((prev: any) => ({ ...prev, opening_balance: val, current_balance: res.data.current_balance }));
      setShowSetBalance(false);
      setBalanceInput('');
      ToastAndroid.show('Balance saved', ToastAndroid.SHORT);
    } catch (e: any) {
      ToastAndroid.show(e.response?.data?.error || 'Failed to save balance', ToastAndroid.LONG);
    } finally { setSubmitting(false); }
  };

  const addEntry = async () => {
    if (!form.amount || !form.description.trim()) {
      ToastAndroid.show('Amount and description are required', ToastAndroid.SHORT);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/expenses/entries', {
        ...form,
        amount: parseFloat(form.amount),
        building_id: buildingId,
        wing: wingName,
      });
      const added = res.data?.entry;
      if (added) {
        setEntries(prev => [added, ...prev.filter(e => e.id !== added.id)]);
      } else {
        await fetchData();
      }
      const parts = parseExpenseDateParts(form.date, localDateString());
      if (parts) {
        setSelectedMonth(parts.month);
        setSelectedYear(parts.year);
      }
      setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
      setShowAdd(false);
      setForm({ type: 'outflow', amount: '', description: '', category: '', date: localDateString() });
      ToastAndroid.show('Entry added', ToastAndroid.SHORT);
    } catch (e: any) {
      ToastAndroid.show(e.response?.data?.error || 'Failed to add entry', ToastAndroid.LONG);
    } finally { setSubmitting(false); }
  };

  const saveEdit = async () => {
    if (!showEdit) return;
    if (!form.amount || !form.description.trim()) {
      ToastAndroid.show('Amount and description are required', ToastAndroid.SHORT);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.patch(`/expenses/entries/${showEdit.id}`, {
        ...form,
        building_id: buildingId,
        wing: wingName,
      });
      setEntries(prev => prev.map(e => e.id === showEdit.id ? res.data.entry : e));
      setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
      setShowEdit(null);
      ToastAndroid.show('Entry updated', ToastAndroid.SHORT);
    } catch (e: any) {
      ToastAndroid.show(e.response?.data?.error || 'Failed to update entry', ToastAndroid.LONG);
    } finally { setSubmitting(false); }
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete', 'Delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await api.delete(`/expenses/entries/${id}`);
          setEntries(prev => prev.filter(e => e.id !== id));
          setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
          ToastAndroid.show('Entry deleted', ToastAndroid.SHORT);
        } catch (e: any) { 
          ToastAndroid.show(e.response?.data?.error || 'Failed to delete', ToastAndroid.LONG); 
        }
      }},
    ]);
  };

  const openLogs = async () => {
    try {
      const res = await api.get('/expenses/logs', { params: { building_id: buildingId, wing: wingName } });
      setLogs(res.data);
      setShowLogs(true);
    } catch (e: any) { 
      ToastAndroid.show(e.response?.data?.error || 'Failed to load logs', ToastAndroid.LONG); 
    }
  };

  const openEdit = (item: Entry) => {
    setForm({ type: item.type, amount: String(item.amount), description: item.description, category: item.category || '', date: item.date });
    setShowEdit(item);
  };

  const renderEntry = ({ item }: { item: Entry }) => {
    const isIn = item.type === 'inflow';
    const color = isIn ? INFLOW_COLOR : OUTFLOW_COLOR;
    return (
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => setShowDetail(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.entryIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'} size={26} color={color} />
        </View>
        <View style={styles.entryInfo}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryDesc} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.entryAmount, { color }]}>{isIn ? '+' : '-'}{fmt(item.amount)}</Text>
          </View>
          <View style={styles.entryMeta}>
            {item.category ? <View style={styles.catTag}><Text style={styles.catTagText}>{item.category}</Text></View> : null}
            <Text style={styles.entryDate}>{formatExpenseDate(item.date, item.created_at)}</Text>
            {item.is_edited && !isAdmin ? (
              <View style={styles.editedTag}>
                <Ionicons name="pencil" size={10} color="#7C3AED" />
                <Text style={styles.editedTagText}>Edited</Text>
              </View>
            ) : null}
          </View>
          {item.added_by_user && <Text style={styles.entryBy}>By {item.added_by_user.name}</Text>}
        </View>
        {canManage && (
          <View style={styles.entryActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); openEdit(item); }} style={styles.actionBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); deleteEntry(item.id); }} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ModuleHeader
        title={t('expenses')}
        subtitle={isAdmin && building_name ? `${building_name} • ${wingName}` : wingName}
        rightAction={canManage ? <ModuleHeaderIconButton icon="add" onPress={() => setShowAdd(true)} /> : undefined}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : fetchError ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>Could not load expenses</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Balance card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceMain}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceAmount}>{fmt(summary?.current_balance || 0)}</Text>
              {summary?.opening_balance !== null && summary?.opening_balance !== undefined && (
                <Text style={styles.openingLabel}>Opening: {fmt(summary.opening_balance)}</Text>
              )}
            </View>
            <View style={styles.balanceSplit}>
              <View style={styles.balanceSplitItem}>
                <Ionicons name="arrow-down-circle" size={18} color={INFLOW_COLOR} />
                <View>
                  <Text style={styles.splitLabel}>Inflow</Text>
                  <Text style={[styles.splitAmount, { color: INFLOW_COLOR }]}>{fmt(totals.inflow)}</Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceSplitItem}>
                <Ionicons name="arrow-up-circle" size={18} color={OUTFLOW_COLOR} />
                <View>
                  <Text style={styles.splitLabel}>Outflow</Text>
                  <Text style={[styles.splitAmount, { color: OUTFLOW_COLOR }]}>{fmt(totals.outflow)}</Text>
                </View>
              </View>
            </View>
            {canManage && (
              <TouchableOpacity style={styles.setBalanceBtn} onPress={() => { setBalanceInput(String(summary?.opening_balance || '')); setShowSetBalance(true); }}>
                <Ionicons name="settings-outline" size={14} color={Colors.primary} />
                <Text style={styles.setBalanceBtnText}>
                  {summary?.opening_balance !== null ? 'Update Balance' : 'Set Balance'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter chips */}
          <View style={{ marginBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {(['all', 'inflow', 'outflow'] as const).map(t => (
                <TouchableOpacity key={t}
                  style={[styles.chip, typeFilter === t && styles.chipActive]}
                  onPress={() => setTypeFilter(t)}
                >
                  <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>
                    {t === 'all' ? 'All' : t === 'inflow' ? '↓ In' : '↑ Out'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Month/Year Selectors */}
          <View style={styles.selectorContainer}>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowMonthPicker(true)}>
              <View>
                <Text style={styles.selectorLabel}>Month</Text>
                <Text style={styles.selectorValue}>{MONTHS[selectedMonth].slice(0, 3)}</Text>
              </View>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowYearPicker(true)}>
              <View>
                <Text style={styles.selectorLabel}>Year</Text>
                <Text style={styles.selectorValue}>{selectedYear}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyText}>No entries</Text>
                {canManage && <Text style={styles.emptyHint}>Tap + to add an entry</Text>}
              </View>
            }
          />
        </>
      )}

      {/* ── Entry Detail Modal ── */}
      <Modal visible={!!showDetail} animationType="slide" presentationStyle="pageSheet">
        {showDetail && (() => {
          const isIn = showDetail.type === 'inflow';
          const color = isIn ? INFLOW_COLOR : OUTFLOW_COLOR;
          return (
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View style={[styles.detailTypeBadge, { backgroundColor: color + '18' }]}>
                  <Ionicons name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'} size={16} color={color} />
                  <Text style={[styles.detailTypeText, { color }]}>{isIn ? 'Inflow' : 'Outflow'}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDetail(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.detailAmountBox}>
                <Text style={[styles.detailAmount, { color }]}>
                  {isIn ? '+' : '-'}{fmt(showDetail.amount)}
                </Text>
              </View>
              <View style={styles.detailRows}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>Description</Text>
                    <Text style={styles.detailRowValue}>{showDetail.description}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>Date</Text>
                    <Text style={styles.detailRowValue}>
                      {formatExpenseDate(showDetail.date, showDetail.created_at)}
                    </Text>
                  </View>
                </View>
                {showDetail.category && (
                  <View style={styles.detailRow}>
                    <Ionicons name="pricetag-outline" size={16} color={Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRowLabel}>Category</Text>
                      <Text style={styles.detailRowValue}>{showDetail.category}</Text>
                    </View>
                  </View>
                )}
                {showDetail.added_by_user && (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRowLabel}>Added By</Text>
                      <Text style={styles.detailRowValue}>{showDetail.added_by_user.name}</Text>
                    </View>
                  </View>
                )}
              </View>
              {canManage && (
                <View style={styles.detailActions}>
                  <TouchableOpacity style={styles.detailEditBtn} onPress={() => { setShowDetail(null); openEdit(showDetail); }}>
                    <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                    <Text style={styles.detailEditBtnText}>Edit</Text>
                  </TouchableOpacity>
                  {isAdmin && (
                    <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => { setShowDetail(null); deleteEntry(showDetail.id); }}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={styles.detailDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })()}
      </Modal>

      {/* ── Set Balance Modal ── */}
      <Modal visible={showSetBalance} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {summary?.opening_balance !== null ? 'Update Balance' : 'Set Balance'}
            </Text>
            <TouchableOpacity onPress={() => setShowSetBalance(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>Enter the current balance for this wing</Text>
          <Text style={styles.label}>Balance (₹) *</Text>
          <TextInput style={styles.input} value={balanceInput} onChangeText={setBalanceInput}
            placeholder="e.g. 50000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} autoFocus />
          <TouchableOpacity style={styles.submitBtn} onPress={saveBalance} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Add/Edit Modal ── */}
      <Modal visible={showAdd || !!showEdit} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showEdit ? 'Edit Entry' : 'New Entry'}</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setShowEdit(null); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.modalContent}>
            <Text style={styles.label}>Type *</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'inflow' && { backgroundColor: INFLOW_COLOR, borderColor: INFLOW_COLOR }]}
                onPress={() => setForm({ ...form, type: 'inflow' })}
              >
                <Ionicons name="arrow-down-circle" size={18} color={form.type === 'inflow' ? Colors.white : INFLOW_COLOR} />
                <Text style={[styles.typeBtnText, form.type === 'inflow' && { color: Colors.white }]}>Inflow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'outflow' && { backgroundColor: OUTFLOW_COLOR, borderColor: OUTFLOW_COLOR }]}
                onPress={() => setForm({ ...form, type: 'outflow' })}
              >
                <Ionicons name="arrow-up-circle" size={18} color={form.type === 'outflow' ? Colors.white : OUTFLOW_COLOR} />
                <Text style={[styles.typeBtnText, form.type === 'outflow' && { color: Colors.white }]}>Outflow</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={form.amount} onChangeText={v => setForm({ ...form, amount: v })}
              placeholder="e.g. 10000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Description *</Text>
            <TextInput style={styles.input} value={form.description} onChangeText={v => setForm({ ...form, description: v })}
              placeholder="e.g. Watchman salary" placeholderTextColor={Colors.textMuted} numberOfLines={2} />
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, form.category === cat && styles.catBtnActive]}
                  onPress={() => setForm({ ...form, category: form.category === cat ? '' : cat })}
                >
                  <Text style={[styles.catBtnText, form.category === cat && styles.catBtnTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ExpenseDatePicker
              value={form.date}
              onChange={date => setForm({ ...form, date })}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={showEdit ? saveEdit : addEntry} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{showEdit ? 'Update' : 'Add'} Entry</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Month picker */}
      <Modal visible={showMonthPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {MONTHS.map((label, idx) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.pickerRow, selectedMonth === idx && styles.pickerRowActive]}
                  onPress={() => { setSelectedMonth(idx); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.pickerRowText, selectedMonth === idx && styles.pickerRowTextActive]}>{label}</Text>
                  {selectedMonth === idx && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Year picker */}
      <Modal visible={showYearPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Year</Text>
              <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {YEARS.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerRow, selectedYear === y && styles.pickerRowActive]}
                  onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
                >
                  <Text style={[styles.pickerRowText, selectedYear === y && styles.pickerRowTextActive]}>{y}</Text>
                  {selectedYear === y && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  balanceCard: { backgroundColor: Colors.white, borderRadius: 16, margin: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  balanceMain: { marginBottom: 16 },
  balanceLabel: { fontSize: 12, color: Colors.textMuted },
  balanceAmount: { fontSize: 32, fontWeight: '800', color: Colors.text, marginVertical: 4 },
  openingLabel: { fontSize: 11, color: Colors.textMuted },
  balanceSplit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceSplitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  splitLabel: { fontSize: 11, color: Colors.textMuted },
  splitAmount: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  setBalanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.primary + '15', borderRadius: 8 },
  setBalanceBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.white },
  selectorContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  selectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  selectorLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  selectorValue: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 4 },
  list: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: Colors.textMuted },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  retryBtnText: { color: Colors.white, fontWeight: '700' },
  entryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  entryIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  entryInfo: { flex: 1 },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  entryDesc: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  entryAmount: { fontSize: 14, fontWeight: '800' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catTag: { backgroundColor: Colors.primary + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catTagText: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  entryDate: { fontSize: 11, color: Colors.textMuted },
  editedTag: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#7C3AED20', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  editedTagText: { fontSize: 9, color: '#7C3AED', fontWeight: '600' },
  entryBy: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  entryActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary + '08', justifyContent: 'center', alignItems: 'center' },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalContent: { padding: 16 },
  modalHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  catRow: { marginBottom: 12 },
  catBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  catBtnTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginVertical: 20 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  detailTypeText: { fontSize: 12, fontWeight: '700' },
  detailAmountBox: { padding: 24, alignItems: 'center', backgroundColor: Colors.bg + '50' },
  detailAmount: { fontSize: 40, fontWeight: '800' },
  detailRows: { padding: 16, gap: 12 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  detailRowValue: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 4 },
  detailActions: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12 },
  detailEditBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  detailDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.danger + '20', borderRadius: 10, paddingVertical: 12 },
  detailDeleteBtnText: { fontSize: 14, fontWeight: '700', color: Colors.danger },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  pickerRowActive: { backgroundColor: Colors.primary + '10' },
  pickerRowText: { fontSize: 16, color: Colors.text },
  pickerRowTextActive: { fontWeight: '800', color: Colors.primary },
});
