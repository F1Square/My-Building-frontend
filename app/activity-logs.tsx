import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../utils/api';
import { ModuleHeader } from '../components/ModuleHeader';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

const MODULE_COLORS: Record<string, string> = {
  auth: '#6366F1', maintenance: '#10B981', complaints: '#EF4444',
  vehicles: '#0EA5E9', visitors: '#F59E0B', buildings: '#1E3A8A',
  subscriptions: '#7C3AED', expenses: '#059669', chat: '#EC4899',
  meetings: '#0891B2', funds: '#D97706', requests: '#16A34A',
  announcements: '#F59E0B', promos: '#EC4899', inquiries: '#0891B2',
  helpline: '#EF4444', app: Colors.primary,
};
const ROLE_COLORS: Record<string, string> = {
  user: Colors.success, pramukh: Colors.accent, admin: Colors.danger,
};
const HIDE_DETAIL_KEYS = new Set(['level', 'error_message', 'path', 'method', 'status_code', 'kind', 'source']);

function formatAction(a: string) {
  return a?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—';
}
function formatFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function dayGroupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isErrorLog(item: any) {
  return item?.detail?.level === 'error' || (item?.detail?.status_code >= 500);
}
function filterLogs(logs: any[], query: string) {
  if (!query) return logs;
  const q = query.toLowerCase();
  return logs.filter(l =>
    l.user_name?.toLowerCase().includes(q) ||
    l.action?.toLowerCase().includes(q) ||
    l.module?.toLowerCase().includes(q) ||
    l.user_role?.toLowerCase().includes(q)
  );
}
function groupLogsByDay(logs: any[]) {
  const sections: { title: string; data: any[] }[] = [];
  let currentTitle = '';
  for (const log of logs) {
    const title = dayGroupLabel(log.created_at);
    if (title !== currentTitle) {
      sections.push({ title, data: [log] });
      currentTitle = title;
    } else {
      sections[sections.length - 1].data.push(log);
    }
  }
  return sections;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Calendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return (
    <View style={calStyles.wrap}>
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={calStyles.navLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={calStyles.todayBtn} onPress={() => onSelect(todayStr)}>
        <Ionicons name="today-outline" size={14} color={Colors.primary} />
        <Text style={calStyles.todayBtnText}>Jump to Today</Text>
      </TouchableOpacity>
      <View style={calStyles.row}>
        {DAY_LABELS.map(d => <Text key={d} style={calStyles.dayHdr}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={calStyles.row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={calStyles.cell} />;
            const ds = toDateStr(year, month, day);
            const isSel = ds === selected;
            const isToday = ds === todayStr;
            const isFuture = ds > todayStr;
            return (
              <TouchableOpacity
                key={col}
                style={[calStyles.cell, isSel && calStyles.cellSel, isToday && !isSel && calStyles.cellToday]}
                onPress={() => !isFuture && onSelect(ds)}
                disabled={isFuture}
              >
                <Text style={[calStyles.dayTxt, isSel && calStyles.dayTxtSel, isToday && !isSel && calStyles.dayTxtToday, isFuture && calStyles.dayTxtFuture]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DetailModal({ selected, onClose }: { selected: any; onClose: () => void }) {
  const isError = isErrorLog(selected);
  const modColor = MODULE_COLORS[selected.module] ?? Colors.primary;
  const headerColor = isError ? Colors.danger : modColor;
  const roleColor = ROLE_COLORS[selected.user_role] ?? Colors.textMuted;

  const detailMeta = useMemo(() => {
    const detailObj = (selected.detail && typeof selected.detail === 'object') ? selected.detail : {};
    const rows: { label: string; value: string }[] = [];
    for (const [k, v] of Object.entries(detailObj)) {
      if (v === null || v === undefined || v === '') continue;
      if (HIDE_DETAIL_KEYS.has(k)) continue;
      rows.push({
        label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v),
      });
    }
    return {
      detailRows: rows,
      errorMessage: isError ? detailObj.error_message : null,
      errorPath: detailObj.path,
      errorMethod: detailObj.method,
      errorStatus: detailObj.status_code,
      errorKind: detailObj.kind,
    };
  }, [selected, isError]);

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetHeaderStrip, { backgroundColor: headerColor }]}>
            {isError && <Ionicons name="warning" size={18} color={Colors.white} style={{ marginRight: 6 }} />}
            <Text style={styles.sheetAction}>{formatAction(selected.action)}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.detailCard}>
              <View style={[styles.detailAvatar, { backgroundColor: roleColor }]}>
                <Text style={styles.detailAvatarText}>{selected.user_name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selected.user_name ?? '—'}</Text>
                <View style={[styles.rolePill, { backgroundColor: roleColor + '20', marginTop: 4 }]}>
                  <Text style={[styles.rolePillText, { color: roleColor }]}>{selected.user_role?.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[styles.modPill, { backgroundColor: modColor + '18' }]}>
                <Text style={[styles.modPillText, { color: modColor }]}>{selected.module}</Text>
              </View>
            </View>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
                <View>
                  <Text style={styles.metaLabel}>Timestamp</Text>
                  <Text style={styles.metaValue}>{formatFull(selected.created_at)}</Text>
                </View>
              </View>
              {selected.ip_address ? (
                <View style={styles.metaItem}>
                  <Ionicons name="globe-outline" size={15} color={Colors.textMuted} />
                  <View>
                    <Text style={styles.metaLabel}>IP Address</Text>
                    <Text style={styles.metaValue} selectable>{selected.ip_address}</Text>
                  </View>
                </View>
              ) : null}
            </View>
            {isError ? (
              <View style={styles.errorBox}>
                <View style={styles.errorBoxHeader}>
                  <Ionicons name="bug" size={16} color={Colors.danger} />
                  <Text style={styles.errorBoxTitle}>
                    {detailMeta.errorKind === 'network' ? 'Network Failure' : 'Technical Error'}
                    {detailMeta.errorStatus ? ` · HTTP ${detailMeta.errorStatus}` : ''}
                  </Text>
                </View>
                {detailMeta.errorMessage ? (
                  <Text style={styles.errorBoxMsg} selectable>{String(detailMeta.errorMessage)}</Text>
                ) : null}
                {(detailMeta.errorMethod || detailMeta.errorPath) ? (
                  <Text style={styles.errorBoxPath} selectable>
                    {(detailMeta.errorMethod || '') + (detailMeta.errorMethod && detailMeta.errorPath ? ' ' : '') + (detailMeta.errorPath || '')}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {detailMeta.detailRows.length > 0 ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>{isError ? 'Request Context' : 'Action Details'}</Text>
                {detailMeta.detailRows.map(({ label, value }) => (
                  <View key={label} style={styles.kvRow}>
                    <Text style={styles.kvKey}>{label}</Text>
                    <Text style={styles.kvValue} selectable numberOfLines={4}>{value}</Text>
                  </View>
                ))}
              </View>
            ) : !isError ? (
              <View style={styles.noDetail}>
                <Text style={styles.noDetailText}>No additional details recorded</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ActivityLogsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'info'>('all');
  const [liveMode, setLiveMode] = useState<0 | 5 | 10>(0);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const loadRef = useRef<(off: number, opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  const load = useCallback(async (off: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    try {
      if (!silent && off === 0) setLoading(true);
      if (off > 0) setLoadingMore(true);
      let url = `/activity-logs?limit=${LIMIT}&offset=${off}`;
      if (selectedDate) url += `&date=${selectedDate}`;
      if (levelFilter !== 'all') url += `&level=${levelFilter}`;
      const res = await api.get(url);
      const incoming = res.data.logs ?? [];
      setLogs(off === 0 ? incoming : prev => [...prev, ...incoming]);
      setTotal(res.data.total ?? 0);
      setOffset(off);
    } catch { /* ignore */ }
    finally {
      if (!silent && off === 0) setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedDate, levelFilter]);

  loadRef.current = load;

  useFocusEffect(useCallback(() => { load(0); }, [load]));

  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => { loadRef.current(0, { silent: true }); }, liveMode * 1000);
    return () => clearInterval(id);
  }, [liveMode, selectedDate, levelFilter]);

  const filteredLogs = useMemo(
    () => filterLogs(logs, debouncedSearch),
    [logs, debouncedSearch],
  );
  const sections = useMemo(
    () => groupLogsByDay(filteredLogs),
    [filteredLogs],
  );

  const pickDate = (d: string) => {
    setSelectedDate(d);
    setShowCal(false);
    setLoading(true);
  };
  const clearDate = () => {
    setSelectedDate('');
    setShowCal(false);
    setLoading(true);
  };

  const dateLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const renderItem = useCallback(({ item }: { item: any }) => {
    const isError = isErrorLog(item);
    const modColor = MODULE_COLORS[item.module] ?? Colors.primary;
    const stripColor = isError ? Colors.danger : modColor;
    const roleColor = ROLE_COLORS[item.user_role] ?? Colors.textMuted;
    const statusCode = item?.detail?.status_code;
    return (
      <TouchableOpacity style={[styles.card, isError && styles.cardError]} onPress={() => setSelected(item)} activeOpacity={0.82}>
        <View style={[styles.strip, { backgroundColor: stripColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
              {isError && <Ionicons name="warning" size={14} color={Colors.danger} />}
              <Text style={[styles.cardAction, isError && { color: Colors.danger }]} numberOfLines={1}>
                {formatAction(item.action)}
              </Text>
            </View>
            <Text style={styles.cardTime}>{formatTimeOnly(item.created_at)}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={[styles.rolePill, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.rolePillText, { color: roleColor }]}>{item.user_role?.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardUser} numberOfLines={1}>{item.user_name ?? '—'}</Text>
            <View style={{ flex: 1 }} />
            {isError ? (
              <View style={styles.errPill}>
                <Text style={styles.errPillText}>ERROR{statusCode ? ` · ${statusCode}` : ''}</Text>
              </View>
            ) : (
              <View style={[styles.modPill, { backgroundColor: modColor + '18' }]}>
                <Text style={[styles.modPillText, { color: modColor }]}>{item.module}</Text>
              </View>
            )}
          </View>
          {isError && item?.detail?.error_message ? (
            <Text style={styles.cardErrMsg} numberOfLines={2}>{String(item.detail.error_message)}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.border} style={{ alignSelf: 'center', marginRight: 12 }} />
      </TouchableOpacity>
    );
  }, []);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  ), []);

  const handleLoadMore = useCallback(() => {
    if (debouncedSearch || loadingMore || logs.length >= total) return;
    load(offset + LIMIT);
  }, [debouncedSearch, loadingMore, logs.length, total, offset, load]);

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerLoaderText}>Loading more logs…</Text>
        </View>
      );
    }
    if (!debouncedSearch && logs.length > 0 && logs.length < total) {
      return <Text style={styles.footerHint}>Scroll for more</Text>;
    }
    return null;
  }, [loadingMore, debouncedSearch, logs.length, total]);

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('activityLogsTitle')}
        subtitle={`${total} records · clears after 6 days`}
      />

      <View style={styles.levelRow}>
        {(['all', 'error', 'info'] as const).map((lv) => {
          const active = levelFilter === lv;
          const isErr = lv === 'error';
          return (
            <TouchableOpacity
              key={lv}
              style={[styles.levelPill, active && (isErr ? styles.levelPillActiveErr : styles.levelPillActive)]}
              onPress={() => { setLevelFilter(lv); setLoading(true); }}
              activeOpacity={0.85}
            >
              {isErr && <Ionicons name="warning-outline" size={13} color={active ? Colors.white : Colors.danger} />}
              <Text style={[styles.levelPillText, active && { color: Colors.white }, isErr && !active && { color: Colors.danger }]}>
                {lv === 'all' ? 'All' : lv === 'error' ? 'Errors' : 'Activity'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.liveRow}>
        <View style={styles.liveLabelRow}>
          {liveMode > 0 && <View style={styles.liveDot} />}
          <Text style={[styles.liveLabel, liveMode > 0 && styles.liveLabelOn]}>
            {liveMode > 0 ? 'Live Monitoring ON' : 'Live Monitoring'}
          </Text>
        </View>
        {([0, 5, 10] as const).map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[styles.livePill, liveMode === sec && styles.livePillActive]}
            onPress={() => setLiveMode(sec)}
          >
            <Text style={[styles.livePillText, liveMode === sec && styles.livePillTextActive]}>
              {sec === 0 ? 'Off' : `${sec}s`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toolRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, action, module..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.dateBtn, (selectedDate || showCal) && styles.dateBtnActive]}
          onPress={() => setShowCal(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={17} color={(selectedDate || showCal) ? Colors.white : Colors.primary} />
          <Ionicons name={showCal ? 'chevron-up' : 'chevron-down'} size={13} color={(selectedDate || showCal) ? Colors.white : Colors.primary} />
        </TouchableOpacity>
      </View>

      {selectedDate ? (
        <View style={styles.activeDateRow}>
          <Ionicons name="calendar" size={13} color={Colors.primary} />
          <Text style={styles.activeDateText}>{dateLabel}</Text>
          <TouchableOpacity onPress={clearDate} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={15} color={Colors.primary} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showCal ? (
        <View style={styles.calDropdown}>
          <Calendar selected={selectedDate} onSelect={pickDate} />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor={Colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="document-text-outline" size={44} color={Colors.primary + '50'} />
              </View>
              <Text style={styles.emptyTitle}>No Activity Found</Text>
              <Text style={styles.emptySub}>
                {selectedDate ? `No logs on ${dateLabel}` : debouncedSearch ? 'No results match your search' : 'No user actions recorded yet'}
              </Text>
            </View>
          }
        />
      )}

      {selected ? <DetailModal selected={selected} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10 },
  liveLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  liveLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  liveLabelOn: { color: Colors.danger },
  livePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  livePillActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  livePillText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  livePillTextActive: { color: Colors.white },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: Colors.primary },
  dateBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  activeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 4, backgroundColor: Colors.primary + '10', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  activeDateText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  calDropdown: { marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 5, overflow: 'hidden' },

  levelRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  levelPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  levelPillActiveErr: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  levelPillText: { fontSize: 12, fontWeight: '700', color: Colors.text },

  sectionHeader: { paddingTop: 8, paddingBottom: 6, backgroundColor: Colors.bg },
  sectionHeaderText: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  strip: { width: 4 },
  cardInner: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  cardAction: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  cardTime: { fontSize: 11, color: Colors.textMuted, flexShrink: 0 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardUser: { fontSize: 13, color: Colors.text, fontWeight: '600', flexShrink: 1 },
  rolePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rolePillText: { fontSize: 10, fontWeight: '800' },
  modPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  modPillText: { fontSize: 11, fontWeight: '700' },
  errPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.danger },
  errPillText: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },
  cardErrMsg: { marginTop: 8, fontSize: 12, color: '#991B1B', fontStyle: 'italic', lineHeight: 17 },

  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  footerLoaderText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  footerHint: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, paddingVertical: 12 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12 },
  sheetHeaderStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, marginTop: 8 },
  sheetAction: { fontSize: 17, fontWeight: '800', color: Colors.white, flex: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  detailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 14 },
  detailAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  metaGrid: { gap: 10, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 12 },
  metaLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontSize: 14, color: Colors.text, fontWeight: '500', marginTop: 2 },
  detailSection: { marginBottom: 16 },
  detailSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  kvRow: { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  kvKey: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  kvValue: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  noDetail: { backgroundColor: Colors.bg, borderRadius: 10, padding: 16, alignItems: 'center' },
  noDetailText: { fontSize: 13, color: Colors.textMuted },

  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  errorBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  errorBoxTitle: { fontSize: 13, fontWeight: '800', color: Colors.danger, letterSpacing: 0.3 },
  errorBoxMsg: { fontSize: 14, color: '#7F1D1D', lineHeight: 20, fontWeight: '500' },
  errorBoxPath: { fontSize: 11, fontFamily: 'monospace', color: '#991B1B', marginTop: 8, opacity: 0.85 },
});

const calStyles = StyleSheet.create({
  wrap: { padding: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { padding: 6 },
  navLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },
  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + '12' },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  row: { flexDirection: 'row' },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, margin: 1 },
  cellSel: { backgroundColor: Colors.primary },
  cellToday: { backgroundColor: Colors.primary + '18' },
  dayTxt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  dayTxtSel: { color: Colors.white, fontWeight: '800' },
  dayTxtToday: { color: Colors.primary, fontWeight: '800' },
  dayTxtFuture: { color: Colors.border },
});
