import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';
import { ModuleHeader } from '../components/ModuleHeader';

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  users?: { name: string; email: string; flat_no?: string; wing?: string };
  buildings?: { name: string };
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#EF4444', bg: '#FEF2F2' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4' },
  closed: { label: 'Closed', color: '#64748B', bg: '#F1F5F9' },
};

export default function HelpSupportAdminScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchTickets = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/support-tickets/admin', { params });
      setTickets(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchTickets(); }, [filter]));

  const openCount = tickets.filter(t => t.status === 'open').length;

  const renderItem = ({ item }: { item: Ticket }) => {
    const meta = STATUS_META[item.status] || STATUS_META.open;
    return (
      <TouchableOpacity
        style={[styles.card, item.status === 'open' && styles.cardNew]}
        onPress={() => router.push({ pathname: '/help-support-detail', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardSubject} numberOfLines={1}>{item.subject}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.cardUser}>{item.users?.name || 'Unknown user'} · {item.users?.email}</Text>
        {item.buildings?.name ? <Text style={styles.cardBuilding}>{item.buildings.name}</Text> : null}
        <Text style={styles.cardMeta}>{item.category} · {new Date(item.last_message_at || item.created_at).toLocaleString('en-IN')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ModuleHeader
        title="Help & Support"
        subtitle={`${tickets.length} tickets${openCount ? ` · ${openCount} open` : ''}`}
      />

      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subject..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchTickets}
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
        </View>
        <View style={styles.chipRow}>
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, filter === s && styles.chipOn]} onPress={() => setFilter(s)}>
              <Text style={[styles.chipText, filter === s && styles.chipTextOn]}>
                {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTickets(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No support tickets</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  filters: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, padding: 10, fontSize: 14, color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  chipTextOn: { color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardNew: { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSubject: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cardUser: { fontSize: 12, color: Colors.text, marginTop: 6, fontWeight: '600' },
  cardBuilding: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textMuted },
});
