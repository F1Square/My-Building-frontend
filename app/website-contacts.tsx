import React, { useEffect, useState } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';

type Contact = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  new: '#EF4444',
  read: '#F59E0B',
  replied: '#10B981',
};

const STATUS_ICON: Record<string, string> = {
  new: 'mail-unread-outline',
  read: 'mail-open-outline',
  replied: 'checkmark-circle-outline',
};

export default function WebsiteContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get('/contacts');
      setContacts(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: Contact['status']) => {
    setUpdating(true);
    try {
      await api.patch(`/contacts/${id}/status`, { status });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const openContact = (item: Contact) => {
    setSelected(item);
    // auto-mark as read when opened
    if (item.status === 'new') updateStatus(item.id, 'read');
  };

  const newCount = contacts.filter(c => c.status === 'new').length;

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={[styles.card, item.status === 'new' && styles.cardNew]} onPress={() => openContact(item)}>
      <View style={styles.cardTop}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
          <Ionicons name={STATUS_ICON[item.status] as any} size={13} color={STATUS_COLOR[item.status]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardSubject} numberOfLines={1}>{item.subject}</Text>
      <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.cardDate}>
        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Website Inquiries</Text>
          <Text style={styles.headerSub}>{contacts.length} total{newCount > 0 ? ` · ${newCount} new` : ''}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="mail-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No inquiries yet</Text>
              <Text style={styles.emptySubText}>Messages from the website will appear here</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selected.subject}</Text>
                <Text style={styles.modalSub}>{selected.name} · {selected.email}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Status row */}
              <View style={styles.detailStatusRow}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[selected.status] + '20' }]}>
                  <Ionicons name={STATUS_ICON[selected.status] as any} size={14} color={STATUS_COLOR[selected.status]} />
                  <Text style={[styles.statusText, { color: STATUS_COLOR[selected.status] }]}>{selected.status}</Text>
                </View>
                <Text style={styles.detailDate}>
                  {new Date(selected.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Message */}
              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>Message</Text>
                <Text style={styles.messageText}>{selected.message}</Text>
              </View>

              {/* Contact details */}
              {[
                ['Name', selected.name],
                ['Email', selected.email],
              ].map(([k, v]) => (
                <View key={k} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{k}</Text>
                  <Text style={styles.detailVal}>{v}</Text>
                </View>
              ))}

              {/* Status actions */}
              <Text style={styles.actionsLabel}>Update Status</Text>
              <View style={styles.actionsRow}>
                {(['new', 'read', 'replied'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.actionBtn,
                      { borderColor: STATUS_COLOR[s] },
                      selected.status === s && { backgroundColor: STATUS_COLOR[s] },
                    ]}
                    onPress={() => updateStatus(selected.id, s)}
                    disabled={updating || selected.status === s}
                  >
                    <Ionicons
                      name={STATUS_ICON[s] as any}
                      size={15}
                      color={selected.status === s ? Colors.white : STATUS_COLOR[s]}
                    />
                    <Text style={[
                      styles.actionBtnText,
                      { color: selected.status === s ? Colors.white : STATUS_COLOR[s] },
                    ]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  cardNew: { borderLeftColor: '#EF4444' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardSubject: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardMessage: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  cardDate: { fontSize: 11, color: Colors.border, marginTop: 8 },

  emptyBox: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySubText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingTop: 28, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  detailStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  detailDate: { fontSize: 12, color: Colors.textMuted },

  messageBox: { backgroundColor: Colors.bg, borderRadius: 12, padding: 16, marginBottom: 20 },
  messageLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  messageText: { fontSize: 15, color: Colors.text, lineHeight: 22 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  detailVal: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1.5, textAlign: 'right' },

  actionsLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});
