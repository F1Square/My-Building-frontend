import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
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
import BottomSheetModal, { BottomSheetTextInput, DetailRow, sheetStyles } from '../components/BottomSheetModal';
import ExpenseExportSheet from '../components/ExpenseExportSheet';
import HorizontalChipScroll, { chipStyles } from '../components/HorizontalChipScroll';

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
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);

  // Forms
  const [balanceInput, setBalanceInput] = useState('');
  const [form, setForm] = useState({
    type: 'outflow' as 'inflow' | 'outflow',
    amount: '',
    description: '',
    category: '',
    date: localDateString()
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
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

  const clearFormErrors = () => {
    setFormError(null);
    setAmountError(null);
    setDescriptionError(null);
  };

  const resetEntryForm = () => {
    setForm({ type: 'outflow', amount: '', description: '', category: '', date: localDateString() });
    clearFormErrors();
  };

  const closeEntrySheet = () => {
    setShowAdd(false);
    setShowEdit(null);
    resetEntryForm();
  };

  const validateEntryForm = () => {
    setFormError(null);
    const amount = parseFloat(form.amount);
    const nextAmountError = !form.amount.trim() || isNaN(amount) || amount <= 0
      ? 'Enter a valid amount'
      : null;
    const nextDescError = !form.description.trim() ? 'Description is required' : null;
    setAmountError(nextAmountError);
    setDescriptionError(nextDescError);
    return !nextAmountError && !nextDescError;
  };

  const addEntry = async () => {
    if (!validateEntryForm()) return;
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
      closeEntrySheet();
      ToastAndroid.show('Entry added', ToastAndroid.SHORT);
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Failed to add entry');
    } finally { setSubmitting(false); }
  };

  const saveEdit = async () => {
    if (!showEdit) return;
    if (!validateEntryForm()) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/expenses/entries/${showEdit.id}`, {
        ...form,
        amount: parseFloat(form.amount),
        date: form.date?.slice(0, 10) || localDateString(),
        building_id: buildingId,
        wing: wingName,
      });
      const updated = res.data?.entry;
      setEntries(prev => prev.map(e => {
        if (e.id !== showEdit.id) return e;
        if (!updated) return e;
        return {
          ...e,
          ...updated,
          date: updated.date || form.date || e.date,
          added_by_user: updated.added_by_user ?? e.added_by_user,
          edited_by_user: updated.edited_by_user ?? e.edited_by_user,
        };
      }));
      setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
      closeEntrySheet();
      ToastAndroid.show('Entry updated', ToastAndroid.SHORT);
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Failed to update entry');
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
    const parts = parseExpenseDateParts(item.date, item.created_at);
    const date = parts
      ? `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
      : localDateString();
    clearFormErrors();
    setForm({
      type: item.type,
      amount: String(item.amount),
      description: item.description,
      category: item.category || '',
      date,
    });
    setShowEdit(item);
  };

  const openAdd = () => {
    resetEntryForm();
    setShowAdd(true);
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
        rightAction={
          <View style={styles.headerActions}>
            {buildingId ? (
              <>
                <ModuleHeaderIconButton
                  icon="document-text-outline"
                  onPress={() => setExportFormat('pdf')}
                  size={20}
                />
                <ModuleHeaderIconButton
                  icon="grid-outline"
                  onPress={() => setExportFormat('excel')}
                  size={20}
                />
              </>
            ) : null}
            {canManage ? <ModuleHeaderIconButton icon="add" onPress={openAdd} /> : null}
          </View>
        }
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

      {/* ── Entry Detail ── */}
      <BottomSheetModal
        visible={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail?.type === 'inflow' ? 'Inflow' : 'Outflow'}
        snapPoints={['55%']}
      >
        {showDetail ? (
          <>
            <View style={[sheetStyles.detailHero, { paddingVertical: 8 }]}>
              <Text
                style={[
                  styles.detailAmount,
                  { color: showDetail.type === 'inflow' ? INFLOW_COLOR : OUTFLOW_COLOR },
                ]}
              >
                {showDetail.type === 'inflow' ? '+' : '-'}{fmt(showDetail.amount)}
              </Text>
            </View>

            <View style={sheetStyles.detailCard}>
              <DetailRow
                icon="calendar-outline"
                label="Date"
                value={formatExpenseDate(showDetail.date, showDetail.created_at)}
              />
              <DetailRow
                icon="pricetag-outline"
                label="Category"
                value={showDetail.category || '—'}
              />
              <DetailRow icon="document-text-outline" label="Description" value={showDetail.description} />
              <DetailRow
                icon="person-outline"
                label="Added By"
                value={showDetail.added_by_user?.name || '—'}
                isLast
              />
            </View>

            {canManage ? (
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.detailEditBtn}
                  onPress={() => { setShowDetail(null); openEdit(showDetail); }}
                >
                  <Ionicons name="pencil-outline" size={16} color={Colors.white} />
                  <Text style={styles.detailEditBtnText}>Edit</Text>
                </TouchableOpacity>
                {isAdmin ? (
                  <TouchableOpacity
                    style={styles.detailDeleteBtn}
                    onPress={() => { setShowDetail(null); deleteEntry(showDetail.id); }}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    <Text style={styles.detailDeleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <View />
        )}
      </BottomSheetModal>

      {buildingId ? (
        <ExpenseExportSheet
          visible={!!exportFormat}
          onClose={() => setExportFormat(null)}
          format={exportFormat || 'pdf'}
          buildingId={buildingId}
          wingName={wingName}
        />
      ) : null}

      {/* ── Set / Update Balance (compact sheet) ── */}
      <BottomSheetModal
        visible={showSetBalance}
        onClose={() => setShowSetBalance(false)}
        title={summary?.opening_balance !== null && summary?.opening_balance !== undefined ? 'Update Balance' : 'Set Balance'}
        subtitle="Enter the current balance for this wing"
        snapPoints={['42%']}
      >
        <Text style={styles.label}>Balance (₹) *</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={balanceInput}
          onChangeText={setBalanceInput}
          placeholder="e.g. 50000"
          keyboardType="numeric"
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />
        <TouchableOpacity style={styles.submitBtn} onPress={saveBalance} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save</Text>}
        </TouchableOpacity>
      </BottomSheetModal>

      {/* ── Add / Edit Entry ── */}
      <BottomSheetModal
        visible={showAdd || !!showEdit}
        onClose={closeEntrySheet}
        title={showEdit ? 'Edit Entry' : 'New Entry'}
      >
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
        <BottomSheetTextInput
          style={[styles.input, amountError ? styles.inputError : null]}
          value={form.amount}
          onChangeText={v => {
            setForm({ ...form, amount: v });
            if (amountError) setAmountError(null);
            if (formError) setFormError(null);
          }}
          placeholder="e.g. 10000"
          keyboardType="numeric"
          placeholderTextColor={Colors.textMuted}
        />
        {amountError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={Colors.danger} />
            <Text style={styles.errorText}>{amountError}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Description *</Text>
        <BottomSheetTextInput
          style={[styles.input, descriptionError ? styles.inputError : null]}
          value={form.description}
          onChangeText={v => {
            setForm({ ...form, description: v });
            if (descriptionError) setDescriptionError(null);
            if (formError) setFormError(null);
          }}
          placeholder="e.g. Watchman salary"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={2}
        />
        {descriptionError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={Colors.danger} />
            <Text style={styles.errorText}>{descriptionError}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <HorizontalChipScroll>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[chipStyles.chip, form.category === cat && chipStyles.chipOn]}
              onPress={() => setForm({ ...form, category: form.category === cat ? '' : cat })}
            >
              <Text style={[chipStyles.chipText, form.category === cat && chipStyles.chipTextOn]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </HorizontalChipScroll>

        <ExpenseDatePicker
          value={form.date}
          onChange={date => {
            setForm({ ...form, date });
            if (formError) setFormError(null);
          }}
        />

        {formError ? (
          <View style={styles.formErrorBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={showEdit ? saveEdit : addEntry}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>{showEdit ? 'Update' : 'Add'} Entry</Text>}
        </TouchableOpacity>
      </BottomSheetModal>

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
  inputError: { borderColor: Colors.danger, marginBottom: 6 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, marginTop: -2,
  },
  formErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: Colors.danger, flex: 1, fontWeight: '500' },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginVertical: 20 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12 },
  detailEditBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  detailDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.danger + '20', borderRadius: 10, paddingVertical: 12 },
  detailDeleteBtnText: { fontSize: 14, fontWeight: '700', color: Colors.danger },
  detailAmount: { fontSize: 36, fontWeight: '800' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  pickerRowActive: { backgroundColor: Colors.primary + '10' },
  pickerRowText: { fontSize: 16, color: Colors.text },
  pickerRowTextActive: { fontWeight: '800', color: Colors.primary },
});
