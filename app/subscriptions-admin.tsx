import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';

const DEFAULT_ACCENT = Colors.primary;

type SubRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  paid_amount?: number | null;
  promo_code_used?: string | null;
  remark?: string | null;
  gateway_payment_id?: string | null;
  razorpay_payment_id?: string | null;
  users?: { name?: string; email?: string; role?: string };
};

type PlanRow = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  amount_paise: number;
  months: number | null;
  allow_newspaper_addon: boolean;
  newspaper_addon_paise?: number | null;
  sort_order: number;
  is_active: boolean;
  features?: string[];
};

function accentForPlan(slug: string, i: number) {
  const palette = [Colors.primary, '#F59E0B', Colors.success, '#8B5CF6', '#EC4899'];
  if (slug === 'lifetime') return Colors.success;
  if (slug === 'yearly') return '#F59E0B';
  if (slug === 'monthly') return Colors.primary;
  return palette[i % palette.length];
}

export default function SubscriptionsAdminScreen() {
  const STATUS_COLOR: Record<string, string> = { active: Colors.success, expired: Colors.warning, cancelled: Colors.danger };
  const router = useRouter();
  const [tab, setTab] = useState<'members' | 'plans'>('members');

  const [subs, setSubs] = useState<SubRow[]>([]);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansRefreshing, setPlansRefreshing] = useState(false);

  const [selected, setSelected] = useState<SubRow | null>(null);
  const [acting, setActing] = useState(false);
  const [remark, setRemark] = useState('');

  const [planModal, setPlanModal] = useState<'create' | 'edit' | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [planForm, setPlanForm] = useState({
    slug: '',
    title: '',
    description: '',
    amount_paise: '',
    months: '',
    allow_newspaper_addon: true,
    newspaper_addon_paise: '',
    sort_order: '0',
    featuresText: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSubs = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '200', offset: '0' };
      if (searchDebounced) params.q = searchDebounced;
      const res = await api.get('/subscriptions/all', { params });
      setSubs(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchDebounced]);

  const fetchPlans = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setPlansRefreshing(true);
    else setPlansLoading(true);
    try {
      const res = await api.get('/subscriptions/plans/admin');
      setPlans(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load plans');
    } finally {
      setPlansLoading(false);
      setPlansRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (tab !== 'members') return;
    setLoading(true);
    fetchSubs();
  }, [tab, fetchSubs]);

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      slug: '',
      title: '',
      description: '',
      amount_paise: '',
      months: '',
      allow_newspaper_addon: true,
      newspaper_addon_paise: '',
      sort_order: String((plans[plans.length - 1]?.sort_order ?? 0) + 1),
      featuresText: '',
    });
    setPlanModal('create');
  };

  const openEditPlan = (p: PlanRow) => {
    setEditingPlan(p);
    const feats = Array.isArray(p.features) ? p.features : [];
    setPlanForm({
      slug: p.slug,
      title: p.title,
      description: p.description || '',
      amount_paise: String(p.amount_paise),
      months: p.months == null ? '' : String(p.months),
      allow_newspaper_addon: !!p.allow_newspaper_addon,
      newspaper_addon_paise: p.newspaper_addon_paise == null ? '' : String(p.newspaper_addon_paise),
      sort_order: String(p.sort_order ?? 0),
      featuresText: feats.join('\n'),
    });
    setPlanModal('edit');
  };

  const savePlan = async () => {
    const slug = planForm.slug.trim().toLowerCase();
    const title = planForm.title.trim();
    const amount_paise = parseInt(planForm.amount_paise, 10);
    if (!slug || !title || Number.isNaN(amount_paise)) {
      return Alert.alert('Error', 'Slug, title, and amount (paise) are required');
    }
    const monthsVal = planForm.months.trim() === '' ? null : parseInt(planForm.months, 10);
    if (monthsVal !== null && (Number.isNaN(monthsVal) || monthsVal < 1)) {
      return Alert.alert('Error', 'Months must be empty (lifetime) or a positive number');
    }
    const features = planForm.featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
    const body = {
      slug,
      title,
      description: planForm.description.trim() || null,
      amount_paise,
      months: monthsVal,
      allow_newspaper_addon: planForm.allow_newspaper_addon,
      newspaper_addon_paise: planForm.newspaper_addon_paise.trim() === '' ? null : parseInt(planForm.newspaper_addon_paise, 10),
      sort_order: parseInt(planForm.sort_order, 10) || 0,
      features,
      is_active: true,
    };
    setSavingPlan(true);
    try {
      if (planModal === 'create') {
        await api.post('/subscriptions/plans/admin', body);
        Alert.alert('Done', 'Plan created');
      } else if (editingPlan) {
        await api.patch(`/subscriptions/plans/admin/${editingPlan.id}`, body);
        Alert.alert('Done', 'Plan updated');
      }
      setPlanModal(null);
      fetchPlans();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Save failed');
    } finally {
      setSavingPlan(false);
    }
  };

  const deactivatePlan = (p: PlanRow) => {
    Alert.alert('Deactivate plan', `Hide "${p.title}" from new checkouts? Existing subscribers keep access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/subscriptions/plans/admin/${p.id}`);
            fetchPlans();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          }
        },
      },
    ]);
  };

  const grantablePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);

  const grant = async (user_id: string, plan: string) => {
    setActing(true);
    try {
      await api.post('/subscriptions/grant', { user_id, plan, remark: remark.trim() || undefined });
      setSelected(null);
      setRemark('');
      fetchSubs();
      Alert.alert('Done', `${plan} subscription granted`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally {
      setActing(false);
    }
  };

  const revoke = async (user_id: string) => {
    Alert.alert('Revoke', 'Cancel this subscription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          setActing(true);
          try {
            await api.post('/subscriptions/revoke', { user_id });
            setSelected(null);
            setRemark('');
            fetchSubs();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  const renderSub = ({ item, index }: { item: SubRow; index: number }) => {
    const ac = accentForPlan(item.plan, index);
    return (
      <TouchableOpacity style={styles.card} onPress={() => { setSelected(item); setRemark(''); }}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: ac + '22' }]}>
            <Text style={[styles.avatarText, { color: ac }]}>{item.users?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.users?.name}</Text>
            <Text style={styles.cardEmail}>{item.users?.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.badge, { backgroundColor: ac + '20' }]}>
              <Text style={[styles.badgeText, { color: ac }]}>{item.plan}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || DEFAULT_ACCENT) + '20' }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || DEFAULT_ACCENT }]}>{item.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.cardMeta}>
          Started: {new Date(item.started_at).toLocaleDateString('en-IN')}
          {item.expires_at ? `  ·  Expires: ${new Date(item.expires_at).toLocaleDateString('en-IN')}` : '  ·  Lifetime'}
        </Text>
        {item.paid_amount != null && (
          <View style={styles.paidRow}>
            <Text style={styles.paidAmt}>₹{Number(item.paid_amount).toLocaleString('en-IN')} paid</Text>
            {item.promo_code_used && (
              <View style={styles.promoChip}>
                <Ionicons name="pricetag-outline" size={11} color="#7C3AED" />
                <Text style={styles.promoChipText}>{item.promo_code_used}</Text>
              </View>
            )}
          </View>
        )}
        {item.remark ? (
          <View style={styles.remarkChip}>
            <Ionicons name="chatbox-ellipses-outline" size={12} color="#7C3AED" />
            <Text style={styles.remarkChipText} numberOfLines={1}>{item.remark}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderPlan = ({ item, index }: { item: PlanRow; index: number }) => {
    const ac = accentForPlan(item.slug, index);
    const rupees = (item.amount_paise / 100).toLocaleString('en-IN');
    return (
      <View style={[styles.card, { opacity: item.is_active ? 1 : 0.55 }]}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: ac + '22' }]}>
            <Ionicons name="layers-outline" size={20} color={ac} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.title}</Text>
            <Text style={styles.cardEmail}>{item.slug} · ₹{rupees}{item.months == null ? ' · Lifetime' : ` · ${item.months} mo`}</Text>
          </View>
          {!item.is_active && (
            <View style={[styles.badge, { backgroundColor: Colors.textMuted + '33' }]}>
              <Text style={styles.badgeText}>OFF</Text>
            </View>
          )}
        </View>
        <View style={styles.planActions}>
          <TouchableOpacity style={[styles.smallBtn, { borderColor: Colors.primary }]} onPress={() => openEditPlan(item)}>
            <Text style={[styles.smallBtnText, { color: Colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          {item.is_active && (
            <TouchableOpacity style={[styles.smallBtn, { borderColor: Colors.danger }]} onPress={() => deactivatePlan(item)}>
              <Text style={[styles.smallBtnText, { color: Colors.danger }]}>Deactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabChip, tab === 'members' && styles.tabChipOn]} onPress={() => setTab('members')}>
          <Text style={[styles.tabChipText, tab === 'members' && styles.tabChipTextOn]}>Members</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, tab === 'plans' && styles.tabChipOn]} onPress={() => setTab('plans')}>
          <Text style={[styles.tabChipText, tab === 'plans' && styles.tabChipTextOn]}>Plans</Text>
        </TouchableOpacity>
      </View>

      {tab === 'members' && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or email…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {tab === 'members' && (
        <View style={styles.statsRow}>
          {[
            { label: 'Shown', count: subs.length, color: Colors.primary },
            { label: 'Active', count: subs.filter(s => s.status === 'active').length, color: Colors.success },
            { label: 'Expired', count: subs.filter(s => s.status === 'expired').length, color: Colors.warning },
            { label: 'Lifetime', count: subs.filter(s => !s.expires_at).length, color: Colors.accent },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'members' ? (
        loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
        ) : (
          <FlatList
            data={subs}
            keyExtractor={i => i.id}
            renderItem={renderSub}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubs(); }} />}
            ListEmptyComponent={<Text style={styles.empty}>{searchDebounced ? 'No matches' : 'No subscriptions yet'}</Text>}
          />
        )
      ) : (
        <>
          <TouchableOpacity style={styles.addPlanBtn} onPress={openCreatePlan}>
            <Ionicons name="add-circle-outline" size={22} color={Colors.white} />
            <Text style={styles.addPlanBtnText}>New plan</Text>
          </TouchableOpacity>
          {plansLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={plans}
              keyExtractor={i => i.id}
              renderItem={renderPlan}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={<RefreshControl refreshing={plansRefreshing} onRefresh={() => fetchPlans({ silent: true })} />}
              ListEmptyComponent={<Text style={styles.empty}>No plan rows — run DB migration (see backend/sql/subscription_plans.sql)</Text>}
            />
          )}
        </>
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected.users?.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Email', selected.users?.email],
                ['Role', selected.users?.role],
                ['Plan', selected.plan],
                ['Status', selected.status],
                ['Paid Amount', selected.paid_amount != null ? `₹${Number(selected.paid_amount).toLocaleString('en-IN')}` : '—'],
                ['Promo Used', selected.promo_code_used || '—'],
                ['Started', new Date(selected.started_at).toLocaleString('en-IN')],
                ['Expires', selected.expires_at ? new Date(selected.expires_at).toLocaleString('en-IN') : 'Never (Lifetime)'],
                ['Gateway ID', selected.gateway_payment_id || selected.razorpay_payment_id || '—'],
              ].map(([k, v]) => (
                <View key={k as string} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{k as string}</Text>
                  <Text style={styles.detailVal}>{v as string}</Text>
                </View>
              ))}

              {selected.remark ? (
                <View style={styles.existingRemark}>
                  <Ionicons name="chatbox-ellipses" size={14} color="#7C3AED" />
                  <Text style={styles.existingRemarkText}>{selected.remark}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Remark <Text style={styles.optionalLabel}>(optional)</Text></Text>
              <TextInput
                style={styles.remarkInput}
                value={remark}
                onChangeText={setRemark}
                placeholder="e.g. Cash collected by Ravi on 01 Apr"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={300}
              />
              <Text style={styles.charCount}>{remark.length}/300</Text>

              <Text style={styles.sectionLabel}>Grant subscription</Text>
              <View style={styles.grantWrap}>
                {grantablePlans.length === 0 ? (
                  <Text style={styles.hint}>Add an active plan in the Plans tab first.</Text>
                ) : (
                  grantablePlans.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.grantChip, { borderColor: accentForPlan(p.slug, p.sort_order) }]}
                      onPress={() => grant(selected.user_id, p.slug)}
                      disabled={acting}
                    >
                      <Text style={[styles.grantChipText, { color: accentForPlan(p.slug, p.sort_order) }]}>{p.title}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
              {selected.status === 'active' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger, marginTop: 8 }]} onPress={() => revoke(selected.user_id)} disabled={acting}>
                  <Text style={styles.actionBtnText}>Revoke Subscription</Text>
                </TouchableOpacity>
              )}
              {acting && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={planModal !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{planModal === 'create' ? 'New plan' : 'Edit plan'}</Text>
            <TouchableOpacity onPress={() => setPlanModal(null)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Slug (stored on user)</Text>
            <TextInput
              style={styles.fieldInput}
              value={planForm.slug}
              onChangeText={(v) => setPlanForm({ ...planForm, slug: v.toLowerCase() })}
              placeholder="e.g. yearly"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              editable={planModal === 'create'}
            />
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput style={styles.fieldInput} value={planForm.title} onChangeText={(v) => setPlanForm({ ...planForm, title: v })} placeholder="Display name" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Amount (paise)</Text>
            <TextInput style={styles.fieldInput} value={planForm.amount_paise} onChangeText={(v) => setPlanForm({ ...planForm, amount_paise: v })} placeholder="1500 = ₹15" keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Months (empty = lifetime)</Text>
            <TextInput style={styles.fieldInput} value={planForm.months} onChangeText={(v) => setPlanForm({ ...planForm, months: v })} placeholder="1, 12, or leave blank" keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Sort order</Text>
            <TextInput style={styles.fieldInput} value={planForm.sort_order} onChangeText={(v) => setPlanForm({ ...planForm, sort_order: v })} keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Allow newspaper add-on</Text>
              <Switch value={planForm.allow_newspaper_addon} onValueChange={(v) => setPlanForm({ ...planForm, allow_newspaper_addon: v })} />
            </View>

            <Text style={styles.fieldLabel}>Newspaper addon (paise, optional)</Text>
            <TextInput style={styles.fieldInput} value={planForm.newspaper_addon_paise} onChangeText={(v) => setPlanForm({ ...planForm, newspaper_addon_paise: v })} placeholder="300 for ₹3" keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={styles.fieldInput} value={planForm.description} onChangeText={(v) => setPlanForm({ ...planForm, description: v })} placeholder="Short line for app" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Features (one per line)</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 100, textAlignVertical: 'top' }]}
              value={planForm.featuresText}
              onChangeText={(v) => setPlanForm({ ...planForm, featuresText: v })}
              multiline
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary, marginTop: 16 }]} onPress={savePlan} disabled={savingPlan}>
              {savingPlan ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save</Text>}
            </TouchableOpacity>
            <View style={{ height: 48 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  tabChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  tabChipOn: { backgroundColor: '#3B5FC0', borderColor: '#3B5FC0' },
  tabChipText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabChipTextOn: { color: Colors.white },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statCount: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardEmail: { fontSize: 12, color: Colors.textMuted },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 15 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey: { fontSize: 13, color: Colors.textMuted },
  detailVal: { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  grantWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grantChip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  grantChipText: { fontWeight: '700', fontSize: 13 },
  hint: { color: Colors.textMuted, fontSize: 14 },
  actionBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  paidAmt: { fontSize: 13, fontWeight: '700', color: Colors.success },
  promoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  promoChipText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
  remarkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  remarkChipText: { fontSize: 12, color: '#7C3AED', fontWeight: '600', maxWidth: 260 },
  existingRemark: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginTop: 12 },
  existingRemarkText: { fontSize: 13, color: '#7C3AED', fontWeight: '600', flex: 1 },
  optionalLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  remarkInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg, minHeight: 72, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 4 },
  addPlanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, paddingVertical: 12, backgroundColor: '#3B5FC0', borderRadius: 12 },
  addPlanBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  planActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  smallBtnText: { fontWeight: '700', fontSize: 13 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginTop: 12, marginBottom: 4 },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});
