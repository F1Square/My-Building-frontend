import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { ModuleHeader } from '../components/ModuleHeader';

type Message = {
  id: string;
  sender_id?: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: '#EF4444' },
  in_progress: { label: 'In Progress', color: '#D97706' },
  resolved: { label: 'Resolved', color: '#16A34A' },
  closed: { label: 'Closed', color: '#64748B' },
};

export default function HelpSupportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === 'admin';

  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/support-tickets/${id}`);
      setTicket(res.data.ticket);
      setMessages(res.data.messages || []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchDetail(); }, [id]));

  const sendReply = async () => {
    if (!reply.trim() || !id) return;
    setSending(true);
    try {
      await api.post(`/support-tickets/${id}/messages`, { message: reply.trim() });
      setReply('');
      await fetchDetail();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      await api.patch(`/support-tickets/${id}/status`, { status });
      await fetchDetail();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAdminMsg = item.sender_role === 'admin';
    return (
      <View style={[styles.bubbleWrap, isAdminMsg ? styles.bubbleWrapLeft : styles.bubbleWrapRight]}>
        <Text style={styles.senderLabel}>{item.sender_name || item.sender_role} · {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
        <View style={[styles.bubble, isAdminMsg ? styles.bubbleAdmin : styles.bubbleUser]}>
          <Text style={[styles.bubbleText, isAdminMsg ? styles.bubbleTextAdmin : styles.bubbleTextUser]}>{item.message}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ModuleHeader title="Support Ticket" />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      </View>
    );
  }

  const statusMeta = STATUS_META[ticket?.status] || STATUS_META.open;
  const canReply = ticket?.status !== 'closed';

  return (
    <View style={styles.container}>
      <ModuleHeader title={ticket?.subject || 'Support Ticket'} subtitle={ticket?.category} />

      <View style={styles.metaBar}>
        <View style={[styles.statusPill, { borderColor: statusMeta.color }]}>
          <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        {isAdmin && ticket?.users?.name ? (
          <Text style={styles.metaText}>{ticket.users.name} · {ticket.users.email}</Text>
        ) : null}
      </View>

      {isAdmin && (
        <View style={styles.adminActions}>
          {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusBtn, ticket?.status === s && styles.statusBtnOn]}
              onPress={() => updateStatus(s)}
              disabled={updating}
            >
              <Text style={[styles.statusBtnText, ticket?.status === s && styles.statusBtnTextOn]}>
                {STATUS_META[s].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        ListEmptyComponent={<Text style={styles.emptyMsg}>No messages yet</Text>}
      />

      {canReply && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.composerInput}
              value={reply}
              onChangeText={setReply}
              placeholder={isAdmin ? 'Type admin reply...' : 'Type your reply...'}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendReply} disabled={sending || !reply.trim()}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  metaBar: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  statusPill: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  metaText: { fontSize: 12, color: Colors.textMuted },
  adminActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  statusBtn: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.white },
  statusBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  statusBtnTextOn: { color: Colors.white },
  bubbleWrap: { marginBottom: 12, maxWidth: '88%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  senderLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  bubble: { borderRadius: 14, padding: 12 },
  bubbleAdmin: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  bubbleUser: { backgroundColor: Colors.primary },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextAdmin: { color: Colors.text },
  bubbleTextUser: { color: Colors.white },
  emptyMsg: { textAlign: 'center', color: Colors.textMuted, marginTop: 24 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 100, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
