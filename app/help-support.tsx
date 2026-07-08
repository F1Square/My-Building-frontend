import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';
import { ModuleHeader, ModuleHeaderIconButton } from '../components/ModuleHeader';

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#EF4444', bg: '#FEF2F2' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4' },
  closed: { label: 'Closed', color: '#64748B', bg: '#F1F5F9' },
};

const CATEGORIES = ['General', 'Account', 'Billing', 'App Issue', 'Society Setup', 'Other'];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', category: 'General' });

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support-tickets/my');
      setTickets(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchTickets(); }, []));

  const createTicket = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      return Alert.alert('Required', 'Subject and message are required');
    }
    setSubmitting(true);
    try {
      await api.post('/support-tickets', form);
      setShowAdd(false);
      setForm({ subject: '', message: '', category: 'General' });
      fetchTickets();
      Alert.alert('Submitted', 'Your support request has been sent. Admin will reply soon.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Ticket }) => {
    const meta = STATUS_META[item.status] || STATUS_META.open;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/help-support-detail', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardSubject} numberOfLines={1}>{item.subject}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>{item.category} · {new Date(item.last_message_at || item.created_at).toLocaleString('en-IN')}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.cardChevron} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ModuleHeader
        title="Help & Support"
        subtitle="Ask questions"
        rightAction={<ModuleHeaderIconButton icon="add" onPress={() => setShowAdd(true)} />}
      />

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
              <Ionicons name="help-circle-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No support tickets yet</Text>
              <Text style={styles.emptySub}>Tap + to ask a question</Text>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Support Request</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, form.category === c && styles.chipOn]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={[styles.chipText, form.category === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Subject *</Text>
            <TextInput style={styles.input} value={form.subject} onChangeText={(v) => setForm({ ...form, subject: v })} placeholder="Brief summary" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Message *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.message} onChangeText={(v) => setForm({ ...form, message: v })} placeholder="Describe your issue or question..." multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.submitBtn} onPress={createTicket} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 20 },
  cardSubject: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  cardChevron: { position: 'absolute', right: 14, top: 18 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textMuted },
  emptySub: { fontSize: 13, color: Colors.textMuted },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg, marginBottom: 12 },
  textArea: { height: 120, textAlignVertical: 'top' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, marginRight: 8, backgroundColor: Colors.bg },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  chipTextOn: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
