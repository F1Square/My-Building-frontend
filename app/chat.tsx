import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  RefreshControl, Animated, AppState,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useActivityLog } from '../hooks/useActivityLog';

const PAGE_SIZE = 40;
const POLL_IDLE_MS = 8000;   // 8s when no new messages
const POLL_ACTIVE_MS = 3000; // 3s when conversation is active
const POLL_BG_MS = 30000;    // 30s when app is backgrounded
const NEAR_BOTTOM_PX = 100;
const ACTIVE_WINDOW_MS = 60000; // Consider "active" if msg received in last 60s

// Sender color palette for avatar backgrounds
const SENDER_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
  '#D946EF', '#0EA5E9', '#F97316', '#22C55E',
];
function senderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

type ChatMessage = {
  id: string;
  user_id: string;
  building_id?: string;
  message: string;
  sender_name?: string;
  created_at: string;
};

/* ─── Single message bubble ─────────────────────────────────────────────── */
const ChatMessageRow = memo(function ChatMessageRow({
  item, prevItem, userId,
}: {
  item: ChatMessage; prevItem: ChatMessage | null; userId?: string;
}) {
  const isMe = item.user_id === userId;
  const showName = !isMe && (!prevItem || prevItem.user_id !== item.user_id);
  const time = new Date(item.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  const msgDate = new Date(item.created_at).toDateString();
  const prevDate = prevItem ? new Date(prevItem.created_at).toDateString() : null;
  const showDateSep = msgDate !== prevDate;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const dateLabel =
    msgDate === today ? 'Today'
      : msgDate === yesterday ? 'Yesterday'
        : new Date(item.created_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        });

  const avatarBg = senderColor(item.user_id);

  return (
    <>
      {showDateSep && (
        <View style={s.dateSepRow}>
          <View style={s.dateSepPill}>
            <Text style={s.dateSepText}>{dateLabel}</Text>
          </View>
        </View>
      )}
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {!isMe && (
          <View style={[s.msgAvatar, { backgroundColor: avatarBg }]}>
            <Text style={s.msgAvatarText}>{item.sender_name?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          {showName && <Text style={[s.senderName, { color: avatarBg }]}>{item.sender_name}</Text>}
          <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.message}</Text>
          <View style={s.timeRow}>
            <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{time}</Text>
            {isMe && <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />}
          </View>
        </View>
      </View>
    </>
  );
});

/* ─── Main screen ───────────────────────────────────────────────────────── */
export default function ChatScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { logEvent } = useActivityLog();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [noBuildingError, setNoBuildingError] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocusedRef = useRef(false);
  const pageRef = useRef(1);
  const loadOlderGuardRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const lastNewMsgTimeRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const sendBtnScale = useRef(new Animated.Value(1)).current;

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated }));
  }, []);

  const mergeMessages = useCallback((prev: ChatMessage[], incoming: ChatMessage[]) => {
    const ids = new Set(prev.map(m => m.id));
    const fresh = incoming.filter(m => !ids.has(m.id));
    if (!fresh.length) return prev;
    return [...prev, ...fresh].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, []);

  /** Adaptive poll interval based on chat activity */
  const getPollInterval = useCallback(() => {
    if (appStateRef.current !== 'active') return POLL_BG_MS;
    const sinceLastMsg = Date.now() - lastNewMsgTimeRef.current;
    return sinceLastMsg < ACTIVE_WINDOW_MS ? POLL_ACTIVE_MS : POLL_IDLE_MS;
  }, []);

  /* ── Data fetching ───────────────────────────────────────────────────── */

  const fetchMessages = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      pageRef.current = 1;
      const res = await api.get('/chat', { params: { page: 1, limit: PAGE_SIZE } });
      const msgs: ChatMessage[] = res.data;
      setMessages(msgs);
      setHasMoreOlder(msgs.length >= PAGE_SIZE);
      lastMsgIdRef.current = msgs.length ? msgs[msgs.length - 1].id : null;
      setNoBuildingError(false);
      if (stickToBottomRef.current) queueMicrotask(() => scrollToBottom(false));
    } catch (e: any) {
      if (e.response?.data?.error?.includes('building')) setNoBuildingError(true);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [scrollToBottom]);

  const loadOlderMessages = useCallback(async () => {
    if (noBuildingError || loading || loadOlderGuardRef.current || !hasMoreOlder || loadingMore) return;
    loadOlderGuardRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const res = await api.get('/chat', { params: { page: nextPage, limit: PAGE_SIZE } });
      const older: ChatMessage[] = res.data || [];
      if (older.length === 0) {
        setHasMoreOlder(false);
      } else {
        pageRef.current = nextPage;
        if (older.length < PAGE_SIZE) setHasMoreOlder(false);
        setMessages(prev => {
          const combined = [...older, ...prev];
          const seen = new Set<string>();
          return combined.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id); return true;
          }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    } catch { /* keep existing */ } finally {
      setLoadingMore(false);
      setTimeout(() => { loadOlderGuardRef.current = false; }, 400);
    }
  }, [hasMoreOlder, loading, loadingMore, noBuildingError]);

  /* ── Adaptive polling ────────────────────────────────────────────────── */

  const pollNewMessages = useCallback(async () => {
    if (!lastMsgIdRef.current || !isFocusedRef.current) return;
    try {
      const res = await api.get('/chat/new', { params: { after_id: lastMsgIdRef.current } });
      const fresh: ChatMessage[] = res.data;
      if (fresh.length) {
        lastNewMsgTimeRef.current = Date.now();
        setMessages(prev => {
          const merged = mergeMessages(prev, fresh);
          if (merged.length > prev.length) {
            lastMsgIdRef.current = merged[merged.length - 1].id;
            if (stickToBottomRef.current) scrollToBottom(true);
          }
          return merged;
        });
      }
    } catch { /* offline / transient */ }
  }, [mergeMessages, scrollToBottom]);

  /** Schedule next poll with adaptive interval (setTimeout, not setInterval) */
  const scheduleNextPoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const interval = getPollInterval();
    pollTimerRef.current = setTimeout(async () => {
      await pollNewMessages();
      if (isFocusedRef.current) scheduleNextPoll();
    }, interval);
  }, [getPollInterval, pollNewMessages]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /* ── AppState listener: slow down polling when backgrounded ──────────── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active' && isFocusedRef.current) {
        // Returning from background — poll immediately then reschedule
        void pollNewMessages().then(() => scheduleNextPoll());
      }
    });
    return () => sub.remove();
  }, [pollNewMessages, scheduleNextPoll]);

  /* ── Focus lifecycle ─────────────────────────────────────────────────── */
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      stickToBottomRef.current = true;
      logEvent('open_chat', 'chat');
      // Fetch member count for header (fire and forget)
      api.get('/buildings/my').then(r => setMemberCount(r.data?.total_members ?? null)).catch(() => {});
      void fetchMessages().then(() => scheduleNextPoll());
      return () => {
        isFocusedRef.current = false;
        stopPolling();
      };
    }, [fetchMessages, logEvent, scheduleNextPoll, stopPolling]),
  );

  useEffect(() => {
    if (!loading && messages.length > 0 && stickToBottomRef.current) scrollToBottom(false);
  }, [loading, messages.length, scrollToBottom]);

  /* ── Scroll tracking ─────────────────────────────────────────────────── */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    stickToBottomRef.current = distFromBottom <= NEAR_BOTTOM_PX;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchMessages({ silent: true });
  }, [fetchMessages]);

  /* ── Send message ────────────────────────────────────────────────────── */
  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    // Button press animation
    Animated.sequence([
      Animated.timing(sendBtnScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(sendBtnScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setSending(true);
    setText('');
    stickToBottomRef.current = true;
    lastNewMsgTimeRef.current = Date.now(); // sender counts as activity
    try {
      const res = await api.post('/chat', { message: trimmed });
      const sent = res.data as ChatMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === sent.id)) return prev;
        lastMsgIdRef.current = sent.id;
        return [...prev, sent];
      });
      scrollToBottom(true);
      // Bump to active polling since we just sent
      scheduleNextPoll();
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  /* ── Renderers ───────────────────────────────────────────────────────── */
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const prevItem = index > 0 ? messagesRef.current[index - 1] ?? null : null;
    return <ChatMessageRow item={item} prevItem={prevItem} userId={userIdRef.current} />;
  }, []);

  const keyExtractor = useCallback((i: ChatMessage) => i.id, []);
  const listExtraData = messages.length
    ? `${messages.length}:${messages[messages.length - 1]?.id ?? ''}`
    : '0';
  const keyboardVerticalOffset = Platform.OS === 'ios' ? Math.max(insets.top, 12) + 8 : 0;

  /* ─── UI ──────────────────────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {/* ── Premium header ──────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Ionicons name="chatbubbles" size={22} color="#fff" />
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Society Chat</Text>
          <Text style={s.headerSub}>
            {memberCount ? `${memberCount} members · ` : ''}Group
          </Text>
        </View>
        <TouchableOpacity style={s.headerAction}>
          <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadingText}>Loading messages…</Text>
        </View>
      ) : noBuildingError ? (
        <View style={s.emptyContainer}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="business-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={s.emptyTitle}>No Building Assigned</Text>
          <Text style={s.emptySub}>Admin accounts must be assigned to a building to access chat.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          extraData={listExtraData}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onStartReached={loadOlderMessages}
          onStartReachedThreshold={0.15}
          maintainVisibleContentPosition={hasMoreOlder ? { minIndexForVisible: 0, autoscrollToTopThreshold: 40 } : undefined}
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={40}
          windowSize={12}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 12 }} color={Colors.primary} /> : null}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.primary} />
              </View>
              <Text style={s.emptyTitle}>{t('beFirstToSay')}</Text>
              <Text style={s.emptySub}>Start the conversation with your society members</Text>
            </View>
          }
        />
      )}

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <View style={s.inputWrap}>
          <Ionicons name="happy-outline" size={22} color={Colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder={noBuildingError ? 'Not available' : t('typeMessage')}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            editable={!noBuildingError}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>
        <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },

  /* Header */
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500', marginTop: 1 },
  headerAction: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },

  /* Messages */
  listContent: { padding: 14, paddingBottom: 8, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3, gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  msgAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
  },
  senderName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 15, color: Colors.text, lineHeight: 21 },
  msgTextMe: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 11, color: Colors.textMuted },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },

  /* Date separator */
  dateSepRow: { alignItems: 'center', marginVertical: 14 },
  dateSepPill: {
    backgroundColor: 'rgba(59,95,192,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  dateSepText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  /* Empty / loading */
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(59,95,192,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  /* Input bar */
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F2F5', borderRadius: 24,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 15, color: Colors.text, maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: '#B0BEC5', shadowOpacity: 0 },
});
